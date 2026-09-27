import os
import re
import sys

FONTAWESOME_LINK = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n    <link rel="stylesheet" href="styles.css">'

REPLACEMENTS = {
    '🏠': '<i class="fa-solid fa-house"></i>',
    '💬': '<i class="fa-solid fa-comments"></i>',
    '📝': '<i class="fa-solid fa-pen-to-square"></i>',
    '📹': '<i class="fa-solid fa-video"></i>',
    '🔥': '<i class="fa-solid fa-fire"></i>',
    '🔒': '<i class="fa-solid fa-lock"></i>',
    '🔞': '<i class="fa-solid fa-ban"></i>',
    '👩': '<i class="fa-solid fa-user"></i>',
    '👨': '<i class="fa-solid fa-user"></i>',
    '⚙️': '<i class="fa-solid fa-gear"></i>',
    '🤖': '<i class="fa-solid fa-robot"></i>',
    '📊': '<i class="fa-solid fa-chart-simple"></i>',
    '🚀': '<i class="fa-solid fa-rocket"></i>',
    '👑': '<i class="fa-solid fa-crown"></i>'
}

for filename in os.listdir('.'):
    if filename.endswith('.html'):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Replace emojis
        for emoji, icon in REPLACEMENTS.items():
            content = content.replace(emoji, icon)
            
        # Add FontAwesome CDN if not present
        if 'font-awesome' not in content and 'fa-solid' in content:
            content = content.replace('<link rel="stylesheet" href="styles.css">', FONTAWESOME_LINK)
            
        if content != original_content:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filename}")
