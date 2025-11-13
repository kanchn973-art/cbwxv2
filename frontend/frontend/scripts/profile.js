// frontend/frontend/scripts/profile.js - FIXED
const API_URL = 'https://cwxv2be.onrender.com';
let username = '';

const xpThresholds = [0, 1025, 3075, 9225, 27675, 83025, 249075, 747225, 2241675, 6725025, 20175074];

// ======================
// AUTH
// ======================

async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/verify-token`, {
            method: 'GET',
            credentials: 'include' // CRITICAL: Send cookies
        });

        if (!res.ok) throw new Error('Not authenticated');

        const data = await res.json();
        username = data.username;
        setReferralLink(username)

        return true;
    } catch (error) {
        console.error('Auth failed:', error);
        
        // Clear any stored tokens
        localStorage.removeItem('auth_token');
        
        // Redirect after small delay to prevent loops
        setTimeout(() => {
            window.location.href = 'auth.html';
        }, 100);
        
        return false;
    }
}


// ======================
// PROFILE DATA
// ======================

async function fetchProfile() {
    if (!username) return;

    try {
        const res = await fetch(`${API_URL}/profile/profile/${username}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to fetch profile');

        const profile = await res.json();
        updateProfileUI(profile);
        renderRewards(profile.rewards || []);
    } catch (error) {
        console.error('Profile fetch error:', error);
    }
}

function updateProfileUI(profile) {
    // Username
    const usernameEl = document.getElementById('username-display');
    if (usernameEl) usernameEl.textContent = profile.username;

    // Balance
    const balanceEl = document.getElementById('wallet-balance');
    if (balanceEl) {
        balanceEl.textContent = `₹${formatIndian(profile.balance.toFixed(2))}`;
    }

    // XP & Level
    const level = getLevelFromXP(profile.xp);
    const xpEl = document.getElementById('user-xp');
    const levelEl = document.getElementById('user-level');
    
    if (xpEl) xpEl.textContent = formatIndian(profile.xp);
    if (levelEl) levelEl.textContent = level;

    // XP Progress Bar
    const nextLevelXP = xpThresholds[level + 1] || xpThresholds[xpThresholds.length - 1];
    const previousLevelXP = xpThresholds[level];
    const xpProgress = ((profile.xp - previousLevelXP) / (nextLevelXP - previousLevelXP)) * 100;
    
    const progressBar = document.getElementById('xp-progress-bar');
    if (progressBar) progressBar.style.width = `${xpProgress}%`;

    // Profile Picture
    const profilePic = document.querySelector('.profile-pic img');
    if (profilePic) {
        const picName = profile.profilePictureName || '1';
        profilePic.src = `assets/${picName}.jpg`;
    }
}

function getLevelFromXP(xp) {
    for (let i = xpThresholds.length - 1; i >= 0; i--) {
        if (xp >= xpThresholds[i]) return i;
    }
    return 0;
}

