import os
import glob

search_text = """                <h4>Legal</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="#">Copyright</a></li>
                    <li><a href="#">2257</a></li>
                    <li><a href="#">Terms of Use</a></li>
                    <li><a href="#">DMCA</a></li>
                    <li><a href="#">Privacy</a></li>
                </ul>"""

replace_text = """                <h4>Legal</h4>
                <div class="footer-divider"></div>
                <ul>
                    <li><a href="dmca.html">Copyright</a></li>
                    <li><a href="2257.html">2257</a></li>
                    <li><a href="terms.html">Terms of Use</a></li>
                    <li><a href="dmca.html">DMCA</a></li>
                    <li><a href="privacy.html">Privacy</a></li>
                </ul>"""

html_files = glob.glob('*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if search_text in content:
        content = content.replace(search_text, replace_text)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
