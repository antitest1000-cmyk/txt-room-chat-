const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'chat.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDB();
    }
});

function initDB() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'NORMAL' -- 'OWNER', 'PERSONA_OPERATOR', 'NORMAL'
        )`);

        // Rooms Table
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE,
            name TEXT
        )`);

        // Personas Table
        db.run(`CREATE TABLE IF NOT EXISTS personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            gender TEXT,
            room_slug TEXT,
            avatar_seed TEXT
        )`);

        // Persona Assignments Table (operator_id -> persona_id)
        db.run(`CREATE TABLE IF NOT EXISTS persona_assignments (
            operator_id INTEGER,
            persona_id INTEGER,
            FOREIGN KEY(operator_id) REFERENCES users(id),
            FOREIGN KEY(persona_id) REFERENCES personas(id),
            PRIMARY KEY (operator_id, persona_id)
        )`);

        // Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT,
            operator_id INTEGER, -- Null if sent by normal user
            persona_id INTEGER, -- Null if sent by normal user
            username TEXT, -- Display name (persona name or normal username)
            content TEXT,
            media_url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Room Moderation Table
        db.run(`CREATE TABLE IF NOT EXISTS room_moderation (
            room_slug TEXT PRIMARY KEY,
            banned_words TEXT DEFAULT '',
            strict_mode INTEGER DEFAULT 0
        )`);

        // Engine Bots Table (Backend AI Bots)
        db.run(`CREATE TABLE IF NOT EXISTS engine_bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT,
            username TEXT,
            gender TEXT,
            persona TEXT
        )`);

        // Site Images Config Table
        db.run(`CREATE TABLE IF NOT EXISTS site_images (
            image_key TEXT PRIMARY KEY,
            url TEXT,
            description TEXT
        )`);

        // Site Images History Table
        db.run(`CREATE TABLE IF NOT EXISTS site_images_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_key TEXT,
            url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed initial Owner account if no users exist
        db.get('SELECT count(*) as count FROM users', (err, row) => {
            if (row.count === 0) {
                const defaultOwnerPassword = 'admin'; // Hardcoded for initial setup
                const hash = bcrypt.hashSync(defaultOwnerPassword, 10);
                db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['Admin', hash, 'OWNER']);
                console.log('Created default OWNER account: Admin / admin');
            }
        });

        // Seed initial rooms
        db.get('SELECT count(*) as count FROM rooms', (err, row) => {
            if (row.count === 0) {
                const rooms = [
                    { slug: 'lounge-chat', name: 'Lounge Chat' },
                    { slug: 'sex-chat', name: 'Sex Chat' },
                    { slug: 'roleplay-chat', name: 'RolePlay Chat' },
                    { slug: 'lesbian-chat', name: 'Lesbian Chat' },
                    { slug: 'gay-chat', name: 'Gay Chat' },
                    { slug: 'bdsm-chat', name: 'BDSM Chat' },
                    { slug: 'confessions-chat', name: 'Confessions' },
                    { slug: 'younger4older-chat', name: 'Younger4Older' }
                ];
                const stmt = db.prepare('INSERT INTO rooms (slug, name) VALUES (?, ?)');
                rooms.forEach(r => stmt.run(r.slug, r.name));
                stmt.finalize();
                console.log('Seeded initial rooms');
            }
        });

        // Seed initial site images
        db.get('SELECT count(*) as count FROM site_images', (err, row) => {
            if (row.count === 0) {
                const images = [
                    { key: 'panel_couple', url: 'https://images.unsplash.com/photo-1574296996656-783517c5b367?w=200&auto=format&fit=crop', desc: 'Panel: Couple Image' },
                    { key: 'panel_selfie', url: 'https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=200&auto=format&fit=crop', desc: 'Panel: Selfie Image' },
                    { key: 'panel_living_room', url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&auto=format&fit=crop', desc: 'Panel: Living Room Image' }
                ];
                const stmt = db.prepare('INSERT INTO site_images (image_key, url, description) VALUES (?, ?, ?)');
                images.forEach(img => stmt.run(img.key, img.url, img.desc));
                stmt.finalize();
                console.log('Seeded initial site images');
            }
        });
    });
}

module.exports = db;
