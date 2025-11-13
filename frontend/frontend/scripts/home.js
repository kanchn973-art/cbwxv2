// frontend/frontend/scripts/home.js - FIXED
const API_URL = 'https://cwxv2be.onrender.com';
let username = '';
let profilePicture = '';

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
        console.error('Auth failed:', error);
        window.location.href = 'auth.html';
        return false;
    }
}

// ======================
// LOAD PROFILE
// ======================

async function loadProfile() {
    if (!username) return;

    try {
        const res = await fetch(`${API_URL}/profile/profile/${username}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load profile');

        const data = await res.json();
        
        if (data.profilePictureName) {
            profilePicture = data.profilePictureName;
            updateProfileImage();
        }

    } catch (error) {
        console.error('Profile load error:', error);
        // Use default image
        profilePicture = '1';
        updateProfileImage();
    }
}

function updateProfileImage() {
    const profileLogo = document.getElementById('profileLogo');
    if (!profileLogo) return;

    const savedPic = localStorage.getItem('selectedProfilePic');
    const imageUrl = savedPic || `./assets/${profilePicture}.jpg`;
    
    profileLogo.src = imageUrl;
}

// ======================
// TYPEWRITER EFFECT
// ======================

function typeWriter(text, elementId, speed = 100) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let i = 0;
    element.textContent = '';

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// ======================
// PAGE ANIMATIONS
// ======================

function animatePage() {
    const title = document.getElementById('CberWinX');
    const subtitle = document.querySelector('p');
    const gameCards = document.querySelectorAll('.game-card');
    const logo = document.getElementById('profileLogo');

    if (title) title.classList.add('animate__animated', 'animate__fadeIn');
    if (subtitle) subtitle.classList.add('animate__animated', 'animate__fadeIn', 'animate__delay-1s');
    if (logo) logo.classList.add('animate__animated', 'animate__bounceIn');

    gameCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add('animate__animated', 'animate__fadeInUp');
    });
}

// ======================
// VIDEO FALLBACK
// ======================

function setupVideoFallback() {
    const video = document.getElementById('video');
    const bgImage = document.getElementById('bgImage');

    if (video && bgImage) {
        video.onerror = () => {
            video.style.display = 'none';
            bgImage.style.display = 'block';
        };
    }
}

// ======================
// NAVIGATION
// ======================

function setupNavigation() {
    const apexBetBtn = document.getElementById('apexBetButton');
    if (apexBetBtn) {
        apexBetBtn.addEventListener('click', () => {
            window.location.href = 'ApexBet.html';
        });
    }
}

// ======================
// INITIALIZATION
// ======================

async function init() {
    try {
        // Check auth first
        const authenticated = await checkAuth();
        if (!authenticated) return;

        // Setup video fallback
        setupVideoFallback();

        // Load profile
        await loadProfile();

        // Typewriter effect
        typeWriter('CberWinX', 'CberWinX');

        // Animations
        setTimeout(animatePage, 500);

        // Navigation
        setupNavigation();

    } catch (error) {
        console.error('Init error:', error);
    }
}

// ======================
// START
// ======================

document.addEventListener('DOMContentLoaded', init);