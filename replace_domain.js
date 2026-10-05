const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'frontend/sitemap.xml',
    'frontend/robots.txt'
];

const oldDomain = 'https://txt-room-chat.antitest1000.workers.dev';
const newDomain = 'https://caughtme.fun';

filesToUpdate.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.split(oldDomain).join(newDomain);
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + f);
    } else {
        console.log('File not found: ' + f);
    }
});
