import os
import glob

frontend_dir = r"c:\Users\antri\OneDrive\Desktop\txt room chat\frontend"
files = glob.glob(os.path.join(frontend_dir, "*.html")) + glob.glob(os.path.join(frontend_dir, "*.js"))

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "sessionStorage" in content:
        new_content = content.replace("sessionStorage", "localStorage")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(filepath)}")
