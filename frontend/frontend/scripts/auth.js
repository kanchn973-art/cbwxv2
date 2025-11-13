// frontend/frontend/scripts/auth.js - CLEAN REWRITE
const API_URL = 'https://cwxv2be.onrender.com';

// ======================
// UTILITY FUNCTIONS
// ======================

function showAlert(message, type = 'error') {
    const alertBox = document.createElement('div');
    alertBox.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);
    setTimeout(() => alertBox.remove(), 3000);
}

function toggleLoader(btnId, show) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    btn.disabled = show;
    if (show) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Processing...';
    } else {
        btn.textContent = btn.dataset.originalText || btn.textContent;
    }
}

function showForm(formId) {
    document.querySelectorAll('.auth-container').forEach(form => {
        form.classList.add('hidden');
    });
    const target = document.getElementById(formId);
    if (target) target.classList.remove('hidden');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ======================
// REGISTER
// ======================

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const referralCode = document.getElementById('referralCode')?.value.trim();

    if (!username || !email || !password) {
        return showAlert('All fields required');
    }

    if (!isValidEmail(email)) {
        return showAlert('Invalid email format');
    }

    if (password.length < 6) {
        return showAlert('Password must be 6+ characters');
    }

    toggleLoader('registerBtn', true);

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, referralCode })
        });

        const data = await res.json();
        

        if (!res.ok) throw new Error(data.message || 'Registration failed');

        showAlert('Registration successful! Check email for OTP', 'success');
        localStorage.setItem('pendingEmail', email);
        setTimeout(() => showForm('otpForm'), 1000);

    } catch (error) {
        showAlert(error.message);
    } finally {
        toggleLoader('registerBtn', false);
    }
});

// ======================
// OTP VERIFICATION
// ======================

const otpInputs = document.querySelectorAll('.otp-input');
otpInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && idx < otpInputs.length - 1) {
            otpInputs[idx + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            otpInputs[idx - 1].focus();
        }
    });
});

document.getElementById('otpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const otp = Array.from(otpInputs).map(input => input.value).join('');
    const email = localStorage.getItem('pendingEmail');

    if (otp.length !== 6) {
        return showAlert('Enter complete 6-digit OTP');
    }

    if (!email) {
        return showAlert('Session expired. Please register again');
    }

    toggleLoader('verifyBtn', true);

    try {
        const res = await fetch(`${API_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Invalid OTP');

        if (data.token) {
            localStorage.setItem('auth_token', data.token);
        }

        showAlert('Verification successful! Redirecting...', 'success');
        localStorage.removeItem('pendingEmail');
        setTimeout(() => showForm('loginForm'), 1500);

    } catch (error) {
        showAlert(error.message);
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
    } finally {
        toggleLoader('verifyBtn', false);
    }
});

// ======================
// LOGIN
// ======================

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!isValidEmail(email)) {
        return showAlert('Invalid email format');
    }

    if (!password) {
        return showAlert('Password required');
    }

    toggleLoader('loginBtn', true);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Login failed');

        if (data.token) {
            localStorage.setItem('auth_token', data.token);
        }

        showAlert('Login successful!', 'success');
        setTimeout(() => window.location.href = 'home.html', 1000);

    } catch (error) {
        showAlert(error.message);
    } finally {
        toggleLoader('loginBtn', false);
    }
});

// ======================
// FORGOT PASSWORD
// ======================

document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgotEmail').value.trim();

    if (!isValidEmail(email)) {
        return showAlert('Invalid email format');
    }

    toggleLoader('resetBtn', true);

    try {
        const res = await fetch(`${API_URL}/request-password-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Reset request failed');

        showAlert('Reset link sent to email!', 'success');
        setTimeout(() => showForm('loginForm'), 2000);

    } catch (error) {
        showAlert(error.message);
    } finally {
        toggleLoader('resetBtn', false);
    }
});

// ======================
// RESEND OTP
// ======================

document.getElementById('resendOTP')?.addEventListener('click', async () => {
    const email = localStorage.getItem('pendingEmail');

    if (!email) {
        return showAlert('Session expired');
    }

    try {
        const res = await fetch(`${API_URL}/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!res.ok) throw new Error('Failed to resend OTP');

        showAlert('OTP resent successfully!', 'success');

    } catch (error) {
        showAlert(error.message);
    }
});

// ======================
// REFERRAL CODE FROM URL
// ======================

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const referral = urlParams.get('referral');
    
    if (referral) {
        const referralInput = document.getElementById('referralCode');
        if (referralInput) {
            referralInput.value = referral;
            showForm('registerForm');
        }
    }
});