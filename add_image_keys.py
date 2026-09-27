import os
import glob
import re

images_map = {
    'https://images.unsplash.com/photo-1574296996656-783517c5b367?w=200&auto=format&fit=crop': 'panel_couple',
    'https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=200&auto=format&fit=crop': 'panel_selfie',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&auto=format&fit=crop': 'panel_living_room'
}

html_files = glob.glob('*.html')
for file in html_files:
    if file == 'owner-panel.html' or file == 'database.html':
        continue
        
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    
    # We will look for <img src="..." and inject data-image-key="..."
    for url, key in images_map.items():
        # Match <img src="URL"
        pattern = f'(<img[^>]*src="{re.escape(url)}")'
        # Check if already has data-image-key
        if url in content and f'data-image-key="{key}"' not in content:
            content = re.sub(pattern, r'\1 data-image-key="' + key + '"', content)
            modified = True
            
    if modified:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Added data-image-keys to {file}")
