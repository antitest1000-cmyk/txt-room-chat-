document.addEventListener("DOMContentLoaded", () => {
    // 1. Hamburger Menu Logic
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideNav = document.getElementById('sideNav');
    const sideNavOverlay = document.getElementById('sideNavOverlay');
    const sideNavCloseBtn = document.getElementById('sideNavCloseBtn');

    function openNav() {
        if(sideNav) sideNav.classList.add('open');
        if(sideNavOverlay) sideNavOverlay.classList.add('open');
    }

    function closeNav() {
        if(sideNav) sideNav.classList.remove('open');
        if(sideNavOverlay) sideNavOverlay.classList.remove('open');
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openNav);
    if (sideNavCloseBtn) sideNavCloseBtn.addEventListener('click', closeNav);
    if (sideNavOverlay) sideNavOverlay.addEventListener('click', closeNav);

    // 2. Cookie Banner Logic
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookiesBtn = document.getElementById('acceptCookiesBtn');

    if (cookieBanner && acceptCookiesBtn) {
        if (!localStorage.getItem('cookiesAccepted')) {
            setTimeout(() => {
                cookieBanner.classList.add('show');
            }, 1000);
        }

        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            cookieBanner.classList.remove('show');
        });
    }

    // 3. Theme Switcher Logic
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        // Check saved preference
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-mode');
            themeSwitch.checked = false; // Checkbox unchecked means light mode
        } else {
            document.body.classList.remove('light-mode');
            themeSwitch.checked = true; // Checked means dark mode
        }

        themeSwitch.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.remove('light-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // 4. Dynamic Website Images Manager
    const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://txt-room-chat.onrender.com';
    fetch(SERVER_URL + '/api/images')
        .then(res => res.json())
        .then(imageMap => {
            const images = document.querySelectorAll('img[data-image-key]');
            images.forEach(img => {
                const key = img.getAttribute('data-image-key');
                if (imageMap[key]) {
                    img.src = imageMap[key];
                }
            });
        })
        .catch(err => console.error('Failed to load dynamic images:', err));

    // 5. Global Login / Logout Button in Top Nav
    const topBar = document.querySelector('.top-bar');
    if (topBar && !window.location.pathname.includes('chat.html') && !window.location.pathname.includes('cam-room.html')) {
        const toggleSwitch = topBar.querySelector('.toggle-switch');
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || localStorage.getItem('cm_token');
        
        const rightContainer = document.createElement('div');
        rightContainer.style.cssText = 'display:flex; align-items:center; gap: 20px;';
        
        const authDiv = document.createElement('div');
        authDiv.style.cssText = 'color: inherit; display:flex; align-items:center;';
        
        if (isLoggedIn) {
            const username = localStorage.getItem('cm_username') || 'User';
            authDiv.innerHTML = `
                <span style="font-size: 14px; font-weight:600; margin-right:12px;">Hi, ${username}</span>
                <button id="globalLogoutBtn" style="background:transparent; border:1px solid currentColor; color:inherit; padding:4px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:13px;">Logout</button>
            `;
            rightContainer.appendChild(authDiv);
            if (toggleSwitch) rightContainer.appendChild(toggleSwitch);
            
            topBar.appendChild(rightContainer);
            
            document.getElementById('globalLogoutBtn').addEventListener('click', () => {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('cm_token');
                localStorage.removeItem('cm_username');
                localStorage.removeItem('cm_isGuest');
                window.location.reload();
            });
        } else {
            authDiv.innerHTML = `
                <a href="login.html" style="text-decoration:none; font-size:14px; font-weight:bold; padding:4px 12px; border:1px solid currentColor; color:inherit; border-radius:4px;">Login</a>
            `;
            rightContainer.appendChild(authDiv);
            if (toggleSwitch) rightContainer.appendChild(toggleSwitch);
            
            topBar.appendChild(rightContainer);
        }
    }
});
