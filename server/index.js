const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory map: room -> Map(socketId -> { username, gender })
const roomUsers = {};

// Serve the entire website from the parent folder
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const botEngine = require('./botEngine')(io);

const JWT_SECRET = 'caught_me_super_secret_key'; // In production this should be in an env var

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeOwner = (req, res, next) => {
    if (req.user.role !== 'OWNER') return res.sendStatus(403);
    next();
};

// --- AUTH API ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'NORMAL'], function(err) {
        if (err) return res.status(400).json({ error: 'Username taken or error' });
        res.status(201).json({ message: 'User created' });
    });
});

// --- OWNER API ---

app.get('/api/admin/users', authenticateToken, authorizeOwner, (req, res) => {
    db.all('SELECT id, username, role FROM users', (err, rows) => {
        res.json(rows);
    });
});

// Real chat users (from messages table — includes guests)
app.get('/api/admin/chat-users', authenticateToken, authorizeOwner, (req, res) => {
    db.all(`
        SELECT 
            username,
            COUNT(*) as message_count,
            MAX(room_slug) as last_room,
            MAX(timestamp) as last_seen
        FROM messages
        GROUP BY username
        ORDER BY last_seen DESC
        LIMIT 100
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Pure guest users — chatted but never registered
app.get('/api/admin/guest-users', authenticateToken, authorizeOwner, (req, res) => {
    db.all(`
        SELECT 
            m.username,
            COUNT(*) as message_count,
            MAX(m.room_slug) as last_room,
            MAX(m.timestamp) as last_seen
        FROM messages m
        WHERE m.username NOT IN (SELECT username FROM users)
        GROUP BY m.username
        ORDER BY last_seen DESC
        LIMIT 200
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.put('/api/admin/users/:id/role', authenticateToken, authorizeOwner, (req, res) => {
    const { role } = req.body;
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Role updated' });
    });
});

app.get('/api/admin/personas', authenticateToken, authorizeOwner, (req, res) => {
    db.all('SELECT * FROM personas', (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/personas', authenticateToken, authorizeOwner, (req, res) => {
    const { username, gender, room_slug } = req.body;
    db.run('INSERT INTO personas (username, gender, room_slug, avatar_seed) VALUES (?, ?, ?, ?)', 
        [username, gender, room_slug, username], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Persona created', id: this.lastID });
    });
});

app.delete('/api/admin/personas/:id', authenticateToken, authorizeOwner, (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM persona_assignments WHERE persona_id = ?', [req.params.id]);
        db.run('DELETE FROM personas WHERE id = ?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Persona deleted' });
        });
    });
});

app.get('/api/admin/assignments', authenticateToken, authorizeOwner, (req, res) => {
    const query = `
        SELECT pa.operator_id, pa.persona_id, u.username as operator, p.username as persona, p.room_slug
        FROM persona_assignments pa
        JOIN users u ON pa.operator_id = u.id
        JOIN personas p ON pa.persona_id = p.id
    `;
    db.all(query, (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/assignments', authenticateToken, authorizeOwner, (req, res) => {
    const { operator_id, persona_id } = req.body;
    db.run('INSERT INTO persona_assignments (operator_id, persona_id) VALUES (?, ?)', [operator_id, persona_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Assigned successfully' });
    });
});

app.delete('/api/admin/assignments', authenticateToken, authorizeOwner, (req, res) => {
    const { operator_id, persona_id } = req.body;
    db.run('DELETE FROM persona_assignments WHERE operator_id = ? AND persona_id = ?', [operator_id, persona_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Unassigned successfully' });
    });
});

// --- DATABASE ADMIN API ---
app.get('/api/admin/db/tables', authenticateToken, authorizeOwner, (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const tables = rows.map(r => r.name).filter(n => n !== 'sqlite_sequence');
        res.json(tables);
    });
});

app.get('/api/admin/db/table/:name', authenticateToken, authorizeOwner, (req, res) => {
    const table = req.params.name;
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: 'Invalid table name' });

    db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/db/table/:name/:id', authenticateToken, authorizeOwner, (req, res) => {
    const table = req.params.name;
    const id = req.params.id;
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: 'Invalid table name' });

    const data = req.body;
    if (!data || Object.keys(data).length === 0) return res.status(400).json({ error: 'No data provided' });

    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    // SQLite primary key column might differ, but in this app it's usually 'id' or 'room_slug'.
    // If table is room_moderation, the primary key is room_slug. For persona_assignments, it's composite, but we'll try to support single PKs for now.
    const primaryKey = table === 'room_moderation' ? 'room_slug' : 'id';

    const query = `UPDATE ${table} SET ${setClause} WHERE ${primaryKey} = ?`;
    values.push(id);

    db.run(query, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Row updated' });
    });
});

