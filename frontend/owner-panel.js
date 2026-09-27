const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://YOUR_RENDER_URL.onrender.com';
const token = localStorage.getItem('cm_token');

if (!token) {
    window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('cm_token');
    window.location.href = 'login.html';
});

const loadedTabs = new Set();

window.switchTab = function(tabId, btn) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    // Show selected tab
    document.getElementById(tabId).classList.add('active');

    // Update active nav button
    document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');

    // Lazy-load data for each tab (only first time)
    if (!loadedTabs.has(tabId)) {
        loadedTabs.add(tabId);
        if (tabId === 'tab-users')       loadUsers();
        if (tabId === 'tab-personas')    loadPersonas();
        if (tabId === 'tab-assignments') { loadPersonas(); loadAssignments(); }
        if (tabId === 'tab-engine')      loadBotEngine();
        if (tabId === 'tab-images')      loadImages();
    }
};

function fetchAPI(endpoint, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    return fetch(`${SERVER_URL}${endpoint}`, options)
        .then(res => {
            if (res.status === 401 || res.status === 403) {
                alert('Unauthorized Access');
                window.location.href = 'index.html';
                throw new Error('Unauthorized');
            }
            return res.json();
        });
}

function loadData() {
    loadUsers();
    loadPersonas();
    loadAssignments();
}

function loadUsers() {
    // Fetch registered accounts
    fetchAPI('/api/admin/users').then(users => {
        const list = document.getElementById('usersList');
        const countEl = document.getElementById('registeredCount');
        list.innerHTML = '';
        if (countEl) countEl.textContent = users.length + ' user' + (users.length !== 1 ? 's' : '');

        users.forEach(user => {
            const li = document.createElement('li');
            const roleColor = user.role === 'OWNER' ? '#e8760a' : user.role === 'PERSONA_OPERATOR' ? '#4a90e2' : '#4caf50';
            li.innerHTML = `
                <div class="details" style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}" style="width:38px;height:38px;border-radius:50%;background:#222;flex-shrink:0;">
                    <div>
                        <strong>${user.username}</strong>
                        <span style="color:${roleColor}; font-size:11px; font-weight:600;">${user.role}</span>
                    </div>
                </div>
                <div class="action-btns">
                    ${user.role !== 'OWNER' ? `
                        <select onchange="setRole(${user.id}, this.value)" style="padding: 4px 8px; border-radius: 4px; background: #333; color: white; border: 1px solid #555; cursor: pointer;">
                            <option value="NORMAL" ${user.role === 'NORMAL' ? 'selected' : ''}>Normal User</option>
                            <option value="PERSONA_OPERATOR" ${user.role === 'PERSONA_OPERATOR' ? 'selected' : ''}>Bot Operator</option>
                            <option value="OWNER">Promote to Admin</option>
                        </select>
                    ` : '<span style="color:#e8760a; font-size:12px; font-weight:700;">👑 Owner</span>'}
                </div>
            `;
            list.appendChild(li);
        });
    });

    // Fetch guest users (chatted but not registered)
    fetchAPI('/api/admin/guest-users').then(guests => {
        const guestsList = document.getElementById('guestsList');
        const countEl = document.getElementById('guestCount');
        if (!guestsList) return;
        if (countEl) countEl.textContent = guests.length + ' guest' + (guests.length !== 1 ? 's' : '');

        if (guests.length === 0) {
            guestsList.innerHTML = '<div style="color:#555; font-size:13px; padding:12px; grid-column:1/-1;">No guest activity yet.</div>';
            return;
        }

        guestsList.innerHTML = guests.map(g => {
            const lastSeen = g.last_seen ? new Date(g.last_seen).toLocaleDateString() : '—';
            return `
            <div style="background:#111; border:1px solid #222; border-radius:8px; padding:10px 12px; display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(g.username)}" style="width:34px;height:34px;border-radius:50%;background:#1a1a1a;flex-shrink:0;">
                <div style="min-width:0; flex:1;">
                    <div style="font-weight:700; font-size:13px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${g.username}</div>
                    <div style="font-size:11px; color:#555; margin-top:2px;">
                        ${g.message_count} msg${g.message_count !== 1 ? 's' : ''} &bull; ${g.last_room || '—'}
                    </div>
                    <div style="font-size:10px; color:#444; margin-top:1px;">Last: ${lastSeen}</div>
                </div>
                <span style="background:rgba(74,144,226,0.15); color:#4a90e2; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; flex-shrink:0;">GUEST</span>
            </div>`;
        }).join('');
    });
}

