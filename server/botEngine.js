const db = require('./db');

const GROQ_API_KEY = process.env.GROQ_API_KEY || 'YOUR_GROQ_API_KEY_HERE';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// State tracker — keyed by room_slug
const activeEngines = {};

function log(ioInstance, msg, type = 'info') {
    console.log(`[BotEngine] ${msg}`);
    if (ioInstance) ioInstance.to('admin_watch').emit('bot_log', { msg, type });
}

const SPONTANEOUS_PROMPTS = [
    'Say something casual and fun to start a conversation in the chat room. 1 sentence only.',
    'Drop a flirty or playful one-liner in the chat room.',
    'Say something like you just joined the chat and want to talk. Keep it natural and short.',
    'Make a random, casual comment about what you are doing right now. 1 sentence.',
    'Ask the chat room a short casual question to get a conversation going.',
    'Drop a cheeky or funny comment to get people talking.',
    'Say something like you are bored and want someone to talk to.'
];

class BotEngine {
    constructor(ioInstance) {
        this.io = ioInstance;
    }

    async getBotsForRoom(room_slug) {
        return new Promise((resolve) => {
            db.all('SELECT * FROM engine_bots WHERE room_slug = ?', [room_slug], (err, rows) => {
                resolve(rows || []);
            });
        });
    }

