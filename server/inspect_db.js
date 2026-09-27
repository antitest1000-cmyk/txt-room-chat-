const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.sqlite');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    console.log('=== ALL TABLES ===');
    tables.forEach(t => console.log(' ', t.name));
    
    // Check messages table if it exists
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'", [], (err, rows) => {
        if (rows.length > 0) {
            db.all("SELECT DISTINCT username FROM messages LIMIT 30", [], (err, users) => {
                console.log('\n=== UNIQUE CHAT USERS (from messages) ===');
                users.forEach(u => console.log('  ', u.username));
                db.close();
            });
        } else {
            // Try chat_messages or participants
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, allTables) => {
                allTables.forEach(t => {
                    db.all(`PRAGMA table_info(${t.name})`, [], (err, cols) => {
                        console.log(`\nTable: ${t.name} => columns:`, cols.map(c => c.name).join(', '));
                    });
                });
                setTimeout(() => db.close(), 1000);
            });
        }
    });
});
