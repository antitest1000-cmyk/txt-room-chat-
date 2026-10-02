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
        content = content.replace(/function getMsgAvatar\(uname\) \{[\s\S]*?return `https:\/\/avatar\.iran\.liara\.run\/public.*?`.*?}/, `function getMsgAvatar(uname) {
        let u = usersData.find(x => x.username === uname);
        let g = u ? (u.gender === "Female" ? "women" : "men") : "men";
        let num = (String(uname).split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 90 + 1;
        return \`https://randomuser.me/api/portraits/\${g}/\${num}.jpg\`;
    }`);
    }

    // Dynamic gender
    content = content.replace(/https:\/\/avatar\.iran\.liara\.run\/public\/\$\{(.*?)\}\?username=\$\{encodeURIComponent\((.*?)\)\}/g, 
        "https://randomuser.me/api/portraits/${$1 === 'girl' ? 'women' : 'men'}/${(String($2).split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 90 + 1}.jpg");

    // Static girl
    content = content.replace(/https:\/\/avatar\.iran\.liara\.run\/public\/girl\?username=\$\{encodeURIComponent\((.*?)\)\}/g, 
        "https://randomuser.me/api/portraits/women/${(String($1).split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 90 + 1}.jpg");

    // Static boy
    content = content.replace(/https:\/\/avatar\.iran\.liara\.run\/public\/boy\?username=\$\{encodeURIComponent\((.*?)\)\}/g, 
        "https://randomuser.me/api/portraits/men/${(String($1).split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 90 + 1}.jpg");

    // Operator
    content = content.replace(/https:\/\/avatar\.iran\.liara\.run\/public\/girl\?username=operator/g, 
        "https://randomuser.me/api/portraits/women/44.jpg");

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
