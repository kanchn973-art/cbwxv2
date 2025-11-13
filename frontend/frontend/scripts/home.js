// Suppress all console output (log, warn, error, info, etc.)
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};

// Variables to hold user information
let username = '';
let profilePicture = ''; // Variable to hold profile picture URL
const baseurl = 'https://cwxv2be.onrender.com'; // Base URL for API

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', async () => {
    const title = document.getElementById('CberWinX');

    // Start the typewriter effect for the title
    typeWriter("CberWinX", 100);

    await checkAuth(); // Call the authentication check after DOM is loaded
    await loadProfile(); // Load user profile details
    animatePage(); // Start animations for page elements

    // Replace logo with saved profile image if available
    loadProfileImage();

    // Add click event listener to the Play button in ApexBet
    document.getElementById('apexBetButton')?.addEventListener('click', () => {
        window.location.href = 'ApexBet.html'; // Redirect to ApexBet page
    });

    // Event listeners for Wallet, Profile, and Help buttons
    document.querySelector('a[href="wallet.html"]')?.addEventListener('click', () => {
        window.location.href = 'wallet.html'; // Redirect to Wallet page
    });

    document.querySelector('a[href="profile.html"]')?.addEventListener('click', () => {
        window.location.href = 'profile.html'; // Redirect to Profile page
    });

    document.querySelector('a[href="help.html"]')?.addEventListener('click', () => {
        window.location.href = 'help.html'; // Redirect to Help page
    });
});

// Function to load saved profile image as the logo
function loadProfileImage() {
    const profileLogo = document.getElementById('profileLogo');
    const savedProfilePic = localStorage.getItem('selectedProfilePic'); // Get saved profile image URL

    if (savedProfilePic) {
        profileLogo.style.backgroundImage = `url(${savedProfilePic})`;
        profileLogo.src = ''; // Remove src to use backgroundImage
        profileLogo.classList.add('bg-cover'); // Ensure full coverage
    } else if (profilePicture) {
        profileLogo.style.backgroundImage = `url(${profilePicture})`; // Use the fetched profile picture
    }
}

// Function for the typewriter effect
function typeWriter(text, speed) {
    const titleElement = document.getElementById('CberWinX');
    let i = 0;

    const type = () => {
        if (i < text.length) {
            titleElement.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    };
    type();
}

// Function to animate elements on the page
function animatePage() {
    const title = document.getElementById('CberWinX');
    const subtitle = document.querySelector('p'); // Assuming there's a single <p> for subtitle
    const gameCards = document.querySelectorAll('.game-card');

    // Animate title and subtitle with fade-in effect
    title.classList.add('animate__animated', 'animate__fadeIn', 'animate__delay-1s');
    subtitle.classList.add('animate__animated', 'animate__fadeIn', 'animate__delay-1.5s');

    // Animate game cards with a slide-up effect
    gameCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`; // Delay each card's animation
        card.classList.add('animate__animated', 'animate__fadeInUp');
    });

    // Animate the logo with a bounce effect
    const logo = document.getElementById('profileLogo');
    logo.classList.add('animate__animated', 'animate__bounceIn');
}

// Function to check user authentication and load profile
async function checkAuth() {
    try {
        const response = await fetch(`${baseurl}/verify-token`, {
            method: 'GET',
            credentials: 'include' // Ensure cookies are sent
        });

        if (response.ok) {
            const data = await response.json();
            username = data.username; // Store username in global scope
            console.log(data.message); // Handle the successful response
        } else {
            window.location.href = 'auth.html'; // Redirect to login/register page if not authenticated
        }
    } catch (error) {
        alert('An error occurred while checking authentication. Please try again.'); // Inform the user
        window.location.href = 'auth.html';
    }
}

// Function to load the user's profile data
async function loadProfile() {
    try {
        const response = await fetch(`${baseurl}/profile`, {
            method: 'GET',
            credentials: 'include' // Ensure cookies are sent
        });

        if (response.ok) {
            const data = await response.json();
            // Update the navbar with the user's profile picture and username
            if (data.profile) {
                profilePicture = data.profile.pictureName; // Assume this returns just the number (like '2')

                // Load the profile image directly from assets
                document.getElementById('profileLogo').src = `./assets/${profilePicture}.jpg`; // Set the src to the image path
                
                document.getElementById('usernameDisplay').textContent = `Welcome, ${username}`; // Display username
            }
        }
        // No else block for errors, to avoid showing any error messages
    } catch (error) {
        // Do nothing on error - silently ignore
    }
}

// Select the form element
const issueForm = document.getElementById('issueForm');

issueForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent the default form submission

    const formData = new FormData(issueForm); // Create a FormData object from the form

    // Append username to the FormData
    formData.append('username', username); // Use the username from the global variable

    try {
        const response = await fetch(issueForm.action, {
            method: 'POST',
            body: formData, // Attach the FormData object
            credentials: 'include' // Include credentials like cookies in the request
        });

        // Check if the response is okay (status in the range 200-299)
        if (response.ok) {
            const data = await response.json(); // Parse the JSON response
            alert(data.message); // Show success message
            issueForm.reset(); // Reset the form
        } else {
            const errorText = await response.text(); // Read response as text
            try {
                const errorData = JSON.parse(errorText); // Try to parse JSON
                alert(`Error: ${errorData.error || 'Something went wrong. Please try again later.'}`);
            } catch (e) {
                alert(`Error: ${errorText || 'An unexpected error occurred.'}`);
            }
        }
    } catch (error) {
        alert('An error occurred while submitting your issue. Please try again later.');
    }
});

// Load the background music
const audioElement = document.getElementById('backgroundMusic'); // Ensure the element exists
if (audioElement) {
    audioElement.src = './assets/16.mp3'; // Update to the correct path
    audioElement.load();
}

// Toggle background music on button click
document.getElementById('musicToggle')?.addEventListener('click', () => {
    if (audioElement) {
        toggleMusic();
    }
});

// Function to toggle music playback
function toggleMusic() {
    if (audioElement.paused) {
        audioElement.play()
            .then(() => {
                document.getElementById('musicToggle').textContent = 'Pause Music';
            })
            .catch(err => {
                console.error('Playback failed:', err); // Handle playback errors
            });
    } else {
        audioElement.pause();
        document.getElementById('musicToggle').textContent = 'Play Music';
    }
}

// Fallback for the video element
const video = document.getElementById('video');
const bgImage = document.getElementById('bgImage');

// Fallback to background image if video fails to load
video.onerror = () => {
    video.style.display = 'none';
    bgImage.style.display = 'block';
};

// Start background music on page load
window.onload = () => {
    if (audioElement) {
        audioElement.play().catch(err => {
            console.error('Auto-play failed:', err); // Handle auto-play errors
        });
    }
    checkAuth(); // Ensure the user is authenticated
};
