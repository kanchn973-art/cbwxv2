// frontend/frontend/scripts/Apex.js - FIXED
const API_URL = 'https://cwxv2be.onrender.com';
let socket = null;
let username = '';
let currentBalance = 0;
let currentBet = { type: null, value: null, amount: 0 };

// ======================
// AUTH & INITIALIZATION
// ======================

async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/verify-token`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Not authenticated');

        const data = await res.json();
        username = data.username;
        return true;
    } catch (error) {
        window.location.href = 'auth.html';
        return false;
    }
}

async function fetchBalance() {
    try {
        const res = await fetch(`${API_URL}/wallet`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to fetch balance');

        const data = await res.json();
        currentBalance = data.balance;
        updateBalanceUI(data.balance);
    } catch (error) {
        console.error('Balance fetch error:', error);
    }
}

function updateBalanceUI(balance) {
    const balanceEl = document.getElementById('walletBalance');
    if (balanceEl) {
        balanceEl.textContent = balance.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

// ======================
// SOCKET.IO CONNECTION
// ======================

function initializeSocket() {
    socket = io(API_URL, {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    socket.on('timerUpdate', (data) => {
        updateTimer(data.timer);
    });

    socket.on('newOutcome', (outcome) => {
        displayResult(outcome);
        fetchBalance();
        fetchGameHistory();
    });

    socket.on('balanceUpdate', (data) => {
        currentBalance = data.balance;
        updateBalanceUI(data.balance);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });
}

function updateTimer(seconds) {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = `00:${seconds.toString().padStart(2, '0')}`;
    }

    const statusEl = document.getElementById('bettingStatus');
    if (statusEl) {
        if (seconds > 5) {
            statusEl.innerHTML = '<span class="bg-green-500 px-3 py-1 rounded-full">Betting Open</span>';
        } else {
            statusEl.innerHTML = '<span class="bg-red-500 px-3 py-1 rounded-full">Betting Closing!</span>';
        }
    }
}

// ======================
// BET SELECTION
// ======================

function selectBet(type, value) {
    currentBet.type = type;
    currentBet.value = value;

    const amountContainer = document.getElementById('Amount-container');
    if (amountContainer) {
        amountContainer.classList.remove('hidden');
        amountContainer.classList.add('active');
    }

    const selectedBetDisplay = document.getElementById('selectedBetDisplay');
    if (selectedBetDisplay) {
        selectedBetDisplay.textContent = `${type.toUpperCase()}: ${value}`;
    }

    // Highlight selected button
    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.classList.remove('ring-4', 'ring-white');
    });
    event.target.classList.add('ring-4', 'ring-white');
}

// ======================
// BET AMOUNT CONTROLS
// ======================

function setBetAmount(amount) {
    currentBet.amount = amount;
    updateBetAmountDisplay();
}

function changeBetAmount(delta) {
    currentBet.amount = Math.max(0, currentBet.amount + delta);
    updateBetAmountDisplay();
}

function multiplyBet(multiplier) {
    currentBet.amount *= multiplier;
    updateBetAmountDisplay();
}

function updateBetAmountDisplay() {
    const amountEl = document.getElementById('bet-amount');
    if (amountEl) {
        amountEl.textContent = currentBet.amount.toFixed(2);
    }
}

// ======================
// PLACE BET
// ======================

async function confirmBet() {
    if (!currentBet.type || !currentBet.value || currentBet.amount <= 0) {
        return alert('Please select bet type and amount');
    }

    if (currentBet.amount > currentBalance) {
        return alert('Insufficient balance');
    }

    try {
        const res = await fetch(`${API_URL}/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                betType: currentBet.type,
                betValue: currentBet.value,
                betAmount: currentBet.amount
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to place bet');
        }

        const data = await res.json();
        alert('Bet placed successfully!');
        
        cancelBet();
        fetchBalance();
    } catch (error) {
        alert(error.message);
    }
}

function cancelBet() {
    currentBet = { type: null, value: null, amount: 0 };
    
    const amountContainer = document.getElementById('Amount-container');
    if (amountContainer) {
        amountContainer.classList.add('hidden');
        amountContainer.classList.remove('active');
    }

    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.classList.remove('ring-4', 'ring-white');
    });

    updateBetAmountDisplay();
}

// ======================
// GAME HISTORY
// ======================

async function fetchGameHistory() {
    try {
        const res = await fetch(`${API_URL}/history`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to fetch history');

        const data = await res.json();
        displayHistory(data.slice(0, 10));
    } catch (error) {
        console.error('History fetch error:', error);
    }
}

function displayHistory(history) {
    const list = document.getElementById('historyList');
    if (!list) return;

    list.innerHTML = history.map(h => {
        const colorClass = h.color === 'red' ? 'bg-red-500' : 
                          h.color === 'green' ? 'bg-green-500' : 'bg-purple-500';
        
        return `
            <div class="${colorClass} w-10 h-10 rounded-full flex items-center justify-center font-bold text-white">
                ${h.number}
            </div>
        `;
    }).join('');
}

function displayResult(outcome) {
    const resultCard = document.getElementById('resultCard');
    const resultNumber = document.getElementById('resultNumber');
    const resultColor = document.getElementById('resultColor');
    const resultSize = document.getElementById('resultSize');
    const roundId = document.getElementById('roundId');

    if (!resultCard) return;

    const colorClass = outcome.color === 'red' ? 'bg-red-500' : 
                      outcome.color === 'green' ? 'bg-green-500' : 'bg-purple-500';

    resultNumber.className = `w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${colorClass} text-white`;
    resultNumber.textContent = outcome.number;
    
    if (resultColor) resultColor.textContent = outcome.color;
    if (resultSize) resultSize.textContent = outcome.size;
    if (roundId) roundId.textContent = outcome.roundId;

    resultCard.classList.remove('hidden');
    setTimeout(() => resultCard.classList.add('hidden'), 5000);
}

// ======================
// INITIALIZATION
// ======================

async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;

    await fetchBalance();
    await fetchGameHistory();
    initializeSocket();

    // Setup bet amount controls
    document.querySelectorAll('[data-value]').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.value);
            if (value) setBetAmount(value);
        });
    });

    document.querySelectorAll('[data-multiplier]').forEach(btn => {
        btn.addEventListener('click', () => {
            const multiplier = parseInt(btn.dataset.multiplier);
            if (multiplier) multiplyBet(multiplier);
        });
    });

    document.getElementById('increaseBtn')?.addEventListener('click', () => changeBetAmount(10));
    document.getElementById('decreaseBtn')?.addEventListener('click', () => changeBetAmount(-10));
    document.getElementById('submitBet')?.addEventListener('click', confirmBet);
    document.getElementById('cancelBet')?.addEventListener('click', cancelBet);
}

document.addEventListener('DOMContentLoaded', init);