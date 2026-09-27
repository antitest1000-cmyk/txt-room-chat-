import os
import glob

repl_str = "const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://YOUR_RENDER_URL.onrender.com';"

def fix_files():
    for ext in ['*.html', '*.js']:
        for filepath in glob.glob(ext):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            modified = False
            
            if "const SERVER_URL = 'http://localhost:3000';" in content:
                content = content.replace("const SERVER_URL = 'http://localhost:3000';", repl_str)
                modified = True
                
            if "fetch('http://localhost:3000/api/images')" in content:
                content = content.replace("fetch('http://localhost:3000/api/images')", repl_str + "\n    fetch(SERVER_URL + '/api/images')")
                modified = True
                
            if modified:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {filepath}")

fix_files()