app.delete('/api/admin/db/table/:name/:id', authenticateToken, authorizeOwner, (req, res) => {
    const table = req.params.name;
    const id = req.params.id;
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: 'Invalid table name' });

    const primaryKey = table === 'room_moderation' ? 'room_slug' : 'id';
    
    db.run(`DELETE FROM ${table} WHERE ${primaryKey} = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Row deleted' });
    });
});

// --- OPERATOR API ---

app.get('/api/operator/personas', authenticateToken, (req, res) => {
    if (req.user.role !== 'PERSONA_OPERATOR' && req.user.role !== 'OWNER') {
        return res.json([]);
    }
    const query = `
        SELECT p.* 
        FROM personas p
        JOIN persona_assignments pa ON p.id = pa.persona_id
        WHERE pa.operator_id = ?
    `;
    db.all(query, [req.user.id], (err, rows) => {
        res.json(rows || []);
    });
});

// Operator self-creates a persona (max 5)
app.post('/api/operator/quick-persona', authenticateToken, (req, res) => {
    if (req.user.role !== 'PERSONA_OPERATOR' && req.user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    db.get('SELECT count(*) as count FROM persona_assignments WHERE operator_id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count >= 5) return res.status(400).json({ error: 'Maximum 5 personas allowed per operator' });

        const { username, gender, room_slug } = req.body;
        if (!username || !room_slug) return res.status(400).json({ error: 'Missing username or room_slug' });

        db.run('INSERT INTO personas (username, gender, room_slug, avatar_seed) VALUES (?, ?, ?, ?)',
            [username, gender || 'female', room_slug, username], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const personaId = this.lastID;
            db.run('INSERT INTO persona_assignments (operator_id, persona_id) VALUES (?, ?)',
                [req.user.id, personaId], function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: 'Persona created and assigned', id: personaId });
            });
        });
    });
});

// --- CHAT API (for initial load) ---
app.get('/api/chat/messages', (req, res) => {
    const room = req.query.room;
    // Fetch last 50 messages
    db.all('SELECT * FROM messages WHERE room_slug = ? ORDER BY timestamp DESC LIMIT 50', [room], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.reverse());
    });
});

// --- LIVE USERS IN ROOM ---
app.get('/api/chat/users', (req, res) => {
    const room = req.query.room;
    if (!room) return res.status(400).json({ error: 'room required' });
    const users = roomUsers[room] ? Array.from(roomUsers[room].values()) : [];
    res.json(users);
});
// --- ROOM MODERATION API ---
app.get('/api/admin/room-moderation/:room_slug', authenticateToken, authorizeOwner, (req, res) => {
    db.get('SELECT * FROM room_moderation WHERE room_slug = ?', [req.params.room_slug], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { room_slug: req.params.room_slug, banned_words: '', strict_mode: 0 });
    });
});

app.post('/api/admin/room-moderation', authenticateToken, authorizeOwner, (req, res) => {
    const { room_slug, banned_words, strict_mode } = req.body;
    db.run('INSERT INTO room_moderation (room_slug, banned_words, strict_mode) VALUES (?, ?, ?) ON CONFLICT(room_slug) DO UPDATE SET banned_words=excluded.banned_words, strict_mode=excluded.strict_mode',
        [room_slug, banned_words, strict_mode], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Moderation settings saved' });
    });
});

// --- SITE IMAGES API ---
app.get('/api/images', (req, res) => {
    db.all('SELECT image_key, url FROM site_images', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const imageMap = {};
        rows.forEach(r => imageMap[r.image_key] = r.url);
        res.json(imageMap);
    });
});

app.get('/api/admin/images', authenticateToken, authorizeOwner, (req, res) => {
    db.all('SELECT * FROM site_images', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/images/:key', authenticateToken, authorizeOwner, (req, res) => {
    const key = req.params.key;
    const { url } = req.body;
    
    // First get the old url
    db.get('SELECT url FROM site_images WHERE image_key = ?', [key], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Image key not found' });
        
        const oldUrl = row.url;
        
        db.serialize(() => {
            db.run('INSERT INTO site_images_history (image_key, url) VALUES (?, ?)', [key, oldUrl]);
            db.run('UPDATE site_images SET url = ? WHERE image_key = ?', [url, key], function(updateErr) {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ message: 'Image updated successfully' });
            });
        });
    });
});

app.get('/api/admin/images/:key/history', authenticateToken, authorizeOwner, (req, res) => {
    db.all('SELECT * FROM site_images_history WHERE image_key = ? ORDER BY created_at DESC', [req.params.key], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- BOT ENGINE API ---
app.get('/api/admin/bot-engine/:room_slug/status', authenticateToken, authorizeOwner, (req, res) => {
    res.json({ active: botEngine.getStatus(req.params.room_slug) });
});

app.post('/api/admin/bot-engine/:room_slug/start', authenticateToken, authorizeOwner, async (req, res) => {
    const { responseChance, mediaPool } = req.body || {};
    const result = await botEngine.start(req.params.room_slug, { responseChance, mediaPool });
    res.json(result || { success: true });
});

app.post('/api/admin/bot-engine/:room_slug/stop', authenticateToken, authorizeOwner, (req, res) => {
    res.json(botEngine.stop(req.params.room_slug));
});

app.get('/api/admin/bot-engine/:room_slug/bots', authenticateToken, authorizeOwner, async (req, res) => {
    const bots = await botEngine.getBotsForRoom(req.params.room_slug);
    res.json(bots);
});

app.post('/api/admin/bot-engine/:room_slug/bots', authenticateToken, authorizeOwner, (req, res) => {
    const { username, gender, persona } = req.body;
    db.run('INSERT INTO engine_bots (room_slug, username, gender, persona) VALUES (?, ?, ?, ?)', 
        [req.params.room_slug, username, gender, persona], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Bot created', id: this.lastID });
    });
});

app.put('/api/admin/bot-engine/bots/:id', authenticateToken, authorizeOwner, (req, res) => {
    const { username, gender, persona, room_slug } = req.body;
    db.run('UPDATE engine_bots SET username = ?, gender = ?, persona = ?, room_slug = ? WHERE id = ?',
        [username, gender, persona, room_slug, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Bot updated' });
    });
});

app.delete('/api/admin/bot-engine/bots/:id', authenticateToken, authorizeOwner, (req, res) => {
    db.run('DELETE FROM engine_bots WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Bot deleted' });
    });
});


// --- WEBSOCKETS ---

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_room', ({ room, username, isGuest, gender }) => {
        const ipAddress = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        socket.join(room);
        socket._room = room;
        socket._username = username;
        if (!roomUsers[room]) roomUsers[room] = new Map();
        roomUsers[room].set(socket.id, { username, gender: gender || (isGuest ? 'Guest' : 'Member') });
        // Broadcast updated user list to everyone in the room
        io.to(room).emit('user_list', Array.from(roomUsers[room].values()));
        console.log(`[JOIN] ${username} joined room: ${room} (IP: ${ipAddress})`);
    });

    // Admin panel live log subscription
    socket.on('admin_watch', () => {
        socket.join('admin_watch');
        console.log(`[WS] Admin socket joined admin_watch: ${socket.id}`);
    });

    socket.on('send_message', (data, callback) => {
        console.log(`[WS] Received send_message from socket ${socket.id}:`, data);
        const { room, content, mediaUrl, token, asPersonaId } = data;
        let operator_id = null;
        let persona_id = null;
        let displayUsername = data.username || 'Guest';

        // Check authentication if trying to send as persona
        if (asPersonaId) {
            if (!token) {
                console.log(`[WS] Unauthorized persona send attempt (no token)`);
                return callback({ error: 'Unauthorized' });
            }
            try {
                const user = jwt.verify(token, JWT_SECRET);
                if (user.role !== 'PERSONA_OPERATOR' && user.role !== 'OWNER') {
                    console.log(`[WS] Unauthorized role persona send attempt: ${user.role}`);
                    return callback({ error: 'Unauthorized role' });
                }
                
                // Verify persona is assigned to operator
                db.get('SELECT p.* FROM personas p JOIN persona_assignments pa ON p.id = pa.persona_id WHERE p.id = ? AND pa.operator_id = ?', 
                    [asPersonaId, user.id], (err, persona) => {
                    
                    if (err || !persona) {
                        console.log(`[WS] Persona not assigned: id=${asPersonaId}, operator=${user.id}`);
                        return callback({ error: 'Persona not assigned to you' });
                    }
                    if (persona.room_slug !== room) {
                        console.log(`[WS] Persona room mismatch: expected=${persona.room_slug}, actual=${room}`);
                        return callback({ error: 'Persona cannot post in this room' });
                    }

                    operator_id = user.id;
                    persona_id = persona.id;
                    displayUsername = persona.username;
                    saveAndBroadcast();
                });
                return; // Wait for async DB query
            } catch (err) {
                console.log(`[WS] Invalid token on persona send attempt`);
                return callback({ error: 'Invalid token' });
            }
        } else {
            // Normal user message
            if (token) {
                try {
                    const user = jwt.verify(token, JWT_SECRET);
                    operator_id = user.id; // Just standard user sending message as themselves
                    displayUsername = user.username;
                } catch (e) {} // ignore, treat as guest if token invalid
            }
            
            // Handle Whisper
            let textLower = (content || '').trim();
            if (textLower.startsWith('/w ')) {
                const match = content.match(/^\/w\s+([^\s]+)\s+(.*)$/i);
                if (match) {
                    const targetUsername = match[1];
                    const whisperContent = match[2];
                    
                    if (roomUsers[room]) {
                        let targetSocketId = null;
                        for (const [sId, user] of roomUsers[room].entries()) {
                            // Case-insensitive match for whisper target
                            if (user.username.toLowerCase() === targetUsername.toLowerCase()) {
                                targetSocketId = sId;
                                break;
                            }
                        }
                        
                        const msg = {
                            id: Date.now(),
                            room_slug: room,
                            username: displayUsername,
                            content: `(Whisper to ${targetUsername}) ${whisperContent}`,
                            mediaUrl: mediaUrl,
                            timestamp: new Date().toISOString(),
                            isWhisper: true
                        };
                        
                        // Always show the whisper to the sender
                        socket.emit('new_message', msg);
                        
                        if (targetSocketId && targetSocketId !== socket.id) {
                            io.to(targetSocketId).emit('new_message', msg);
                        } else {
                            // Target not found in sockets. Might be a bot! Forward to BotEngine.
                            // We construct a fake message object that looks like it's addressing the bot.
                            botEngine.onNewMessage(room, {
                                username: displayUsername,
                                content: `(Whisper) ${whisperContent}`
                            });
                        }
                        
                        if (callback) callback({ success: true, message: msg });
                        return; // Do not save or broadcast globally
                    }
                }
            }
            
            checkModerationAndBroadcast();
        }

        function checkModerationAndBroadcast() {
            db.get('SELECT * FROM room_moderation WHERE room_slug = ?', [room], (err, mod) => {
                if (!err && mod && mod.banned_words) {
                    const banned = mod.banned_words.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
                    const textLower = (content || '').toLowerCase();
                    const containsBanned = banned.some(word => textLower.includes(word));
                    
                    if (containsBanned) {
                        return callback && callback({ error: 'Message contains banned words' });
                    }
                }
                saveAndBroadcast();
            });
        }

        function saveAndBroadcast() {
            console.log(`[WS] Saving and broadcasting message to room: ${room}`);
            db.run('INSERT INTO messages (room_slug, operator_id, persona_id, username, content, media_url) VALUES (?, ?, ?, ?, ?, ?)',
                [room, operator_id, persona_id, displayUsername, content, mediaUrl], function(err) {
                if (err) {
                    console.error('Error saving message:', err);
                    return callback && callback({ error: 'Database error' });
                }
                
                const msg = {
                    id: this.lastID,
                    room_slug: room,
                    username: displayUsername,
                    content: content,
                    mediaUrl: mediaUrl,
                    timestamp: new Date().toISOString()
                };

                io.to(room).emit('new_message', msg);
                console.log(`[WS] Emitted new_message to ${room}:`, msg);
                
                // Trigger Bot Engine
                botEngine.onNewMessage(room, msg);
                
                if (callback) callback({ success: true, message: msg });
            });
        }
    });


    socket.on('delete_message', (data, callback) => {
        const { room, id, token } = data;
        let isAuthorized = false;
        if (token) {
            try {
                const user = jwt.verify(token, JWT_SECRET);
                if (user.role === 'OWNER' || user.role === 'MODERATOR') isAuthorized = true;
            } catch(e){}
        }
        db.get('SELECT username FROM messages WHERE id = ?', [id], (err, row) => {
            if (row && (isAuthorized || row.username === socket._username)) {
                db.run('DELETE FROM messages WHERE id = ?', [id], () => {
                    io.to(room).emit('message_deleted', id);
                    if (callback) callback({success:true});
                });
            } else {
                if (callback) callback({error:'Unauthorized'});
            }
        });
    });


    socket.on('send_friend_request', (data) => {
        const { targetUsername } = data;
        const senderUsername = socket._username;
        const room = socket._room;
        if (roomUsers[room]) {
            for (const [sId, user] of roomUsers[room].entries()) {
                if (user.username === targetUsername) {
                    io.to(sId).emit('friend_request_received', { from: senderUsername });
                    break;
                }
            }
        }
    });

    socket.on('accept_friend_request', (data) => {
        const { targetUsername } = data;
        const accepterUsername = socket._username;
        const room = socket._room;
        if (roomUsers[room]) {
            for (const [sId, user] of roomUsers[room].entries()) {
                if (user.username === targetUsername) {
                    io.to(sId).emit('friend_request_accepted', { from: accepterUsername });
                    break;
                }
            }
        }
    });

    socket.on('disconnect', () => {

        console.log('User disconnected:', socket.id);
        const room = socket._room;
        if (room && roomUsers[room]) {
            roomUsers[room].delete(socket.id);
            io.to(room).emit('user_list', Array.from(roomUsers[room].values()));
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
