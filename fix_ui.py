import os
import re

SIDEBAR_HTML = """
    <!-- Cookie Consent Banner -->
    <div id="cookie-banner">
        <div class="cookie-text">
            We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept", you consent to our use of cookies.
        </div>
        <button class="cookie-btn" id="acceptCookiesBtn">Accept</button>
    </div>

    <!-- Side Navigation -->
    <div class="side-nav-overlay" id="sideNavOverlay"></div>
    <div class="side-nav" id="sideNav">
        <div class="side-nav-header">
            <button class="side-nav-close" id="sideNavCloseBtn">✕</button>
        </div>
        <ul class="side-nav-menu">
            <li>
                <a href="index.html">
                    <span class="side-nav-icon">🏠</span>
                    <div class="side-nav-text">
                        <span class="side-nav-title">Home</span>
                        <span class="side-nav-desc">Back to the front page</span>
                    </div>
                </a>
            </li>
            <li>
                <a href="rooms.html">
                    <span class="side-nav-icon">💬</span>
                    <div class="side-nav-text">
                        <span class="side-nav-title">Chat</span>
                        <span class="side-nav-desc">Full list of chat rooms</span>
                    </div>
                </a>
            </li>
            <li>
                <a href="blog.html">
                    <span class="side-nav-icon">📝</span>
                    <div class="side-nav-text">
                        <span class="side-nav-title">Blog</span>
                        <span class="side-nav-desc">Updates about the chat rooms</span>
                    </div>
                </a>
            </li>
            <li>
                <a href="cam-chat.html">
                    <span class="side-nav-icon">📹</span>
                    <div class="side-nav-text">
                        <span class="side-nav-title">Live Cams</span>
                        <span class="side-nav-desc">Watch & broadcast live webcams</span>
                    </div>
                </a>
            </li>
        </ul>
    </div>
"""

directory = "."
for filename in os.listdir(directory):
    if filename.endswith(".html"):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Add id="hamburgerBtn" to menu button if missing
        content = re.sub(r'<button class="menu-btn"(?! id="hamburgerBtn")>', r'<button class="menu-btn" id="hamburgerBtn">', content)
        
        # 2. Inject sidebar if not exists
        if 'id="sideNav"' not in content and filename != 'bot-manager.html':
            # Find the top-nav and insert before it
            if '<nav class="top-bar">' in content:
                content = content.replace('<nav class="top-bar">', SIDEBAR_HTML + '\n    <nav class="top-bar">')

        # 3. Add script tag at the end before </body>
        if 'common.js' not in content and filename != 'bot-manager.html':
            content = content.replace('</body>', '    <script src="common.js"></script>\n</body>')
            
        # 4. Remove inline script in index.html related to nav and cookies to avoid duplicates
        if filename == 'index.html':
            # Just let it be or replace it. It's easier to remove the explicit code block.
            # I will manually edit index.html later or just leave it since common.js protects itself.
            pass

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {filename}")
