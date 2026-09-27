import os
import glob

search_text_1 = """            <div class="footer-col">
                <h4>IFC</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="#">Home</a></li>
                    <li><a href="#">Chat</a></li>
                    <li><a href="#">Blog</a></li>
                    <li><a href="#">Forum</a></li>
                </ul>
            </div>"""

replace_text_1 = """            <div class="footer-col">
                <h4>IFC</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="rooms.html">Chat</a></li>
                    <li><a href="blog.html">Blog</a></li>
                    <li><a href="forum.html">Forum</a></li>
                </ul>
            </div>"""

search_text_2 = """            <div class="footer-col">
                <h4>Get Involved</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="#">Banned</a></li>
                    <li><a href="#">Moderate</a></li>
                    <li><a href="#">Feedback</a></li>
                    <li><a href="#">Help</a></li>
                </ul>
            </div>"""

replace_text_2 = """            <div class="footer-col">
                <h4>Get Involved</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="banned.html">Banned</a></li>
                    <li><a href="moderate.html">Moderate</a></li>
                    <li><a href="contact.html">Feedback</a></li>
                    <li><a href="faq.html">Help</a></li>
                </ul>
            </div>"""

html_files = glob.glob('*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    changed = False
    if search_text_1 in content:
        content = content.replace(search_text_1, replace_text_1)
        changed = True
        
    if search_text_2 in content:
        content = content.replace(search_text_2, replace_text_2)
        changed = True
        
    if changed:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
