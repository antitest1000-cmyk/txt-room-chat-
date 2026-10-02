const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend');

function addFavicon(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if favicon is already there
    if (content.includes('rel="icon"')) {
        console.log('Favicon already exists in ' + filePath);
        return;
    }
    
    // Insert favicon before </head>
    const faviconTag = '\n    <link rel="icon" type="image/png" href="/favicon.png">\n';
    
    if (content.includes('</head>')) {
        content = content.replace('</head>', faviconTag + '</head>');
        fs.writeFileSync(filePath, content);
        console.log('Added favicon to ' + filePath);
    }
}

fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.html')) {
        addFavicon(path.join(dir, file));
    }
});
