document.addEventListener('DOMContentLoaded', function () {
    // Suppress all console output (log, warn, error, info, etc.)
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};

const baseurl = 'https://cwxv2be.onrender.com'
// Define a variable to store user information
let user = null;
// Define a variable to store the audio object and songs array

// Check user authentication and fetch wallet details when the page loads
async function init() {
    try {
        user = await checkAuth(); // Store the user data
        await fetchWalletDetails(); // Fetch wallet details after successful authentication
        fetchGameHistory(); // Fetch game history after wallet details
    } catch (error) {
        console.error("Redirecting to auth page due to:", error);
        window.location.href = 'auth.html'; // Redirect to login/register page if not authenticated
    }
}

// Function to check user authentication
async function checkAuth() {
    const response = await fetch(`${baseurl}/verify-token`, {
        method: 'GET',
        credentials: 'include' // Ensure cookies are sent
    });

    if (!response.ok) {
        throw new Error('Authentication failed');
    }

    const data = await response.json();
    return data; // Return user data
}
// Fetch wallet details and display them
async function fetchWalletDetails() {
    try {
        const response = await fetch(`${baseurl}/wallet`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch wallet details');
        }

        const data = await response.json();
        transactions = data.transactions.reverse(); // Reverse transactions array to show newest first
        
        // Ensure balance is a number before passing to the UI update function
        const walletBalance = parseFloat(data.balance);
        updateWalletBalance(walletBalance); // Update the UI with wallet balance

    } catch (error) {
    }
}

// Function to update the wallet balance in the UI
function updateWalletBalance(newBalance) {
    const balanceElement = document.getElementById('walletBalance'); // Adjust the ID as needed
    if (balanceElement) {
        // Format the balance in Indian format with commas and 2 decimal places
        const formattedBalance = newBalance.toLocaleString('en-IN', {
            style: 'decimal',
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
        balanceElement.textContent = `₹${formattedBalance}`; // Display the formatted balance
    }
}


// Function to display alert messages
function displayAlert(message, type) {
    // Create an alert element
    const alertElement = document.createElement('div');
    alertElement.textContent = message;
    alertElement.classList.add('alert');

    // Set alert styles based on the type
    if (type === 'success') {
        alertElement.classList.add('alert-success'); // You can define these styles in your CSS
    } else if (type === 'error') {
        alertElement.classList.add('alert-error');
    }

    // Append the alert to the body or a specific container
    document.body.appendChild(alertElement);

    // Remove the alert after a few seconds
    setTimeout(() => {
        alertElement.remove();
    }, 3000); // Adjust the time as needed
}
// ... existing code ...
// Event listener for the Game History button
document.getElementById('gameHistoryButton').addEventListener('click', function() {
    currentPage = 1; // Reset to the first page
    fetchGameHistory(); // Fetch game history
    $('#chartContainer').hide(); // Hide the chart container
    $('#myHistoryContent').hide(); // Hide bet history
    $('#historyList').show(); // Show the game history list
});

// Event listener for the Bet History button
document.getElementById('myHistoryButton').addEventListener('click', function() {
    currentPage = 1; // Reset to the first page
    fetchBetHistory(); // Fetch bet history
    $('#chartContainer').hide(); // Hide chart container
    $('#historyList').hide(); // Hide the game history list
    $('#myHistoryContent').show(); // Show bet history content
});

// Event listener for the Charts button
document.getElementById('chartsButton').addEventListener('click', function() {
    currentPage = 1; // Reset to the first page
    fetchGameHistory('number'); // Fetch only number entries for charts
    $('#historyList').hide(); // Hide the game history list
    $('#myHistoryContent').hide(); // Hide bet history
    $('#chartContainer').show(); // Show the chart container
});
// Fetch bet history for user
async function fetchBetHistory() {
    const myHistoryContent = document.getElementById('myHistoryContent');
    const myHistoryList = document.getElementById('myHistoryList');

    // Clear previous history
    myHistoryList.innerHTML = '';

    try {
        const response = await fetch(`${baseurl}/api/user/bet-history`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.betHistory && data.betHistory.length > 0) {
            myHistoryContent.style.display = 'block';
            data.betHistory.reverse(); 
            
            data.betHistory.forEach(bet => {
                const payoutAmount = bet.win ? `+₹${bet.payoutAmount}` : '₹0';
                const payoutClass = bet.win ? 'text-green-600 font-bold' : 'text-gray-500';

                let betDisplay = '';
                if (['red', 'green', 'purple'].includes(bet.betValue)) {
                    const colorClass = `neon-buttonh ${bet.betValue}`;
                    betDisplay = `<button class="${colorClass} text-white font-semibold rounded shadow-md">${bet.betValue.charAt(0).toUpperCase() + bet.betValue.slice(1)}</button>`;
                } else if (bet.betValue === 'big' || bet.betValue === 'small') {
                    const sizeClass = bet.betValue === 'big' ? 'bg-yellow-500' : 'bg-blue-500';
                    betDisplay = `<button class="${sizeClass} text-white font-semibold rounded shadow-md">${bet.betValue.charAt(0).toUpperCase() + bet.betValue.slice(1)}</button>`;
                } else if (typeof bet.betValue === 'number') {
                    const numberClass = getNumberNeonClass(bet.betValue);
                    betDisplay = `<button class="${numberClass} text-white font-semibold rounded-full shadow-md">${bet.betValue}</button>`;
                } else {
                    betDisplay = `<span class="text-gray-300">${bet.betValue}</span>`;
                }

                const betItem = document.createElement('div');
                betItem.className = "bet-item transition-transform transform hover:scale-105 bg-gray-800 text-white p-4 rounded-lg shadow-lg hover:bg-gray-700 cursor-pointer flex flex-col justify-between my-2 border-b border-gray-600 hover:shadow-xl";
                betItem.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold">Bet Value:</span>
                        <div class="flex items-center">${betDisplay}</div>
                    </div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold">Payout:</span>
                        <span class="${payoutClass}">${payoutAmount}</span>
                    </div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold">Bet Amount:</span>
                        <span class="text-gray-300">₹${bet.betAmount}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="font-semibold">Date & Time:</span>
                        <span class="text-gray-500">${new Date(bet.createdAt).toLocaleString()}</span>
                    </div>
                `;
                
                myHistoryList.appendChild(betItem);
            });
        } else {
            myHistoryList.innerHTML = '<p class="text-gray-400">No bet history available.</p>';
            myHistoryContent.style.display = 'block';
        }

    } catch (error) {
        myHistoryList.innerHTML = '<p class="text-gray-400">Error fetching bet history. Please try again later.</p>';
        myHistoryContent.style.display = 'block';
    }
}

// Function to get the neon class for numbers
function getNumberNeonClass(number) {
    switch (number) {
        case 0:
            return 'neon-buttonh red-purple';
        case 5:
            return 'neon-buttonh green-purple';
        case 1:
        case 3:
        case 7:
        case 9:
            return 'neon-buttonh red';
        case 2:
        case 4:
        case 6:
        case 8:
            return 'neon-buttonh green';
        default:
            return 'text-gray-300'; 
    }
}

// Function to fetch game history and filter by type (e.g., 'number')
async function fetchGameHistory(filterType = '') {
    try {
        const response = await fetch(`${baseurl}/history`, {
            method: 'GET',
            credentials: 'include' // Ensure cookies are sent
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch game history');
        }

        const history = await response.json();
        
        window.historyData = history; // Store history data globally or in context

        if (filterType === 'number') {
            displayChart(history); // Pass the history to the chart display function
        } else {
            displayGameHistory(history); // Call without filterType for game history display
        }
    } catch (error) {
        console.error('Error fetching game history:');
    }
}

// Display paginated game history
let currentPage = 1;
const itemsPerPage = 10;

function displayGameHistory(history) {
    const historyContainer = $('#historyList');
    historyContainer.empty();

    if (history.length === 0) {
        historyContainer.append('<p>No game history available.</p>');
        createPaginationControls(0);
        return;
    }

    const totalPages = Math.ceil(history.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedHistory = history.slice(start, end);

    paginatedHistory.forEach(game => {
        let colorDotClass = '';
        let numberClass = 'neon-buttonh';

        if (game.number === 0) {
            colorDotClass = 'diagonal-neon-red-purple';
            numberClass += ' purple';
        } else if (game.number === 5) {
            colorDotClass = 'diagonal-neon-green-purple';
            numberClass += ' purple';
        } else {
            if (game.color === 'purple') {
                colorDotClass = 'bg-neon-purple';
                numberClass += ' purple';
            } else {
                colorDotClass = {
                    'red': 'bg-neon-red',
                    'green': 'bg-neon-green'
                }[game.color] || 'bg-gray-500';

                numberClass += {
                    'red': ' red',
                    'green': ' green'
                }[game.color] || '';
            }
        }

        const sizeClass = game.size === 'big' ? 'w-24 h-8' : 'w-12 h-6';
        const buttonColorClass = game.size === 'big' ? 'bg-yellow-500' : 'bg-blue-500';

        const historyItem = $(`
            <div class="history-item transition-transform transform hover:scale-105 bg-gray-800 text-white p-4 rounded-lg shadow-lg hover:bg-gray-700 cursor-pointer">
                <div class="flex items-center justify-between space-x-4">
                    <span class="${numberClass}">${game.number}</span>
                    <button class="${buttonColorClass} text-white font-semibold rounded ${sizeClass}">${game.size}</button>
                    <span class="w-6 h-6 rounded-full ${colorDotClass}"></span>
                </div>
            </div>
        `);

        historyContainer.append(historyItem);
        setTimeout(() => historyItem.addClass('visible'), 50);
    });

    createPaginationControls(totalPages);
}

// Pagination controls for history
function createPaginationControls(totalPages) {
    const paginationContainer = $('#paginationControls');
    paginationContainer.empty();

    if (currentPage > 1) {
        paginationContainer.append(`
            <button id="prevPage" class="btn bg-gray-600 text-white p-2 rounded hover:bg-gray-500">Previous</button>
        `);
    }

    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.append(`
            <button class="page-btn bg-gray-700 text-white p-2 rounded hover:bg-gray-500 ${i === currentPage ? 'active' : ''}">${i}</button>
        `);
    }

    if (currentPage < totalPages) {
        paginationContainer.append(`
            <button id="nextPage" class="btn bg-gray-600 text-white p-2 rounded hover:bg-gray-500">Next</button>
        `);
    }

    $('#prevPage').on('click', function() {
        if (currentPage > 1) {
            currentPage--;
            displayGameHistory(window.historyData);
        }
    });

    $('#nextPage').on('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            displayGameHistory(window.historyData);
        }
    });

    $('.page-btn').on('click', function() {
        currentPage = parseInt($(this).text());
        displayGameHistory(window.historyData);
    });
}

function displayChart(history) {
    const chartContainer = $('#chartContainer');
    chartContainer.empty();

    history.forEach(game => {
        const chartItem = $(`
            <div class="chart-item p-4 md:p-6 lg:p-8">
                <div class="number-container flex justify-center items-center gap-1 md:gap-2"></div>
            </div>
        `);

        const numberContainer = chartItem.find('.number-container');
        for (let i = 0; i <= 9; i++) {
            let numberClass = 'neon-buttonh';
            let colorClass = '';
            let additionalClasses = 'text-xs sm:text-sm md:text-base'; // Small text size

            // Set color and circular highlight for the current number
            if (i === game.number) {
                colorClass = game.color === 'purple' ? 'purple' :
                             game.color === 'red' ? 'red' :
                             game.color === 'green' ? 'green' :
                             'green-purple'; // Default for other outcomes
                additionalClasses += ' rounded-full border-2 border-white'; // Make the highlighted number circular
            } else {
                colorClass = 'non-outcome-number'; // For non-outcome numbers
            }

            // Append each number with the appropriate classes
            numberContainer.append(`
                <span class="${numberClass} ${colorClass} ${additionalClasses} p-2 inline-block">
                    ${i}
                </span>
            `);
        }

        // Append chart item to the chart container
        chartContainer.append(chartItem);
    });
}

// Pop-up functionality for info
document.getElementById('infoIcon').addEventListener('click', function() {
    document.getElementById('infoPopup').classList.remove('hidden');
});

document.getElementById('closePopup').addEventListener('click', function() {
    document.getElementById('infoPopup').classList.add('hidden');
});

// Select all bet buttons
// Select all bet buttons (colors, sizes, and numbers)
const betButtons = document.querySelectorAll('.neon-button, .betnumber-button');

// Initialize current bet amount, multiplier, and selected bet details
let currentBetAmount = 0; 
let selectedMultiplier = 1; 
let selectedBetDetails = { betType: '', betValue: '', betAmount: 0 }; // Object to store bet details

// Add event listeners to each button
betButtons.forEach(button => {
    button.addEventListener('click', function() {
        // Use data attributes to set selected bet details
        selectedBetDetails.betType = button.dataset.betType; // Get bet type from data attribute
        selectedBetDetails.betValue = button.dataset.betValue; // Get bet value from data attribute
        selectedBetDetails.betAmount = currentBetAmount; // Update the bet amount

        // Show and slide up the amount container
        const amountContainer = document.getElementById('Amount-container');
        amountContainer.classList.remove('hidden');
        amountContainer.classList.add('active');

        // Clone the clicked button to show which bet is selected
        const clonedButton = button.cloneNode(true); // Clone the button with its styles

        // Clear previous content and append the cloned button
        const selectedBetContainer = document.getElementById('selectedBet');
        selectedBetContainer.innerHTML = ''; // Clear any previous content
        selectedBetContainer.appendChild(clonedButton); // Append the cloned button
    });
});

// Event listener for data-value buttons (bet amounts)
$('.bg-gray-700[data-value]').on('click', function() {
    const value = parseInt($(this).data('value')); // Get the value from the button's data-value attribute
    console.log('Bet Value Clicked:', value); // Log the clicked value
    if (!isNaN(value) && value > 0) {
        currentBetAmount = value; // Set currentBetAmount to the clicked value
        updateBetAmount(); // Update the UI with the new amount
    }
});


// Event listener for multiplier buttons
$('.bg-gray-700[data-multiplier]').on('click', function() {
    selectedMultiplier = parseInt($(this).data('multiplier')); // Set selected multiplier
    $('.bg-gray-700[data-multiplier]').removeClass('selected'); // Remove previous selection
    $(this).addClass('selected'); // Highlight the selected multiplier
});

// Increase bet amount by the selected multiplier
$('#increaseBtn').on('click', function() {
    currentBetAmount += selectedMultiplier; // Increase bet amount
    updateBetAmount(); // Update the UI
});

// Decrease bet amount by the selected multiplier
$('#decreaseBtn').on('click', function() {
    currentBetAmount -= selectedMultiplier; // Decrease bet amount
    if (currentBetAmount < 0) currentBetAmount = 0; // Prevent negative amounts
    updateBetAmount(); // Update the UI
});

// Function to update the bet amount in the UI
function updateBetAmount() {
    if (isNaN(currentBetAmount) || currentBetAmount <= 0) {
        displayAlert('Please enter a valid bet amount.', 'error');
        return; // Exit if the bet amount is invalid
    }
    
    $('#bet-amount').text(currentBetAmount.toFixed(2)); // Update the displayed bet amount
}
// Function to fetch and update remaining time every second
    async function fetchRemainingTime() {
        try {
            const response = await fetch(`${baseurl}/time-remaining`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            const remainingTime = data.timeRemaining;
            
            // Update only if the remaining time is valid
            if (remainingTime >= 0) {
                document.getElementById('timer').textContent = 
                    `00:${remainingTime < 10 ? '0' + remainingTime : remainingTime}`;
            }
        } catch (error) {
            console.error("Error fetching remaining time:");
        }
    }
setInterval(fetchRemainingTime, 1000);
    
// Enhanced Socket.IO initialization for real-time updates with reconnection
const socket = io(`${baseurl}`, {
    reconnectionAttempts: 5, // Retry up to 5 times before failing
    reconnectionDelay: 1000 // Wait 1 second between reconnection attempts
});
// Listen for 'newOutcome' events and fetch game history in real-time
socket.on('newOutcome', () => {
    fetchGameHistory(); // Refresh the game history on new outcome
});

socket.on('connect_error', (error) => {
    displayAlert('Attempting to reconnect...', 'error');
});
// Listen for balance updates from the server
socket.on('balanceUpdate', (data) => {
    // Assuming 'data.balance' contains the updated wallet balance
    updateWalletBalance(data.balance); // Update the wallet balance displayed on the UI
});

socket.on('reconnect', (attempt) => {
    console.log(`Reconnected after ${attempt} attempts`);
    displayAlert('Reconnected to server!', 'success');
});

    fetchRemainingTime(); 
// Inside your submit event listener
document.getElementById('submitBet').addEventListener('click', async function() {
    const checkbox = document.querySelector('input[type="checkbox"]');
    if (!checkbox.checked) {
        displayAlert('Please agree to the terms before submitting your bet.', 'error');
        return; // Exit the function if checkbox is not checked
    }

    // Check for valid bet amount and bet type
    if (currentBetAmount <= 0) {
        displayAlert('Please enter a valid bet amount.', 'error');
        return; // Exit if the bet amount is invalid
    }
    if (!selectedBetDetails.betType || !selectedBetDetails.betValue) {
        displayAlert('Please select a bet type (color, size, or number) before submitting.', 'error');
        return; // Exit if no bet type or value is selected
    }

    // Get remaining time before placing the bet
    const remainingTime = await getRemainingTime(); 
    if (remainingTime > 5) { 
        // Define the betData object here
        const betData = {
            betType: selectedBetDetails.betType, // The type of bet (color, number, size)
            betValue: selectedBetDetails.betValue, // The value for the bet
            betAmount: currentBetAmount // The amount to bet
        };
 
        // Send the bet data to the server
        try {
            const response = await fetch(`${baseurl}/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(betData) // Send the adjusted betData directly
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to place the bet');
            }

            const resultData = await response.json();
            console.log('Bet placed successfully:');

            // Show success alert with bet details
            const betMessage = `Bet placed successfully on ${betData.betValue} with amount ${betData.betAmount}.`;
            displayAlert(betMessage, 'success'); // Custom message

            // Reset selections
            resetBetSelections();

        } catch (error) {
            displayAlert(error.message || 'Failed to place bet. Please try again.', 'error');
        }
    } else {
        displayAlert('Failed to place bet in last 5 seconds.', 'error');
    }
    
});
// Event listener for the cancel button
document.getElementById('cancelBet').addEventListener('click', function() {
    resetBetSelections(); // Reset the bet selections
    displayAlert('Bet has been canceled.', 'success'); // Display success alert

    // Hide the bet amount container
    const amountContainer = document.getElementById('Amount-container');
    amountContainer.classList.remove('active');
    amountContainer.classList.add('hidden');
});

// Function to get remaining time
async function getRemainingTime() {
    try {
        const response = await fetch(`${baseurl}/time-remaining`, {
            method: 'GET',
            credentials: 'include' // Ensure cookies are sent
        });
        const data = await response.json();
        return data.timeRemaining;
    } catch (error) {
        console.error('Error fetching remaining time:', error);
        return 0; // Default to 0 if there's an error
    }
}

// Function to reset bet selections
function resetBetSelections() {
    currentBetAmount = 0;
    selectedMultiplier = 1;
    selectedBetDetails = { betType: '', betValue: '', betAmount: 0 }; // Reset selected bet details
    $('#bet-amount').text(currentBetAmount.toFixed(2)); // Reset displayed bet amount
    $('#selectedBet').empty(); // Clear selected bet display

    // Optionally, hide the amount container immediately after resetting
    const amountContainer = document.getElementById('Amount-container');
    amountContainer.classList.remove('active');
    amountContainer.classList.add('hidden');
}
// Initialize the application
init();
});
