const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'frontend/chat.html',
    'frontend/cam-room.html',
    'frontend/bot-manager.html',
    'frontend/owner-panel.js'
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (filePath.endsWith('chat.html')) {
        // Add getMsgAvatar function
        if (!content.includes('function getMsgAvatar')) {
            content = content.replace('let usersData = [];', 'let usersData = [];\n    function getMsgAvatar(uname) {\n        let u = usersData.find(x => x.username === uname);\n        let g = u ? (u.gender === "Female" ? "girl" : "boy") : "boy";\n        return `https://avatar.iran.liara.run/public/${g}?username=${encodeURIComponent(uname)}`;\n    }');
        }
        
        // Replace in new_message
        content = content.replace(/'<img src="https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=' \+ encodeURIComponent\(msg\.username\) \+ '"/g, 
            "'<img src=\"' + getMsgAvatar(msg.username) + '\"'");
            
        // Replace in user list
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(u\.username\)\}/g, 
            "https://avatar.iran.liara.run/public/${u.gender === 'Female' ? 'girl' : 'boy'}?username=${encodeURIComponent(u.username)}");

        // Replace operator
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=operator/g, 
            "https://avatar.iran.liara.run/public/girl?username=operator");

        // Replace self avatar
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(p\.username\)\}/g, 
            "https://avatar.iran.liara.run/public/${p.gender === 'Female' ? 'girl' : 'boy'}?username=${encodeURIComponent(p.username)}");
            
        // Raw username self avatar
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(rawUsername\)\}/g, 
            "https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(rawUsername)}");

        // generic fallback
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(name\)\}/g, 
            "https://avatar.iran.liara.run/public/girl?username=${encodeURIComponent(name)}");
            
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(username\)\}/g, 
            "https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(username)}");
    }

    if (filePath.endsWith('cam-room.html')) {
        // all bots are female here
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(name\)\}/g, 
            "https://avatar.iran.liara.run/public/girl?username=${encodeURIComponent(name)}");
            
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(username\)\}/g, 
            "https://avatar.iran.liara.run/public/girl?username=${encodeURIComponent(username)}");
    }

    if (filePath.endsWith('bot-manager.html')) {
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{bot\.username\}/g, 
            "https://avatar.iran.liara.run/public/${bot.gender === 'Female' ? 'girl' : 'boy'}?username=${encodeURIComponent(bot.username)}");
    }

    if (filePath.endsWith('owner-panel.js')) {
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(user\.username\)\}/g, 
            "https://avatar.iran.liara.run/public/${user.gender === 'Female' ? 'girl' : 'boy'}?username=${encodeURIComponent(user.username)}");
            
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(g\.username\)\}/g, 
            "https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(g.username)}");
            
        content = content.replace(/https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{encodeURIComponent\(bot\.username\)\}/g, 
            "https://avatar.iran.liara.run/public/${bot.gender === 'Female' ? 'girl' : 'boy'}?username=${encodeURIComponent(bot.username)}");
    }

    fs.writeFileSync(filePath, content);
    console.log('Updated ' + filePath);
}

filesToUpdate.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        processFile(fullPath);
    } else {
        console.log("File not found: " + fullPath);
    }
});
