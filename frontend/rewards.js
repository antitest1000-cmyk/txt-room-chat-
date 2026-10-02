// rewards.js
// Handles tracking user time and unlocking milestone rewards

const MILESTONES = [
    { time: 60, id: 'm_1m', name: "Curious Explorer", icon: "🌱", color: "#4caf50", desc: "Spent 1 minute in chat rooms" },
    { time: 300, id: 'm_5m', name: "Active Chatter", icon: "🥉", color: "#cd7f32", desc: "Spent 5 minutes in chat rooms" },
    { time: 900, id: 'm_15m', name: "Conversationalist", icon: "🥈", color: "#c0c0c0", desc: "Spent 15 minutes in chat rooms" },
    { time: 1800, id: 'm_30m', name: "Room Veteran", icon: "🥇", color: "#ffd700", desc: "Spent 30 minutes in chat rooms" },
    { time: 3600, id: 'm_60m', name: "Caught Me Legend", icon: "💎", color: "#00ffff", desc: "Spent 1 hour in chat rooms" },
    { time: 7200, id: 'm_120m', name: "No Life", icon: "👑", color: "#ff00ff", desc: "Spent 2 hours in chat rooms" }
];

let sessionTimer = null;
let timeSpent = parseInt(localStorage.getItem('caughtMe_timeSpent') || '0');
let unlockedRewards = JSON.parse(localStorage.getItem('caughtMe_rewards') || '[]');

function saveRewards() {
    localStorage.setItem('caughtMe_timeSpent', timeSpent);
    localStorage.setItem('caughtMe_rewards', JSON.stringify(unlockedRewards));
}

function checkMilestones() {
    for (const ms of MILESTONES) {
        if (timeSpent >= ms.time && !unlockedRewards.includes(ms.id)) {
            // Unlock!
            unlockedRewards.push(ms.id);
            saveRewards();
            showRewardNotification(ms);
        }
    }
}

function startTimeTracking() {
    if (sessionTimer) return;
    sessionTimer = setInterval(() => {
        timeSpent++;
        if (timeSpent % 5 === 0) { // save every 5 seconds
            saveRewards();
            checkMilestones();
            updateRewardsUI();
        }
    }, 1000);
}

function stopTimeTracking() {
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }
}

function formatTime(secs) {
    if (secs < 60) return secs + "s";
    if (secs < 3600) return Math.floor(secs / 60) + "m " + (secs % 60) + "s";
    return Math.floor(secs / 3600) + "h " + Math.floor((secs % 3600) / 60) + "m";
}

function showRewardNotification(ms) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: #222;
        border: 2px solid ${ms.color};
        border-radius: 12px;
        padding: 15px 20px;
        color: white;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${ms.color}40;
        transform: translateY(-100px);
        opacity: 0;
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    notif.innerHTML = `
        <div style="font-size: 40px;">${ms.icon}</div>
        <div>
            <div style="font-size: 12px; color: ${ms.color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Reward Unlocked!</div>
            <div style="font-size: 18px; font-weight: bold; margin: 4px 0;">${ms.name}</div>
            <div style="font-size: 13px; color: #aaa;">${ms.desc}</div>
        </div>
    `;
    document.body.appendChild(notif);
    
    // Animate in
    setTimeout(() => {
        notif.style.transform = 'translateY(0)';
        notif.style.opacity = '1';
    }, 100);

    // Animate out
    setTimeout(() => {
        notif.style.transform = 'translateY(-100px)';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 6000);
}

// Build the Modal UI
function buildRewardsModal() {
    if (document.getElementById('rewardsModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'rewardsModalOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999;
        display: none; align-items: center; justify-content: center; padding: 20px;
        backdrop-filter: blur(5px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1a1a1a; width: 100%; max-width: 500px; border-radius: 16px;
        border: 1px solid #333; overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;

    modal.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #111;">
            <h2 style="margin: 0; font-size: 18px; color: #e8760a; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-trophy"></i> My Rewards & Stats
            </h2>
            <button id="closeRewardsBtn" style="background:none; border:none; color:#888; font-size:24px; cursor:pointer;">&times;</button>
        </div>
        <div style="padding: 20px; text-align: center; border-bottom: 1px solid #333;">
            <div style="font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Total Time Spent</div>
            <div id="rewardTimeDisplay" style="font-size: 32px; font-weight: bold; color: #fff; margin-top: 5px; font-variant-numeric: tabular-nums;">0s</div>
        </div>
        <div style="padding: 20px; max-height: 400px; overflow-y: auto;" id="rewardsListContainer">
            <!-- Rewards go here -->
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('closeRewardsBtn').onclick = () => overlay.style.display = 'none';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
}

function updateRewardsUI() {
    const timeDisp = document.getElementById('rewardTimeDisplay');
    if (timeDisp) {
        timeDisp.textContent = formatTime(timeSpent);
    }
    const indexDisp = document.getElementById('indexTimerDisplay');
    if (indexDisp) {
        indexDisp.textContent = formatTime(timeSpent);
    }

    const container = document.getElementById('rewardsListContainer');
    if (container) {
        container.innerHTML = '';
        MILESTONES.forEach(ms => {
            const isUnlocked = unlockedRewards.includes(ms.id);
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex; align-items: center; gap: 15px; padding: 12px; margin-bottom: 10px;
                border-radius: 12px; border: 1px solid ${isUnlocked ? ms.color : '#333'};
                background: ${isUnlocked ? ms.color + '10' : '#222'};
                opacity: ${isUnlocked ? '1' : '0.5'};
                filter: ${isUnlocked ? 'none' : 'grayscale(100%)'};
                transition: all 0.3s;
            `;
            item.innerHTML = `
                <div style="font-size: 36px; width: 50px; text-align: center;">${ms.icon}</div>
                <div style="flex: 1;">
                    <div style="font-size: 15px; font-weight: bold; color: ${isUnlocked ? ms.color : '#aaa'};">${ms.name}</div>
                    <div style="font-size: 12px; color: #888; margin-top: 4px;">${ms.desc}</div>
                </div>
                ${!isUnlocked ? `<div style="font-size: 11px; color:#666; font-weight:bold; padding: 4px 8px; border-radius: 20px; background:#111;"><i class="fa-solid fa-lock"></i> Locked</div>` : ''}
            `;
            container.appendChild(item);
        });
    }
}

function showRewardsModal() {
    buildRewardsModal();
    updateRewardsUI();
    document.getElementById('rewardsModalOverlay').style.display = 'flex';
}

// Start tracking immediately when script loads
document.addEventListener('DOMContentLoaded', () => {
    buildRewardsModal();
    
    // Only track time if we are inside a chat room (chat.html or cam-room.html)
    const isChatRoom = window.location.pathname.includes('chat') || window.location.pathname.includes('cam-room');
    if (isChatRoom) {
        startTimeTracking();
    }
    
    // Update display immediately for non-chat pages
    updateRewardsUI();
    
    // Attempt to hook into window visibility/focus to pause timer if they leave?
    // User asked "stop when the user left teh room left the webstie". 
    // Usually leaving the page stops the JS anyway, but we can also use visibility API.
    document.addEventListener("visibilitychange", () => {
        if (!isChatRoom) return;
        
        if (document.hidden) {
            stopTimeTracking();
            saveRewards();
        } else {
            startTimeTracking();
        }
    });
});