function loadPersonas() {
    fetchAPI('/api/admin/personas').then(personas => {
        const list = document.getElementById('personasList');
        const personaSelect = document.getElementById('assignPersonaId');
        list.innerHTML = '';
        personaSelect.innerHTML = '<option value="">-- Select Persona --</option>';

        personas.forEach(p => {
            // Populate list
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="details">
                    <strong>${p.username} (${p.gender})</strong>
                    <span>Room: ${p.room_slug}</span>
                </div>
                <div class="action-btns">
                    <button class="btn btn-danger" onclick="deletePersona(${p.id})">Delete</button>
                </div>
            `;
            list.appendChild(li);

            // Populate select
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.username} (${p.room_slug})`;
            personaSelect.appendChild(opt);
        });
    });
}

function loadAssignments() {
    Promise.all([
        fetchAPI('/api/admin/users'),
        fetchAPI('/api/admin/personas'),
        fetchAPI('/api/admin/assignments')
    ]).then(([registeredUsers, personas, assignments]) => {

        const userListEl = document.getElementById('assignUsersList');
        if (userListEl) {

            // Filter out OWNER from the list (owner doesn't need assignment)
            const assignable = registeredUsers.filter(u => u.role !== 'OWNER');

            if (assignable.length === 0) {
                userListEl.innerHTML = `
                    <div style="text-align:center; padding:20px; color:#555; font-size:13px;">
                        <i class="fa-solid fa-user-slash" style="font-size:28px; margin-bottom:8px; display:block; color:#333;"></i>
                        No registered users yet.<br>
                        <span style="font-size:11px; color:#444;">Only registered accounts can be assigned personas.</span>
                    </div>`;
            } else {
                userListEl.innerHTML = assignable.map(user => {
                    const isOperator = user.role === 'PERSONA_OPERATOR';
                    const roleColor  = isOperator ? '#4a90e2' : '#4caf50';
                    const roleLabel  = isOperator ? '⚙ Operator' : '● Registered';
                    return `
                    <div onclick="selectAssignUser(${user.id}, '${user.username.replace(/'/g, "\\'")}')"
                        id="assign-user-${user.id}"
                        style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px; cursor:pointer; margin-bottom:6px; transition:all 0.2s;"
                        onmouseover="this.style.borderColor='#e8760a'; this.style.background='rgba(232,118,10,0.06)'"
                        onmouseout="if(document.getElementById('assignOperatorId').value!='${user.id}'){this.style.borderColor='#2a2a2a'; this.style.background='#1a1a1a';}">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}"
                            style="width:36px;height:36px;border-radius:50%;background:#222;flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:13px; color:#fff;">${user.username}</div>
                            <div style="font-size:11px; color:${roleColor}; margin-top:2px;">${roleLabel}</div>
                        </div>
                        <i class="fa-solid fa-circle-check assign-check" id="assign-check-${user.id}"
                            style="color:#e8760a; display:none; font-size:15px;"></i>
                    </div>`;
                }).join('');
            }

            // ── Notice banner ──
            userListEl.insertAdjacentHTML('beforeend', `
                <div style="margin-top:12px; padding:8px 10px; background:rgba(255,193,7,0.07); border:1px solid rgba(255,193,7,0.2); border-radius:6px; font-size:11px; color:#888;">
                    <i class="fa-solid fa-lock" style="color:#f0c040;"></i>
                    Only <strong style="color:#f0c040;">registered accounts</strong> can be assigned personas. Guests are not eligible.
                </div>`);
        }

        // ── Populate persona dropdown ──
        const personaSelect = document.getElementById('assignPersonaId');
        if (personaSelect) {
            personaSelect.innerHTML = '<option value="">-- Select Persona --</option>';
            personas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.username} (${p.room_slug})`;
                personaSelect.appendChild(opt);
            });
        }

        // ── Current assignments list ──
        const list = document.getElementById('assignmentsList');
        list.innerHTML = '';
        if (assignments.length === 0) {
            list.innerHTML = '<li style="color:#666; text-align:center; padding:20px; font-size:14px;">No assignments yet.</li>';
            return;
        }
        assignments.forEach(a => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="details">
                    <strong>${a.operator} &rarr; ${a.persona}</strong>
                    <span>Room: ${a.room_slug}</span>
                </div>
                <div class="action-btns">
                    <button class="btn btn-danger" onclick="unassignPersona(${a.operator_id}, ${a.persona_id})">Unassign</button>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

window.selectAssignUser = function(userId, username) {
    // Clear all selections
    document.querySelectorAll('[id^="assign-user-"]').forEach(el => {
        el.style.borderColor = '#2a2a2a';
        el.style.background = '#1a1a1a';
    });
    document.querySelectorAll('.assign-check').forEach(el => el.style.display = 'none');

    // Highlight selected card
    const card = document.getElementById(`assign-user-${userId}`);
    if (card) {
        card.style.borderColor = '#e8760a';
        card.style.background = 'rgba(232,118,10,0.08)';
    }
    // Show checkmark
    const check = document.getElementById(`assign-check-${userId}`) || document.getElementById(`assign-user-check-${userId}`);
    if (check) check.style.display = 'block';

    // Store value and update display label
    document.getElementById('assignOperatorId').value = userId;
    const display = document.getElementById('assignSelectedUser');
    if (display) {
        display.style.color = '#fff';
        display.innerHTML = `<i class="fa-solid fa-user" style="color:#e8760a;"></i> <strong>${username}</strong>`;
    }
};

window.setRole = function (userId, newRole) {
    if (newRole === 'OWNER' && !confirm('Are you sure you want to promote this user to full Admin (Owner)?')) {
        loadData(); // Reset the dropdown if cancelled
        return;
    }
    fetchAPI(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
    }).then(() => loadData());
};

window.deletePersona = function (id) {
    if (!confirm('Are you sure?')) return;
    fetchAPI(`/api/admin/personas/${id}`, { method: 'DELETE' }).then(() => {
        loadPersonas();
        loadAssignments();
    });
};

window.unassignPersona = function (operator_id, persona_id) {
    if (!confirm('Remove assignment?')) return;
    fetchAPI('/api/admin/assignments', {
        method: 'DELETE',
        body: JSON.stringify({ operator_id, persona_id })
    }).then(() => loadAssignments());
};

document.getElementById('btnCreatePersona').addEventListener('click', () => {
    const username = document.getElementById('newPersonaUsername').value;
    const gender = document.getElementById('newPersonaGender').value;
    const room_slug = document.getElementById('newPersonaRoom').value;

    if (!username || !room_slug) return alert('Fill all fields');

    fetchAPI('/api/admin/personas', {
        method: 'POST',
        body: JSON.stringify({ username, gender, room_slug })
    }).then(() => {
        document.getElementById('newPersonaUsername').value = '';
        document.getElementById('newPersonaRoom').value = '';
        loadPersonas();
        // Also refresh assignments tab if it was already loaded
        if (loadedTabs.has('tab-assignments')) loadAssignments();
    });
});

document.getElementById('btnAssignPersona').addEventListener('click', () => {
    const operator_id = document.getElementById('assignOperatorId').value;
    const persona_id = document.getElementById('assignPersonaId').value;

    if (!operator_id || !persona_id) return alert('Select both operator and persona');

    fetchAPI('/api/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({ operator_id, persona_id })
    }).then(() => {
        loadAssignments();
        alert('Persona assigned successfully!');
    });
});

// ══════════════════════════════════════════════════════
//  ROOM MODERATION
// ══════════════════════════════════════════════════════

const modRoomSelect = document.getElementById('modRoomSelect');
const modBannedWords = document.getElementById('modBannedWords');
const modStrictMode = document.getElementById('modStrictMode');
const modStatus = document.getElementById('modStatus');

modRoomSelect.addEventListener('change', () => {
    const slug = modRoomSelect.value;
    if (!slug) { modBannedWords.value = ''; modStrictMode.checked = false; return; }
    fetchAPI(`/api/admin/room-moderation/${slug}`).then(data => {
        modBannedWords.value = data.banned_words || '';
        modStrictMode.checked = !!data.strict_mode;
        modStatus.textContent = '';
    });
});

document.getElementById('btnSaveMod').addEventListener('click', () => {
    const room_slug = modRoomSelect.value;
    if (!room_slug) return alert('Select a room first');
    fetchAPI('/api/admin/room-moderation', {
        method: 'POST',
        body: JSON.stringify({
            room_slug,
            banned_words: modBannedWords.value.trim(),
            strict_mode: modStrictMode.checked ? 1 : 0
        })
    }).then(() => {
        modStatus.textContent = '✅ Saved!';
        setTimeout(() => { modStatus.textContent = ''; }, 2000);
    });
});


// ══════════════════════════════════════════════════════
//  BOT ENGINE MANAGEMENT
// ══════════════════════════════════════════════════════

let currentBotRoom = 'lounge-chat';
let engineActive = false;

// ── Bot Media Pool (stored in localStorage per room) ──
function getMediaPool() {
    return JSON.parse(localStorage.getItem(`cm_media_${currentBotRoom}`) || '[]');
}
function saveMediaPool(pool) {
    localStorage.setItem(`cm_media_${currentBotRoom}`, JSON.stringify(pool));
}

function renderMediaPool() {
    const pool = getMediaPool();
    const el = document.getElementById('mediaList');
    if (!el) return;
    if (pool.length === 0) {
        el.innerHTML = '<div style="color:#555; font-size:12px;">No media added yet. Bots won\'t post any images/videos.</div>';
        return;
    }
    el.innerHTML = pool.map((url, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#1a1a1a; padding:8px 12px; border-radius:6px; border:1px solid #333;">
            <a href="${url}" target="_blank" style="color:#e8760a; text-decoration:none; max-width:85%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px;">${url}</a>
            <button onclick="deleteMedia(${i})" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:16px;">🗑️</button>
        </div>
    `).join('');
}

window.addMedia = function() {
    const url = document.getElementById('mediaInput').value.trim();
    if (!url) return;
    const pool = getMediaPool();
    pool.push(url);
    saveMediaPool(pool);
    document.getElementById('mediaInput').value = '';
    renderMediaPool();
    botLog('Media added to pool: ' + url, 'info');
};

window.deleteMedia = function(i) {
    const pool = getMediaPool();
    pool.splice(i, 1);
    saveMediaPool(pool);
    renderMediaPool();
    botLog('Media removed from pool.', 'warn');
};

// ── Activity Log ──
function botLog(msg, type = 'info') {
    const el = document.getElementById('activityLog');
    if (!el) return;
    const colors = { info: '#44aaff', error: '#ff4444', warn: '#ffaa00', success: '#4caf50' };
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.style.color = colors[type] || '#ccc';
    div.textContent = `[${time}] ${msg}`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

// ── Socket.io for real-time bot logs ──
if (typeof io !== 'undefined') {
    const adminSocket = io(SERVER_URL);
    adminSocket.emit('admin_watch');
    adminSocket.on('bot_log', ({ msg, type }) => botLog(msg, type));
} else {
    console.warn("Socket.io failed to load, real-time bot logs disabled.");
}

// ── Engine Status ──
function updateEngineStatus(active) {
    engineActive = active;
    const badge = document.getElementById('engineStatusBadge');
    const btn = document.getElementById('btnToggleEngine');
    if (active) {
        badge.textContent = '🟢 Running';
        badge.style.color = '#4caf50';
        btn.textContent = 'Stop Engine';
        btn.className = 'btn btn-danger';
    } else {
        badge.textContent = '🔴 Offline';
        badge.style.color = '#f44336';
        btn.textContent = 'Start Engine';
        btn.className = 'btn btn-primary';
    }
}

// ── Render Bot Cards ──
function renderBotCards(bots) {
    const el = document.getElementById('botCardsList');
    const countEl = document.getElementById('botCount');
    if (!el) return;
    countEl.textContent = `${bots.length} bot${bots.length !== 1 ? 's' : ''}`;
    if (bots.length === 0) {
        el.innerHTML = '<div style="color:#555; padding:20px; grid-column:1/-1; text-align:center;">No bots in this room yet. Click + Add Bot.</div>';
        return;
    }
    el.innerHTML = bots.map(bot => {
        const accentColor = bot.gender === 'female' ? '#e24a9a' : '#4a90e2';
        const genderIcon = bot.gender === 'female' ? '♀' : '♂';
        return `
        <div style="background:#1a1a1a; border:1px solid #333; border-left:3px solid ${accentColor}; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bot.username)}" style="width:38px; height:38px; border-radius:50%; background:#222;">
                <div>
                    <div style="font-weight:700; font-size:14px;">${bot.username} <span style="color:${accentColor}; font-size:12px;">${genderIcon}</span></div>
                    <div style="font-size:11px; color:#666;">${bot.room_slug || currentBotRoom}</div>
                </div>
            </div>
            <div style="font-size:11px; color:#999; background:#111; padding:6px 8px; border-radius:6px; line-height:1.4;">${bot.persona.substring(0, 90)}${bot.persona.length > 90 ? '...' : ''}</div>
            <div style="display:flex; gap:6px; margin-top:auto;">
                <button onclick="editBot(${bot.id}, '${bot.username.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${bot.gender}', '${bot.room_slug || currentBotRoom}', this.closest('div.bot-card')?.dataset?.persona || '')" style="flex:1; background:#1a1a2e; border:1px solid #4a90e2; color:#4a90e2; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:12px;"><i class="fa-solid fa-pen"></i> Edit</button>
                <button onclick="deleteBot(${bot.id})" style="flex:1; background:#2a0000; border:1px solid #ff4444; color:#ff4444; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:12px;"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
        </div data-id="${bot.id}" data-persona="${bot.persona.replace(/"/g,'&quot;').replace(/'/g, "&#39;")}">`;
    }).join('');
}

// ── Load Bot Engine panel ──
function loadBotEngine() {
    const room = document.getElementById('botRoomSelect').value;
    currentBotRoom = room;
    renderMediaPool();

    fetchAPI(`/api/admin/bot-engine/${room}/status`).then(data => {
        updateEngineStatus(data.active);
    });

    fetchAPI(`/api/admin/bot-engine/${room}/bots`).then(bots => {
        renderBotCards(bots);
    });
}

document.getElementById('botRoomSelect').addEventListener('change', loadBotEngine);

document.getElementById('btnToggleEngine').addEventListener('click', () => {
    const endpoint = engineActive ? 'stop' : 'start';
    const responseChance = parseInt(document.getElementById('responseChance').value) || 40;
    const mediaPool = getMediaPool();
    fetchAPI(`/api/admin/bot-engine/${currentBotRoom}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ responseChance, mediaPool })
    }).then(res => {
        if (res.error) return alert(res.error);
        updateEngineStatus(!engineActive);
        botLog(engineActive ? `Engine stopped for ${currentBotRoom}` : `Engine started for ${currentBotRoom} (${responseChance}% reply chance)`, engineActive ? 'warn' : 'success');
    });
});

document.getElementById('btnAddBot').addEventListener('click', () => {
    document.getElementById('addBotModal').classList.add('active');
});

document.getElementById('btnCancelBot').addEventListener('click', () => {
    document.getElementById('addBotModal').classList.remove('active');
});

document.getElementById('btnSaveBot').addEventListener('click', () => {
    const username = document.getElementById('botUsername').value.trim();
    const gender = document.getElementById('botGender').value;
    const persona = document.getElementById('botPersona').value.trim();
    const targetRoom = document.getElementById('botAddRoom').value || currentBotRoom;
    if (!username || !persona) return alert('Fill all fields');

    fetchAPI(`/api/admin/bot-engine/${targetRoom}/bots`, {
        method: 'POST',
        body: JSON.stringify({ username, gender, persona })
    }).then(() => {
        document.getElementById('addBotModal').classList.remove('active');
        document.getElementById('botUsername').value = '';
        document.getElementById('botPersona').value = '';
        botLog(`Bot "${username}" added to ${targetRoom}`, 'success');
        loadBotEngine();
    });
});

window.deleteBot = function(id) {
    if (!confirm('Remove this bot?')) return;
    fetchAPI(`/api/admin/bot-engine/bots/${id}`, { method: 'DELETE' }).then(() => {
        botLog('Bot removed.', 'warn');
        loadBotEngine();
    });
};

// ── Edit Bot ──
window.editBot = function(id, username, gender, room, persona) {
    // Pre-fill the edit modal fields
    document.getElementById('editBotId').value = id;
    document.getElementById('editBotUsername').value = username;
    document.getElementById('editBotGender').value = gender;
    document.getElementById('editBotRoom').value = room;

    // Fetch the full persona directly from the server (avoids truncation issue)
    fetchAPI(`/api/admin/bot-engine/${room}/bots`).then(bots => {
        const bot = bots.find(b => b.id === id);
        document.getElementById('editBotPersona').value = bot ? bot.persona : persona;
    });

    document.getElementById('editBotModal').classList.add('active');
};

document.getElementById('btnCancelEditBot').addEventListener('click', () => {
    document.getElementById('editBotModal').classList.remove('active');
});

document.getElementById('btnSaveEditBot').addEventListener('click', () => {
    const id = document.getElementById('editBotId').value;
    const username = document.getElementById('editBotUsername').value.trim();
    const gender = document.getElementById('editBotGender').value;
    const room_slug = document.getElementById('editBotRoom').value;
    const persona = document.getElementById('editBotPersona').value.trim();

    if (!username || !persona) return alert('Fill all fields');

    fetchAPI(`/api/admin/bot-engine/bots/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ username, gender, persona, room_slug })
    }).then(() => {
        document.getElementById('editBotModal').classList.remove('active');
        botLog(`Bot "${username}" updated successfully.`, 'success');
        loadBotEngine();
    }).catch(() => alert('Failed to save bot changes.'));
});

