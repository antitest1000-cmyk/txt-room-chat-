const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error(err.message); process.exit(1); }

    const newImages = [
        { key: 'index_selfie_woman',   url: 'https://thumbs.dreamstime.com/b/asian-woman-girl-beach-taking-selfie-photograph-young-bikini-vacation-59331837.jpg', description: 'Homepage - Sex Chat Section (Woman Selfie)' },
        { key: 'index_lesbian_couple', url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=150&auto=format&fit=crop',                              description: 'Homepage - Lesbian Chat Card' },
        { key: 'index_gay_men',        url: 'https://images.unsplash.com/photo-1549490349-8643362247b5?w=150&auto=format&fit=crop',                              description: 'Homepage - Gay Chat Card' },
        { key: 'index_adult_chat',     url: 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=500&auto=format&fit=crop',                            description: 'Homepage - Adult Sex Chat Section' },
    ];

    let done = 0;
    for (const img of newImages) {
        db.run(
            `INSERT OR IGNORE INTO site_images (image_key, url, description) VALUES (?, ?, ?)`,
            [img.key, img.url, img.description],
            function(err) {
                if (err) console.error('Error:', err.message);
                else console.log('Seeded:', img.key, '(rows changed:', this.changes, ')');
                done++;
                if (done === newImages.length) {
                    console.log('All done!');
                    db.close();
                }
            }
        );
    }
});