    async generateAndSend(bot, room_slug, replyToUser, replyToMessage, recentHistory, overridePrompt, attachedMediaUrl = '') {
        let systemPrompt;
        
        if (overridePrompt) {
            systemPrompt = `${bot.persona}\n\nYou are in a live chat room right now. ${overridePrompt} Do NOT use quotation marks. Reply in plain text only.`;
        } else {
            const historyText = recentHistory.map(m => `${m.username}: ${m.content}`).join('\n');
            systemPrompt = `${bot.persona}
            
You are in a live chat room. Keep replies VERY SHORT (1-2 sentences max). Speak casually, like a real person texting.
Do NOT use formal language. Do NOT use quotation marks. Reply in plain text only.
Do NOT introduce yourself again.

Recent chat:
${historyText}

Now reply naturally to ${replyToUser} who said: "${replyToMessage}"`;
        }

        try {
            const res = await fetch(GROQ_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen/qwen3.8-27b',
                    messages: [{ role: 'user', content: systemPrompt }],
                    temperature: 0.9,
                    max_tokens: 80
                })
            });

            const aiData = await res.json();
            if (aiData.choices && aiData.choices[0]) {
                let msg = aiData.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
                
                // Save to DB and broadcast via Socket.io
                db.run('INSERT INTO messages (room_slug, username, content, media_url) VALUES (?, ?, ?, ?)',
                    [room_slug, bot.username, msg, attachedMediaUrl], function(err) {
                    if (!err) {
                        const newMsg = {
                            id: this.lastID,
                            room_slug: room_slug,
                            username: bot.username,
                            content: msg,
                            mediaUrl: attachedMediaUrl,
                            timestamp: new Date().toISOString()
                        };
                        this.io.to(room_slug).emit('new_message', newMsg);
                        log(this.io, `${bot.username}: "${msg}"`, 'info');
                    }
                }.bind(this));
            }
        } catch (e) {
            log(this.io, `Groq API Error: ${e.message}`, 'error');
        }
    }

    scheduleSpontaneous(room_slug) {
        const engine = activeEngines[room_slug];
        if (!engine || !engine.active) return;

        const delay = (10 + Math.random() * 20) * 1000;
        engine.spontaneousInterval = setTimeout(async () => {
            if (!activeEngines[room_slug] || !activeEngines[room_slug].active) return;
            
            const bots = await this.getBotsForRoom(room_slug);
            if (bots.length > 0 && Math.random() < 0.75) {
                const bot = bots[Math.floor(Math.random() * bots.length)];
                const prompt = SPONTANEOUS_PROMPTS[Math.floor(Math.random() * SPONTANEOUS_PROMPTS.length)];
                
                // 15% chance to post a media item from the pool
                const mediaPool = activeEngines[room_slug].mediaPool || [];
                let mediaUrl = '';
                if (mediaPool.length > 0 && Math.random() < 0.15) {
                    mediaUrl = mediaPool[Math.floor(Math.random() * mediaPool.length)];
                    log(this.io, `📸 ${bot.username} posting media in ${room_slug}`, 'info');
                } else {
                    log(this.io, `${bot.username} sending spontaneous message in ${room_slug}`, 'info');
                }
                this.generateAndSend(bot, room_slug, null, null, [], prompt, mediaUrl);
            }
            this.scheduleSpontaneous(room_slug);
        }, delay);
    }

    async start(room_slug, options = {}) {
        if (activeEngines[room_slug] && activeEngines[room_slug].active) return;
        
        const bots = await this.getBotsForRoom(room_slug);
        if (bots.length === 0) return { error: 'No bots configured for this room.' };
        
        const responseChance = options.responseChance || 40;
        const mediaPool = options.mediaPool || [];
        
        activeEngines[room_slug] = { active: true, spontaneousInterval: null, bots, responseChance, mediaPool };
        log(this.io, `Engine started in ${room_slug} with ${bots.length} bots (${responseChance}% reply chance)`, 'success');

        // Staggered joins — each bot joins 3-8s apart
        bots.forEach((bot, index) => {
            const delay = (3000 + Math.random() * 5000) * (index + 1);
            setTimeout(() => {
                if (activeEngines[room_slug] && activeEngines[room_slug].active) {
                    log(this.io, `${bot.username} joined ${room_slug}`, 'info');
                }
            }, delay);
        });

        this.scheduleSpontaneous(room_slug);
        return { success: true };
    }

    stop(room_slug) {
        if (activeEngines[room_slug]) {
            clearTimeout(activeEngines[room_slug].spontaneousInterval);
            activeEngines[room_slug].active = false;
        }
        log(this.io, `Engine stopped in ${room_slug}`, 'warn');
        return { success: true };
    }

    getStatus(room_slug) {
        return !!(activeEngines[room_slug] && activeEngines[room_slug].active);
    }

    // Called by index.js when a new user message arrives
    async onNewMessage(room_slug, msgObj) {
        if (!activeEngines[room_slug] || !activeEngines[room_slug].active) return;

        const bots = await this.getBotsForRoom(room_slug);
        const botNames = bots.map(b => b.username);
        const responseChance = (activeEngines[room_slug].responseChance || 40) / 100;

        // If it's a real user message, chance to reply
        if (!botNames.includes(msgObj.username) && msgObj.username !== '🛡️ SYSTEM') {
            if (Math.random() < responseChance) {
                const bot = bots[Math.floor(Math.random() * bots.length)];
                
                db.all('SELECT * FROM messages WHERE room_slug = ? ORDER BY timestamp DESC LIMIT 5', [room_slug], (err, rows) => {
                    if (err || !rows) return;
                    const history = rows.reverse();
                    log(this.io, `${bot.username} replying to ${msgObj.username} in ${room_slug}`, 'info');
                    setTimeout(() => {
                        this.generateAndSend(bot, room_slug, msgObj.username, msgObj.content, history, null);
                    }, 1500 + Math.random() * 2500);
                });
            }
        }
        
        // Bot to bot interaction
        if (botNames.includes(msgObj.username) && bots.length > 1) {
            if (Math.random() < 0.40) {
                const otherBots = bots.filter(b => b.username !== msgObj.username);
                const replyBot = otherBots[Math.floor(Math.random() * otherBots.length)];
                
                db.all('SELECT * FROM messages WHERE room_slug = ? ORDER BY timestamp DESC LIMIT 5', [room_slug], (err, rows) => {
                    if (err || !rows) return;
                    const history = rows.reverse();
                    log(this.io, `🤖↔️🤖 ${replyBot.username} replying to bot ${msgObj.username}`, 'info');
                    setTimeout(() => {
                        this.generateAndSend(replyBot, room_slug, msgObj.username, msgObj.content, history, null);
                    }, 4000 + Math.random() * 6000);
                });
            }
        }
    }
}

module.exports = function(ioInstance) {
    return new BotEngine(ioInstance);
};
