const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'chat.sqlite'));

db.all('SELECT id, username, role, created_at FROM users', [], (err, rows) => {
    if (err) { console.error(err); return; }
    console.log('\n=== REGISTERED USERS IN DATABASE ===');
    rows.forEach(r => console.log(`  ID:${r.id}  username:${r.username}  role:${r.role}  created:${r.created_at}`));
    console.log(`\nTotal: ${rows.length} user(s)`);
    db.close();
});
