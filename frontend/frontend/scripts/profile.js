// Suppress all console output (log, warn, error, info, etc.)
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};

const baseURL = 'https://cwxv2be.onrender.com'; // Your server URL
let username = ''; // Store the username after successful authentication

// Define XP thresholds for each level starting from Level 0 threshold
const xpThresholds = [
    0,         // Level 0 threshold
    1025,      // Level 1 threshold
    3075,      // Level 2 threshold
    9225,      // Level 3 threshold
    27675,     // Level 4 threshold
    83025,     // Level 5 threshold
    249075,    // Level 6 threshold
    747225,    // Level 7 threshold
    2241675,   // Level 8 threshold
    6725025,   // Level 9 threshold
    20175074   // Level 10 threshold (Level 11 if users go beyond level 10)
];
// Function to format numbers in the Indian numbering system with commas
function formatInIndianStyle(number) {
    // Convert the number to a string
    let numStr = number.toString();
    
    // Check if the number has decimal places
    let parts = numStr.split('.');

    // Format the integer part
    let integerPart = parts[0];
    let formattedInteger = '';
    let count = 0;

    // Add commas for the integer part (in Indian format)
    for (let i = integerPart.length - 1; i >= 0; i--) {
        count++;
        formattedInteger = integerPart[i] + formattedInteger;
        if (count % 3 === 0 && i !== 0) {
            formattedInteger = ',' + formattedInteger;
        }
    }

    // If there's a decimal part, format it as well
    let decimalPart = parts[1] ? '.' + parts[1] : '';

    // Combine the formatted integer and decimal parts
    return formattedInteger + decimalPart;
}