// Page metadata: which key belongs to which page and section, and a SVG wireframe layout hint
const IMAGE_META = {
    // ── Chat Room Pages (shared across all room pages) ──
    panel_couple: {
        page: 'Chat Room Pages', pageIcon: 'fa-comments', pageUrl: 'lounge.html',
        section: 'Forums Section – Left Card',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#1a1a1a" stroke="#333"/>
            <rect x="8" y="8" width="110" height="54" rx="3" fill="#222"/>
            <text x="13" y="20" font-size="6" fill="#888">Confessions</text>
            <text x="13" y="30" font-size="4.5" fill="#666">Lorem ipsum dolor sit amet</text>
            <text x="13" y="39" font-size="4.5" fill="#666">consectetur adipiscing</text>
            <rect x="126" y="8" width="66" height="54" rx="3" fill="#e8760a" opacity="0.3" stroke="#e8760a" stroke-width="1.5"/>
            <text x="141" y="39" font-size="7" fill="#e8760a">IMAGE</text>
        </svg>`
    },
    panel_selfie: {
        page: 'Chat Room Pages', pageIcon: 'fa-comments', pageUrl: 'lounge.html',
        section: 'Forums Section – Right Card',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#1a1a1a" stroke="#333"/>
            <rect x="8" y="8" width="110" height="54" rx="3" fill="#222"/>
            <text x="13" y="20" font-size="6" fill="#888">Trade Nude Selfies</text>
            <text x="13" y="30" font-size="4.5" fill="#666">Lorem ipsum dolor sit amet</text>
            <text x="13" y="39" font-size="4.5" fill="#666">consectetur adipiscing</text>
            <rect x="126" y="8" width="66" height="54" rx="3" fill="#e8760a" opacity="0.3" stroke="#e8760a" stroke-width="1.5"/>
            <text x="141" y="39" font-size="7" fill="#e8760a">IMAGE</text>
        </svg>`
    },
    panel_living_room: {
        page: 'Chat Room Pages', pageIcon: 'fa-comments', pageUrl: 'lounge.html',
        section: 'Blog Card – Chat Rooms FAQ',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#e8760a" opacity="0.15" stroke="#e8760a"/>
            <rect x="8" y="8" width="110" height="54" rx="3" fill="#222"/>
            <text x="13" y="20" font-size="6" fill="#888">Chat Rooms FAQ</text>
            <text x="13" y="30" font-size="4.5" fill="#666">Here is a list of common</text>
            <text x="13" y="38" font-size="4.5" fill="#666">questions and issues.</text>
            <rect x="126" y="8" width="66" height="54" rx="3" fill="#e8760a" opacity="0.3" stroke="#e8760a" stroke-width="1.5"/>
            <text x="141" y="39" font-size="7" fill="#e8760a">IMAGE</text>
        </svg>`
    },
    // ── Homepage ──
    index_selfie_woman: {
        page: 'Homepage (index.html)', pageIcon: 'fa-house', pageUrl: 'index.html',
        section: 'Sex Chat Section – Right Column',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#e8760a" opacity="0.15" stroke="#e8760a"/>
            <rect x="8" y="8" width="100" height="54" rx="3" fill="#222"/>
            <text x="13" y="20" font-size="6" fill="#888">Sex Chat</text>
            <text x="13" y="30" font-size="4.5" fill="#666">After connecting to the online</text>
            <text x="13" y="38" font-size="4.5" fill="#666">chat app, you'll be presented</text>
            <text x="13" y="46" font-size="4.5" fill="#666">with a list of chat rooms...</text>
            <rect x="116" y="8" width="76" height="54" rx="3" fill="#e8760a" opacity="0.3" stroke="#e8760a" stroke-width="1.5"/>
            <text x="131" y="39" font-size="7" fill="#e8760a">IMAGE</text>
        </svg>`
    },
    index_lesbian_couple: {
        page: 'Homepage (index.html)', pageIcon: 'fa-house', pageUrl: 'index.html',
        section: 'Info Cards – Lesbian Chat Card',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#1a1a1a" stroke="#333"/>
            <rect x="8" y="8" width="55" height="54" rx="3" fill="#222" stroke="#333"/>
            <text x="12" y="20" font-size="4.5" fill="#888">Lesbian Chat Card</text>
            <rect x="72" y="8" width="55" height="54" rx="3" fill="#222" stroke="#555"/>
            <rect x="136" y="8" width="55" height="54" rx="3" fill="#222" stroke="#333"/>
            <rect x="22" y="38" width="30" height="24" rx="2" fill="#e8760a" opacity="0.35" stroke="#e8760a" stroke-width="1.5"/>
            <text x="26" y="52" font-size="5" fill="#e8760a">IMG</text>
        </svg>`
    },
    index_gay_men: {
        page: 'Homepage (index.html)', pageIcon: 'fa-house', pageUrl: 'index.html',
        section: 'Info Cards – Gay Chat Card',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#1a1a1a" stroke="#333"/>
            <rect x="8" y="8" width="55" height="54" rx="3" fill="#222" stroke="#333"/>
            <rect x="72" y="8" width="55" height="54" rx="3" fill="#222" stroke="#555"/>
            <text x="76" y="20" font-size="4.5" fill="#888">Gay Chat Card</text>
            <rect x="136" y="8" width="55" height="54" rx="3" fill="#222" stroke="#333"/>
            <rect x="86" y="38" width="30" height="24" rx="2" fill="#e8760a" opacity="0.35" stroke="#e8760a" stroke-width="1.5"/>
            <text x="90" y="52" font-size="5" fill="#e8760a">IMG</text>
        </svg>`
    },
    index_adult_chat: {
        page: 'Homepage (index.html)', pageIcon: 'fa-house', pageUrl: 'index.html',
        section: 'Adult Sex Chat Section – Left Column',
        wireframe: `<svg width="100%" height="70" viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="66" rx="4" fill="#e8760a" opacity="0.15" stroke="#e8760a"/>
            <rect x="8" y="8" width="76" height="54" rx="3" fill="#e8760a" opacity="0.3" stroke="#e8760a" stroke-width="1.5"/>
            <text x="23" y="39" font-size="7" fill="#e8760a">IMAGE</text>
            <rect x="92" y="8" width="100" height="54" rx="3" fill="#222"/>
            <text x="97" y="20" font-size="6" fill="#888">Adult Sex Chat</text>
            <text x="97" y="30" font-size="4.5" fill="#666">One of the many perks from</text>
            <text x="97" y="38" font-size="4.5" fill="#666">online chat is the anonymous</text>
            <text x="97" y="46" font-size="4.5" fill="#666">aspect...</text>
        </svg>`
    },
};

