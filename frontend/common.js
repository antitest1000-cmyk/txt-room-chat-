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

    // 2. Cookie Banner Logic (Disabled by user request)
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookiesBtn = document.getElementById('acceptCookiesBtn');

    if (cookieBanner && acceptCookiesBtn) {
        /*
        if (!localStorage.getItem('cookiesAccepted')) {
            setTimeout(() => {
                cookieBanner.classList.add('show');
                
                // Auto-hide after 3 seconds on mobile
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        cookieBanner.classList.remove('show');
                        localStorage.setItem('cookiesAccepted', 'true');
                    }, 3000);
                }
            }, 1000);
        }

        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            cookieBanner.classList.remove('show');
        });
        */
        // Force hide just in case
        cookieBanner.style.display = 'none';
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
    const isChatRoomPage = document.getElementById('userMenuBtn') !== null || document.querySelector('.cam-layout') !== null;
    if (topBar && !isChatRoomPage) {
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

    // 6. Time Tracking and Rewards (Chat & Cam Rooms only)
    if (window.location.pathname.includes('chat.html') || window.location.pathname.includes('cam-room.html')) {
        let timeSpent = parseInt(localStorage.getItem('cm_time_spent') || '0');
        
        // Milestones in seconds
        const MILESTONES = [
            { time: 300, name: 'Bronze Chatter (5 Mins)', gift: '🥉 Bronze Badge' },
            { time: 1800, name: 'Silver Chatter (30 Mins)', gift: '🥈 Silver Badge & VIP Star' },
            { time: 3600, name: 'Gold Chatter (1 Hour)', gift: '🥇 Gold Crown' },
            { time: 7200, name: 'Diamond Chatter (2 Hours)', gift: '💎 Diamond Ring' }
        ];

        let nextMilestoneIdx = MILESTONES.findIndex(m => m.time > timeSpent);
        if (nextMilestoneIdx === -1) nextMilestoneIdx = MILESTONES.length;

        setInterval(() => {
            if (document.visibilityState === 'visible') {
                timeSpent++;
                localStorage.setItem('cm_time_spent', timeSpent.toString());

                if (nextMilestoneIdx < MILESTONES.length && timeSpent >= MILESTONES[nextMilestoneIdx].time) {
                    const milestone = MILESTONES[nextMilestoneIdx];
                    showRewardPopup(milestone);
                    nextMilestoneIdx++;
                }
            }
        }, 1000);

        function showRewardPopup(milestone) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
            overlay.innerHTML = `
                <div style="background:#1a1a1a; border:2px solid #e8760a; border-radius:16px; padding:32px; max-width:400px; text-align:center; box-shadow: 0 10px 40px rgba(232, 118, 10, 0.4); animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="font-size:64px; margin-bottom:16px; animation: bounce 2s infinite;">🎁</div>
                    <h2 style="color:#e8760a; margin-bottom:12px; margin-top:0; font-family:sans-serif;">Milestone Reached!</h2>
                    <p style="color:#ddd; margin-bottom:16px; font-size:16px; font-family:sans-serif;">You have unlocked the <strong>${milestone.name}</strong> reward!</p>
                    <div style="font-size:32px; padding:16px; background:#2a2a2a; border-radius:12px; margin-bottom:24px; border:1px dashed #555;">
                        ${milestone.gift}
                    </div>
                    <button onclick="this.closest('[style*=position]').remove()" style="background:#e8760a; color:#fff; border:none; padding:12px 32px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer;">Claim Reward</button>
                </div>
            `;
            if (!document.getElementById('rewardStyles')) {
                const style = document.createElement('style');
                style.id = 'rewardStyles';
                style.innerHTML = `
                    @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                    @keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(-20px);} 60% {transform: translateY(-10px);} }
                `;
                document.head.appendChild(style);
            }
            document.body.appendChild(overlay);
        }
    }
});