// Function to get the level based on XP
function getLevelFromXP(xp) {
    for (let i = xpThresholds.length - 1; i >= 0; i--) {
        if (xp >= xpThresholds[i]) {
            return i; // Level is the index if XP is within or above this threshold
        }
    }
    return 0; // Default to level 0 if XP doesn't meet any thresholds
}
// Function to check if the user is authenticated
async function checkAuth() {
    try {
        const response = await fetch(`${baseURL}/verify-token`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Authentication failed');

        const data = await response.json();
        username = data.username;
        if (!username) throw new Error('Username is not available.');
        setReferralLink(username); // Pass the username to setReferralLink
    } catch (error) {
        window.location.href = 'auth.html';
    }
}
function toggleSettings() {
    const settingsContainer = document.getElementById('settings-container');

    // Toggle slide-in class for showing or hiding with animation
    if (settingsContainer.classList.contains('hidden')) {
        settingsContainer.classList.remove('hidden');
        settingsContainer.classList.add('slide-in'); // Trigger the slide-in effect
    } else {
        settingsContainer.classList.remove('slide-in');
        settingsContainer.classList.add('slide-out'); // Trigger the slide-out effect

        // Add hidden class after animation completes
        settingsContainer.addEventListener('animationend', () => {
            settingsContainer.classList.add('hidden');
            settingsContainer.classList.remove('slide-out');
        }, { once: true });
    }
}
function openCPAleadOfferWall() {
    // Replace with your actual CPAlead Offer Wall link
    const offerWallLink = "https://www.lnksforyou.com/list/48721";
    window.open(offerWallLink, "_blank");
}
// Toggle feedback modal visibility
function toggleFeedbackModal() {
    const feedbackModal = document.getElementById('feedback-modal');
    feedbackModal.classList.toggle('hidden');
}

// Submit feedback form
document.getElementById('feedback-form').addEventListener('submit', function(event) {
    event.preventDefault();
    // Capture form data
    const name = document.getElementById('feedback-name').value;
    const email = document.getElementById('feedback-email').value;
    const message = document.getElementById('feedback-message').value;

    // Here, send data to your server or process feedback
    console.log("Feedback submitted:", { name, email, message });
    alert('Thank you for your feedback!');

    // Close modal and reset form
    toggleFeedbackModal();
    this.reset();
});

// Function to open the transaction modal
function openTransactionModal() {
    document.getElementById('transaction-modal').classList.remove('hidden');
    filterTransactions();  // Load transactions by default
}

// Function to close the transaction modal
function closeTransactionModal() {
    document.getElementById('transaction-modal').classList.add('hidden');
}
// Function to filter transactions based on selected type (bets, reward, deposit, withdraw, etc.)
async function filterTransactions() {
    const type = document.getElementById('transaction-type').value;
    const url = `${baseURL}/wallet`;
    const cachebuster = new Date().getTime();
    const queryParams = `?username=${username}&cachebuster=${cachebuster}`;

    try {
        const walletResponse = await fetch(url + queryParams, { method: 'GET', credentials: 'include' });
        if (!walletResponse.ok) throw new Error('Failed to fetch wallet transactions');

        const walletData = await walletResponse.json();

        const betHistoryResponse = await fetch(`${baseURL}/api/user/bet-history?username=${username}`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!betHistoryResponse.ok) throw new Error('Failed to fetch bet history');

        const betHistoryData = await betHistoryResponse.json();

        displayTransactionsAndBets(walletData, betHistoryData, type);
    } catch (error) {
        alert('Error fetching transaction and bet history');
    }
}
// Display wallet and bet transactions
function displayTransactionsAndBets(walletData, betHistoryData, type) {
    const transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = '';

    // Display wallet transactions
    if (walletData.transactions) {
        const filteredWalletTransactions = walletData.transactions.filter(transaction => {
            if (type === 'reward' && transaction.type === 'Reward') return true;
            if (type === 'deposit' && transaction.type === 'Deposit') return true;
            if (type === 'withdraw' && transaction.type === 'Withdraw') return true;
            if (type === '' || type === 'all') return true;
            return false;
        });

        filteredWalletTransactions.forEach(transaction => {
            const transactionItem = document.createElement('li');
            transactionItem.classList.add('transaction-item');

            // Set color and prefix based on transaction type
            let amountDisplay = '';
            let amountClass = '';

            const formattedAmount = formatInIndianStyle(transaction.amount);

            switch (transaction.type.toLowerCase()) {
                case 'withdraw':
                    amountDisplay = `-₹${formattedAmount}`;
                    amountClass = 'text-red-500'; // Red color for negative amounts
                    break;
                case 'deposit':
                    amountDisplay = `+₹${formattedAmount}`;
                    amountClass = 'text-green-500'; // Green color for positive amounts
                    break;
                case 'reward':
                    amountDisplay = `+₹${formattedAmount}`;
                    amountClass = 'text-green-500'; // Green color for rewards
                    break;
                default:
                    amountDisplay = `₹${formattedAmount}`;
                    amountClass = 'text-gray-400'; // Default color for other types
            }

            transactionItem.innerHTML = `
                <div class="transaction-item-header">
                    <span>${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}</span>
                    <span class="transaction-date">${new Date(transaction.date).toLocaleString()}</span>
                </div>
                <div class="transaction-item-details">
                    <div class="transaction-amount ${amountClass}">${amountDisplay}</div>
                </div>
            `;
            transactionList.appendChild(transactionItem);
        });
    }

    // Display bet history if type is 'bets' or 'all' is selected
    if (betHistoryData.betHistory && (type === 'bets' || type === '' || type === 'all')) {
        betHistoryData.betHistory.forEach(bet => {
            const betItem = document.createElement('li');
            betItem.classList.add('transaction-item');

            // Format payout amount
            const payoutDisplay = bet.payoutAmount > 0 ? `+₹${formatInIndianStyle(bet.payoutAmount)}` : '₹0';
            const payoutClass = bet.payoutAmount > 0 ? 'text-green-500' : 'text-gray-400'; // Green for positive payouts, gray for zero payouts

            betItem.innerHTML = `
                <div class="transaction-item-header">
                    <span>Bet Type: ${bet.betType}</span>
                    <span class="transaction-date">${new Date(bet.createdAt).toLocaleString()}</span>
                </div>
                <div class="transaction-item-details">
                    <div class="transaction-amount">Bet Amount: ₹${formatInIndianStyle(bet.betAmount)}</div>
                    <div class="transaction-amount ${payoutClass}">Payout: ${payoutDisplay}</div>
                </div>
            `;
            transactionList.appendChild(betItem);
        });
    }

    // If no transactions or bets are found
    if (transactionList.innerHTML === '') {
        transactionList.innerHTML = '<li>No transactions or bets found.</li>';
    }
}
function logout() {
    // Optionally, clear any client-side storage (e.g., localStorage, sessionStorage)
    localStorage.clear();
    sessionStorage.clear();

    // Send a request to the server to log out
    fetch(`${baseURL}/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === 'Logged out successfully') {
            // Redirect to the login page or home page after successful logout
            window.location.href = '/frontend/auth';  // Redirect to the login page or home page
        } else {
            alert('Logout failed. Please try again.');
        }
    })
    .catch(error => {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    });
}
function redirectToWallet() {
    window.location.href = '/frontend/wallet.html'
};
function toggleResetPasswordModal() {
    const modal = document.getElementById('reset-password-modal');
    modal.classList.toggle('hidden');
}

// Function to close the reset password form with animation
function closeResetPasswordForm() {
    const form = document.getElementById('resetPasswordForm');

    // Trigger slide-out animation
    form.classList.remove('slide-in');
    form.classList.add('slide-out');

    // Hide the form after the animation completes
    form.addEventListener('animationend', () => {
        form.style.display = 'none';
        form.classList.remove('slide-out');
    }, { once: true });
}

// Example function to trigger password reset process
async function resetPassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validate that new password and confirm password match
    if (newPassword !== confirmPassword) {
        alert('New password and confirm password do not match.');
        return;
    }

    try {
        const response = await fetch(`${baseURL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (response.ok) {
            alert('Password reset successfully');
            closeResetPasswordForm();  // Close the form after successful reset
        } else {
            const data = await response.json();
            alert(data.message || 'Error resetting password');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Error resetting password. Please try again later.');
    }
}

// Function to toggle language (save language selection in local storage)
function setLanguage(language) {
    localStorage.setItem('language', language);
    alert(`Language set to ${language}`);
    // Reload or update UI based on the selected language
}
// Feedback form submission
document.getElementById('feedback-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const name = document.getElementById('feedback-name').value;
    const email = document.getElementById('feedback-email').value;
    const message = document.getElementById('feedback-message').value;
    submitFeedback(name, email, message);
    toggleFeedbackModal(); // Close the modal
    this.reset(); // Reset the form
});

// Function to submit feedback
async function submitFeedback(name, email, message) {
    try {
        const response = await fetch(`${baseURL}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, message })
        });

        if (response.ok) {
            alert('Thank you for your feedback!');
        } else {
            alert('Error submitting feedback');
        }
    } catch (error) {
    }
}

// Function to toggle the notification box visibility
function toggleNotification() {
    const notificationBox = document.getElementById('notification-box');
    notificationBox.classList.toggle('show'); // Toggle show class for the box
}

// Function to add a notification to the list
function addNotification(message, type = 'general') {
    const notificationList = document.getElementById('notification-list');
    
    // Create a new notification item
    const notificationItem = document.createElement('li');
    notificationItem.classList.add('notification-item', type); // Add the appropriate type class
    
    // Set the inner HTML of the notification item
    notificationItem.innerHTML = `<p>${message}</p>`;

    // Append the notification to the list
    notificationList.appendChild(notificationItem);

    // Animate the notification in
    setTimeout(() => {
        notificationItem.style.opacity = '1';
        notificationItem.style.transform = 'translateY(0)';
    }, 100); // Start showing after 100ms
}

// Function to fetch notifications from the server
async function fetchNotifications() {
    try {
        const response = await fetch(`${baseURL}/notifications`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include' // Ensure the JWT cookie is sent with the request
        });

        const data = await response.json();
        
        if (response.ok) {
            // Display each notification
            data.forEach(notification => {
                addNotification(notification.message, notification.type);
            });
        } else {
            console.error('Failed to fetch notifications:');
        }
    } catch (error) {
        console.error('Error fetching notifications:');
    }
}

// Call the fetch function to get notifications
fetchNotifications();

// Function to poll for new notifications every few seconds
function startNotificationPolling() {
    setInterval(() => {
        fetchNotifications(); // Fetch notifications every 10 seconds (or as needed)
    }, 10000); // Poll every 10 seconds
}

// Call this function when the page loads to start polling
startNotificationPolling();

// Function to clear all notifications when clicked
function clearNotifications() {
    const notificationList = document.getElementById('notification-list');
    notificationList.innerHTML = ''; // Clear the notification list
}

// Open the profile image selection modal
function openProfileImageSelection() {
    document.getElementById('profile-image-modal').classList.remove('hidden');
}

// Close the profile image selection modal
function closeProfileImageSelection() {
    document.getElementById('profile-image-modal').classList.add('hidden');
}

// Handle the selection of a profile image
function selectProfileImage(imageSrc) {
    // Update the profile picture on the front-end
    document.querySelector('.profile-pic img').src = imageSrc;

    // Save the selected image to the server/database
    saveProfileImageToDB(imageSrc);

    // Close the modal after selection
    closeProfileImageSelection();
}

// Save the selected profile image to the database
async function saveProfileImageToDB(imageSrc) {
    try {
        // Send the update request to the backend with the profile picture name (no ".jpg" extension)
        const response = await fetch(`${baseURL}/profile/image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // This ensures the auth_token is included in the request automatically
            body: JSON.stringify({
                profilePicture: imageSrc.split('/').pop(), // Send only the filename (without .jpg)
            }),
        });

    } catch (error) {
        console.error('Error updating profile picture:', error);
        alert('Error updating profile picture. Please try again later.');
    }
}

// Function to fetch profile data and update the UI
async function fetchProfile() {
    if (!username) return alert('You are not authenticated. Please log in again.');

    try {
        const response = await fetch(`${baseURL}/profile/${username}`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const profile = await response.json();

        // Calculate level and XP progress
        const level = getLevelFromXP(profile.xp);
        const nextLevelXP = xpThresholds[level + 1] || xpThresholds[xpThresholds.length - 1];
        const previousLevelXP = xpThresholds[level];
        const xpProgress = ((profile.xp - previousLevelXP) / (nextLevelXP - previousLevelXP)) * 100;

        // Update profile display elements
        document.getElementById('username-display').innerText = `${profile.username}`;
        document.getElementById('wallet-balance').innerText = `₹${formatInIndianStyle(profile.balance.toFixed(2))}`; // Format balance in Indian format
        document.getElementById('user-xp').innerText = `${(profile.xp)}`; // Format XP in Indian format
        document.getElementById('user-level').innerText = `${level}`;
        document.getElementById('xp-progress-bar').style.width = `${xpProgress}%`;

        // Update profile picture if available
        let profilePicSrc = 'assets/1.jpg'; // Default image
        if (profile.profilePicture && profile.profilePicture !== '1') {
            profilePicSrc = `assets/${profile.profilePicture}.jpg`;
        }
        document.querySelector('.profile-pic img').src = profilePicSrc;

        // Render rewards if any exist
        renderRewards(profile.rewards);

    } catch (error) {
        alert('Error fetching profile. Please try again later.');
    }
}

// Fetch XP status and display the next milestone
async function fetchXpStatus() {
    if (!username) return alert('You are not authenticated. Please log in again.');

    try {
        const response = await fetch(`${baseURL}/xp-status/${username}`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
    } catch (error) {
    }
}
function renderRewards(rewards) {
    const rewardContainer = document.getElementById('reward-container');
    rewardContainer.innerHTML = ''; // Clear existing content

    rewards.forEach(reward => {
        const rewardCard = document.createElement('div');
        rewardCard.className = 'reward-card bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-4 rounded-lg shadow-lg flex flex-col items-center max-w-xs mx-auto mb-4';

        rewardCard.innerHTML = `
            <h4 class="text-lg font-bold mb-2">Reward</h4>
            <p class="text-sm text-gray-200">XP Required: <span class="font-semibold text-yellow-300">${reward.xpRequired}</span></p>
            <p class="text-sm text-gray-200">Amount: ₹<span class="font-semibold">${formatInIndianStyle(reward.rewardAmount)}</span></p>
            <div class="mt-2">
                ${reward.claimed ? 
                    // If claimed, show a "Claimed" label with a green color
                    '<span class="text-green-300 font-semibold">Claimed</span>' : 
                    // If not claimed, show the "Claim Now" button
                    ''
                }
            </div>
        `;

        // If the reward is not claimed, add the "Claim Now" button
        if (!reward.claimed) {
            const claimButton = document.createElement('button');
            claimButton.innerText = 'Claim Now';
            claimButton.className = `
                mt-3 bg-gradient-to-r from-green-400 via-green-500 to-green-600
                text-white px-4 py-1.5 rounded-lg shadow-md
                font-semibold tracking-wide uppercase
                transition-all duration-300 transform
                hover:scale-105 hover:shadow-md
                focus:outline-none focus:ring-2 focus:ring-green-300
            `;
            // When clicked, trigger the claimReward function with the reward's ID
            claimButton.onclick = () => claimReward(reward.xpRequired);
            rewardCard.appendChild(claimButton);
        }

        // Append the reward card to the container
        rewardContainer.appendChild(rewardCard);
    });
}

// Function to claim a reward based on the XP requirement
async function claimReward(xpRequired) {
    if (!username) return alert('You are not authenticated. Please log in again.');

    try {
        const response = await fetch(`${baseURL}/claim-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, xpRequired })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();

        if (data.rewardAmount) {
            alert(`Reward of ₹${data.rewardAmount} claimed successfully!`);
            fetchProfile(); // Refresh the profile to update the rewards
        } else {
            alert(data.message || 'Error claiming reward');
        }
    } catch (error) {
        console.log(xpRequired)
        alert('Error claiming reward. Please try again later.');
    }
}
// Initialize the profile page on load
async function initializePage() {
    await checkAuth(); // Authenticate before proceeding
    if (!username) return;

    fetchProfile(); // Load profile data
    fetchXpStatus(); // Load XP status
}

// Function to set and display the referral link
function setReferralLink(username) {
    if (!username) return;

    // Construct the referral link
    const referralLink = `https://cberwinx.vercel.app/frontend/auth.html?referral=${encodeURIComponent(username)}`;
    
    const referralLinkElement = document.getElementById('referral-link');
    referralLinkElement.value = referralLink; // Set the value of the input to the referral link
    referralLinkElement.href = referralLink;
}
// Function to copy the referral link
function copyReferralLink()   {
    const referralInput = document.getElementById('referral-link');
    referralInput.select();
    referralInput.setSelectionRange(0, 99999); // For mobile devices
    const referralLink = referralInput.href; // Use the href as the link

    navigator.clipboard.writeText(referralInput.value)
        .then(() => {
        })
        .catch(err => {
            alert('Failed to copy referral link.');
        });
}
document.addEventListener('DOMContentLoaded', initializePage);
