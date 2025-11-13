// frontend/frontend/scripts/wallet.js - FIXED
const API_URL = 'https://cwxv2be.onrender.com';
let currentPage = 1;
let username = '';

// ======================
// AUTH CHECK
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

// ======================
// WALLET BALANCE
// ======================

async function fetchWalletBalance() {
    try {
        const res = await fetch(`${API_URL}/wallet`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to fetch balance');

        const data = await res.json();
        updateBalanceUI(data.balance);
        return data;
    } catch (error) {
        console.error('Balance fetch error:', error);
        return null;
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
// TRANSACTIONS
// ======================

async function fetchTransactions() {
    try {
        const res = await fetch(`${API_URL}/wallet?page=${currentPage}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to fetch transactions');

        const data = await res.json();
        displayTransactions(data.transactions);
        updatePaginationButtons(data.transactions.length);
    } catch (error) {
        console.error('Transactions fetch error:', error);
    }
}

function displayTransactions(transactions) {
    const list = document.getElementById('transactionList');
    if (!list) return;

    if (!transactions || transactions.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions yet</div>';
        return;
    }

    list.innerHTML = transactions.map(t => {
        const isPositive = ['Deposit', 'Reward', 'Referral Reward'].includes(t.type);
        const colorClass = isPositive ? 'bg-green-500' : 'bg-red-500';
        const symbol = isPositive ? '+' : '-';
        const amount = t.amount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        return `
            <div class="${colorClass} text-white px-4 py-3 rounded-lg flex justify-between items-center">
                <div>
                    <div class="font-semibold">${symbol}₹${amount}</div>
                    <div class="text-xs opacity-80">${t.type}</div>
                </div>
                <div class="text-xs opacity-80">
                    ${new Date(t.date).toLocaleDateString('en-IN')}
                </div>
            </div>
        `;
    }).join('');
}

function updatePaginationButtons(transactionCount) {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = transactionCount < 10;
}

// ======================
// DEPOSIT
// ======================

function openDepositModal() {
    const modal = document.getElementById('Amount-container');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
    }
}

async function handleDepositSubmit() {
    const amount = parseFloat(document.getElementById('depositAmount')?.value);
    const utn = document.getElementById('utrNumber')?.value.trim();
    const screenshot = document.getElementById('paymentScreenshot')?.files[0];

    if (!amount || amount < 100 || amount > 25000) {
        return alert('Amount must be between ₹100 and ₹25,000');
    }

    if (!utn || utn.length !== 12) {
        return alert('Please enter valid 12-digit UTR number');
    }

    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('utn', utn);
    formData.append('username', username);
    if (screenshot) formData.append('screenshot', screenshot);

    try {
        const res = await fetch(`${API_URL}/api/submit-deposit`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!res.ok) throw new Error('Deposit submission failed');

        alert('Deposit request submitted! Funds will be credited after verification.');
        closeDepositModal();
        await fetchWalletBalance();
        await fetchTransactions();
    } catch (error) {
        alert(error.message);
    }
}

function closeDepositModal() {
    const modal = document.getElementById('Amount-container');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('active');
    }
    
    // Reset form
    const form = document.getElementById('depositForm');
    if (form) form.reset();
}

// ======================
// WITHDRAWAL
// ======================

async function handleWithdrawSubmit() {
    const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
    const accountNumber = document.getElementById('impsAccountNumber')?.value.trim();
    const ifscCode = document.getElementById('ifscCode')?.value.trim();

    if (!amount || amount < 100) {
        return alert('Minimum withdrawal amount is ₹100');
    }

    if (!accountNumber || !ifscCode) {
        return alert('Please enter all bank details');
    }

    try {
        const res = await fetch(`${API_URL}/api/submit-withdrawal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                amount,
                accountNumber,
                ifscCode,
                username
            })
        });

        if (!res.ok) throw new Error('Withdrawal submission failed');

        alert('Withdrawal request submitted! Funds will be transferred within 24 hours.');
        closeWithdrawModal();
        await fetchWalletBalance();
        await fetchTransactions();
    } catch (error) {
        alert(error.message);
    }
}

function closeWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.classList.add('hidden');
    
    // Reset form
    const form = document.getElementById('withdrawForm');
    if (form) form.reset();
}

// ======================
// COPY UPI
// ======================

function copyUPI() {
    const upiId = 'paytmqr5hk47h@ptys';
    navigator.clipboard.writeText(upiId)
        .then(() => alert('UPI ID copied!'))
        .catch(() => alert('Failed to copy'));
}

// ======================
// PAGINATION
// ======================

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    fetchTransactions();
}

// ======================
// INITIALIZATION
// ======================

async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;

    await fetchWalletBalance();
    await fetchTransactions();

    // Setup event listeners
    document.getElementById('depositButton')?.addEventListener('click', openDepositModal);
    document.getElementById('finalConfirmDeposit')?.addEventListener('click', handleDepositSubmit);
    document.getElementById('confirmWithdraw')?.addEventListener('click', handleWithdrawSubmit);
    document.getElementById('copyUpiButton')?.addEventListener('click', copyUPI);
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
}

document.addEventListener('DOMContentLoaded', init);