import os
import glob

files = glob.glob('*.html')

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    updated = False
    if '<a href="#">Safety</a>' in content:
        content = content.replace('<a href="#">Safety</a>', '<a href="safety.html">Safety</a>')
        updated = True
    if '<a href="#">Rules</a>' in content:
        content = content.replace('<a href="#">Rules</a>', '<a href="rules.html">Rules</a>')
        updated = True
        
    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