function formatIndian(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ======================
// REWARDS
// ======================

function renderRewards(rewards) {
    const container = document.getElementById('reward-container');
    if (!container) return;

    container.innerHTML = '';

    if (!rewards || rewards.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400">No rewards yet. Keep playing!</div>';
        return;
    }

    rewards.forEach(reward => {
        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-4 rounded-lg shadow-lg';

        card.innerHTML = `
            <h4 class="text-lg font-bold mb-2">Reward</h4>
            <p class="text-sm">XP Required: <span class="font-semibold text-yellow-300">${formatIndian(reward.xpRequired)}</span></p>
            <p class="text-sm">Amount: ₹<span class="font-semibold">${formatIndian(reward.rewardAmount)}</span></p>
            <div class="mt-3">
                ${reward.claimed 
                    ? '<span class="text-green-300 font-semibold">Claimed ✓</span>'
                    : `<button onclick="claimReward(${reward.xpRequired})" class="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-semibold w-full">Claim Now</button>`
                }
            </div>
        `;

        container.appendChild(card);
    });
}

async function claimReward(xpRequired) {
    if (!username) return;

    try {
        const res = await fetch(`${API_URL}/profile/claim-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, xpRequired })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to claim reward');
        }

        const data = await res.json();
        alert(`Reward of ₹${data.rewardAmount} claimed successfully!`);
        await fetchProfile();
    } catch (error) {
        alert(error.message);
    }
}

// ======================
// REFERRAL
// ======================

function setReferralLink(username) {
    const referralLink = `https://cberwinx.vercel.app/frontend/auth.html?referral=${encodeURIComponent(username)}`;
    const linkEl = document.getElementById('referral-link');
    if (linkEl) linkEl.value = referralLink;
}

function copyReferralLink() {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl) return;

    linkEl.select();
    navigator.clipboard.writeText(linkEl.value)
        .then(() => alert('Referral link copied!'))
        .catch(() => alert('Failed to copy link'));
}

// ======================
// PROFILE IMAGE
// ======================

function openProfileImageSelection() {
    const modal = document.getElementById('profile-image-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeProfileImageSelection() {
    const modal = document.getElementById('profile-image-modal');
    if (modal) modal.classList.add('hidden');
}

async function selectProfileImage(imageSrc) {
    const pictureName = imageSrc.split('/').pop().replace('.jpg', '');

    try {
        const res = await fetch(`${API_URL}/profile/profile/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ profilePicture: pictureName })
        });

        if (!res.ok) throw new Error('Failed to update profile picture');

        document.querySelector('.profile-pic img').src = imageSrc;
        closeProfileImageSelection();
        alert('Profile picture updated!');
    } catch (error) {
        alert(error.message);
    }
}

// ======================
// SETTINGS
// ======================

function toggleSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        container.classList.add('slide-in');
    } else {
        container.classList.add('slide-out');
        container.classList.remove('slide-in');
        setTimeout(() => container.classList.add('hidden'), 300);
    }
}

function toggleResetPasswordModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) modal.classList.toggle('hidden');
}

async function resetPassword() {
    const currentPassword = document.getElementById('current-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return alert('All fields required');
    }

    if (newPassword !== confirmPassword) {
        return alert('Passwords do not match');
    }

    if (newPassword.length < 6) {
        return alert('Password must be 6+ characters');
    }

    try {
        const res = await fetch(`${API_URL}/profile/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Password reset failed');
        }

        alert('Password reset successfully!');
        toggleResetPasswordModal();
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
    }).finally(() => {
        window.location.href = 'auth.html';
    });
}

// ======================
// FEEDBACK
// ======================

function toggleFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.classList.toggle('hidden');
}

document.getElementById('feedback-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('feedback-name')?.value;
    const email = document.getElementById('feedback-email')?.value;
    const message = document.getElementById('feedback-message')?.value;

    try {
        const res = await fetch(`${API_URL}/profile/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, message })
        });

        if (!res.ok) throw new Error('Failed to submit feedback');

        alert('Thank you for your feedback!');
        toggleFeedbackModal();
        e.target.reset();
    } catch (error) {
        alert(error.message);
    }
});

// ======================
// NOTIFICATIONS
// ======================

function toggleNotification() {
    const box = document.getElementById('notification-box');
    if (box) box.classList.toggle('show');
}

async function fetchNotifications() {
    try {
        const res = await fetch(`${API_URL}/notifications`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) return;

        const notifications = await res.json();
        displayNotifications(notifications);
    } catch (error) {
        console.error('Notifications fetch error:', error);
    }
}

function displayNotifications(notifications) {
    const list = document.getElementById('notification-list');
    if (!list) return;

    list.innerHTML = notifications.map(n => `
        <li class="notification-item bg-gray-700 p-3 rounded mb-2">
            <p class="text-sm">${n.message}</p>
            <span class="text-xs text-gray-400">${new Date(n.date).toLocaleDateString()}</span>
        </li>
    `).join('');
}

async function clearNotifications() {
    try {
        await fetch(`${API_URL}/clear-notifications`, {
            method: 'POST',
            credentials: 'include'
        });

        document.getElementById('notification-list').innerHTML = '';
        toggleNotification();
    } catch (error) {
        console.error('Clear notifications error:', error);
    }
}

// ======================
// TRANSACTIONS MODAL
// ======================

function openTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    if (modal) modal.classList.remove('hidden');
    filterTransactions();
}

function closeTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    if (modal) modal.classList.add('hidden');
}

async function filterTransactions() {
    const type = document.getElementById('transaction-type')?.value || 'all';

    try {
        const res = await fetch(`${API_URL}/wallet`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) return;

        const data = await res.json();
        displayTransactions(data.transactions, type);
    } catch (error) {
        console.error('Transactions fetch error:', error);
    }
}

function displayTransactions(transactions, type) {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    const filtered = type === 'all' 
        ? transactions 
        : transactions.filter(t => t.type.toLowerCase() === type.toLowerCase());

    list.innerHTML = filtered.map(t => {
        const isPositive = ['Deposit', 'Reward'].includes(t.type);
        const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
        const symbol = isPositive ? '+' : '-';

        return `
            <li class="transaction-item bg-gray-800 p-4 rounded-lg mb-2">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-semibold">${t.type}</div>
                        <div class="text-xs text-gray-400">${new Date(t.date).toLocaleString()}</div>
                    </div>
                    <div class="${colorClass} font-bold">
                        ${symbol}₹${formatIndian(t.amount.toFixed(2))}
                    </div>
                </div>
            </li>
        `;
    }).join('');
}

// ======================
// INITIALIZATION
// ======================

async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;

    await fetchProfile();
    await fetchNotifications();
}

document.addEventListener('DOMContentLoaded', init);