window.loadImages = function() {
    fetchAPI('/api/admin/images').then(images => {
        const list = document.getElementById('imagesList');
        if (!list) return;
        if (images.length === 0) {
            list.innerHTML = '<p style="color:#888;">No images found in database.</p>';
            return;
        }

        // Group images by page
        const groups = {};
        images.forEach(img => {
            const meta = IMAGE_META[img.image_key] || { page: 'Other', pageIcon: 'fa-image', pageUrl: '#', section: img.image_key };
            if (!groups[meta.page]) groups[meta.page] = { icon: meta.pageIcon, url: meta.pageUrl, items: [] };
            groups[meta.page].items.push({ ...img, meta });
        });

        list.innerHTML = Object.entries(groups).map(([pageName, group]) => `
            <div style="margin-bottom: 28px;">
                <!-- Page Header -->
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #333;">
                    <div style="width:34px; height:34px; background:rgba(232,118,10,0.15); border:1px solid rgba(232,118,10,0.4); border-radius:8px; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid ${group.icon}" style="color:#e8760a; font-size:15px;"></i>
                    </div>
                    <div>
                        <div style="font-size:16px; font-weight:700; color:#fff;">${pageName}</div>
                        <a href="${group.url}" target="_blank" style="font-size:11px; color:#e8760a; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:9px;"></i> Open Page</a>
                    </div>
                    <div style="margin-left:auto; background:#333; color:#aaa; font-size:11px; padding:3px 10px; border-radius:20px;">${group.items.length} image${group.items.length > 1 ? 's' : ''}</div>
                </div>

                <!-- Image Cards -->
                <div style="display:flex; flex-direction:column; gap:14px;">
                    ${group.items.map(img => `
                    <div style="display:grid; grid-template-columns:200px 1fr; gap:16px; background:#111; border:1px solid #2a2a2a; border-radius:10px; overflow:hidden;">
                        
                        <!-- Left: Wireframe + Location label -->
                        <div style="background:#161616; padding:12px; display:flex; flex-direction:column; gap:8px; border-right:1px solid #2a2a2a;">
                            <div style="font-size:10px; font-weight:700; color:#e8760a; text-transform:uppercase; letter-spacing:0.5px;">Location</div>
                            <div style="font-size:11px; color:#ccc; line-height:1.4;">${img.meta.section}</div>
                            <div style="margin-top:4px; border:1px solid #333; border-radius:4px; overflow:hidden;">
                                ${img.meta.wireframe || ''}
                            </div>
                        </div>

                        <!-- Right: Preview + URL Editor -->
                        <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
                            <div style="display:flex; gap:12px; align-items:center;">
                                <img src="${img.url}" style="width:72px; height:72px; object-fit:cover; border-radius:8px; border:2px solid #333; flex-shrink:0;" onerror="this.style.background='#333'; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\'/%3E'">
                                <div>
                                    <div style="font-weight:700; color:#fff; font-size:14px;">${img.description || img.image_key}</div>
                                    <div style="font-size:11px; color:#555; margin-top:3px; font-family:monospace;">${img.image_key}</div>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <input type="text" id="img_${img.image_key}" value="${img.url}" placeholder="Paste new image URL here..."
                                    style="flex:1; padding:9px 12px; background:#1a1a1a; color:#fff; border:1px solid #3a3a3a; border-radius:6px; font-size:12px;">
                                <button onclick="updateImage('${img.image_key}')" style="background:#e8760a; color:#fff; border:none; padding:9px 16px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; white-space:nowrap;">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <button onclick="viewImageHistory('${img.image_key}')" style="background:#1e1e1e; color:#aaa; border:1px solid #444; padding:9px 12px; border-radius:6px; cursor:pointer; font-size:12px;" title="View history">
                                    <i class="fa-solid fa-clock-rotate-left"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    });
};


window.updateImage = function(key) {
    const url = document.getElementById(`img_${key}`).value.trim();
    if (!url) return alert('URL cannot be empty');

    fetchAPI(`/api/admin/images/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ url })
    }).then(() => {
        alert('Image updated successfully!');
        loadImages();
    }).catch(err => alert('Failed to update image: ' + err));
};

window.viewImageHistory = function(key) {
    fetchAPI(`/api/admin/images/${key}/history`).then(history => {
        const list = document.getElementById('historyList');
        const modal = document.getElementById('historyModal');
        
        if (history.length === 0) {
            list.innerHTML = '<p style="color:#888; text-align:center;">No history found for this image.</p>';
        } else {
            list.innerHTML = history.map(h => `
                <div style="background:#1a1a1a; padding:10px; border-radius:6px; border:1px solid #333; font-size:12px;">
                    <div style="color:#aaa; margin-bottom:5px;">Date: ${new Date(h.created_at).toLocaleString()}</div>
                    <div style="word-break: break-all; color:#ccc;">${h.url}</div>
                    <div style="margin-top:8px;">
                        <button onclick="document.getElementById('img_${key}').value='${h.url}'; document.getElementById('historyModal').style.display='none';" style="background:#e8760a; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Restore This</button>
                    </div>
                </div>
            `).join('');
        }
        
        modal.style.display = 'flex';
    });
};

// Init — only load the default active tab (Users)
loadedTabs.add('tab-users');
loadUsers();
