$(document).ready(function () {
    // Suppress all console output (log, warn, error, info, etc.)
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};

    const itemsPerPage = 2;
    let currentPage = 1;
    let transactions = [];
    let username = ''; // Variable to store the username
    const baseurl = 'https://cwxv2be.onrender.com';

    // Initialize wallet details
    init();

    // Event handlers with delegation to reduce DOM updates
    $('#depositButton').on('click', openDepositModal);
    $('#withdrawButton').on('click', openWithdrawModal); // Open Withdraw Modal on click
    $('#depositModal .closeModal, #utrModal .closeModal, #withdrawModal .closeModal').on('click', resetModalFields);
    $('#initialConfirmDeposit').on('click', handleInitialDeposit);
    $('#finalConfirmDeposit').on('click', handleFinalDeposit);
    $('#confirmWithdraw').on('click', handleWithdraw);
    $('#prevPage').on('click', goToPreviousPage);
    $('#nextPage').on('click', goToNextPage);
    $('#copyUpiButton').on('click', function () {
        const upiId = 'paytmqr5hk47h@ptys'
        navigator.clipboard.writeText(upiId)
            .then(() => {
                alert('UPI ID copied to clipboard!'); // Simple alert for feedback
            })
            .catch(err => {
                console.error('Failed to copy UPI ID:', err);
                alert('Failed to copy UPI ID. Please try again.');
            });
    });
    // Close Deposit and Withdraw Success Modals when "Close" button is clicked
    $('.closeModal').on('click', function () {
        $(this).closest('.flex').addClass('hidden').removeClass('flex'); // Close the parent modal
    });

    // Initialize wallet and check auth
    async function init() {
        try {
            await checkAuth(); // Fetch username from the token verification
            await fetchWalletDetails();
        } catch (error) {
            console.error(error);
        }
    }
  // Function to generate UPI deep link
function generateUPILink(payeeUPI, amount, payeeName, transactionNote) {
    return `upi://pay?pa=${encodeURIComponent(payeeUPI)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(amount)}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
}

    // Open deposit modal
    function openDepositModal() {
        $('#depositModal').removeClass('hidden').addClass('flex');
    }

    // Open withdraw modal
    function openWithdrawModal() {
        $('#withdrawModal').removeClass('hidden').addClass('flex'); // Show Withdraw Modal
    }

// Handle initial deposit confirmation
function handleInitialDeposit() {
    const amount = parseFloat($('#depositAmount').val().replace(/,/g, '')); // Remove commas before parsing
    if (!isValidAmount(amount, 100, 25000)) {
        displayAlert("Please enter a valid amount between ₹100 and ₹25,000.", "error");
        return;
    }

    // UPI details
    const payeeUPI = "paytmqr5hk47h@ptys"; // Replace with the actual receiver UPI ID
    const payeeName = "CberWinX"; // Replace with the actual receiver name
    const transactionNote = "Deposit Payment for CberWinX";

    // Generate UPI link
    const upiLink = generateUPILink(payeeUPI, amount, payeeName, transactionNote);

    // Redirect to UPI app
    window.location.href = upiLink;

    // Open the UTR modal for user to input details
    $('#amountValue').text(formatCurrency(amount)); // Format the amount with commas
    toggleModals('#depositModal', '#utrModal');
}
    // Handle final deposit confirmation
    async function handleFinalDeposit() {
        const utrNumber = $('#utrNumber').val().trim();
        const amount = parseFloat($('#depositAmount').val().replace(/,/g, ''));
        const screenshot = $('#paymentScreenshot').prop('files')[0];

        if (!utrNumber || !isValidAmount(amount, 100, 25000)) {
            displayAlert("Please enter UTR number and valid amount.", "error");
            return;
        }

        // Disable button and show loading spinner
        $('#finalConfirmDeposit').prop('disabled', true).html('Processing <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');

        await makeDeposit(amount, utrNumber, screenshot); // Username is already stored

        // Re-enable the button and show success message
        $('#finalConfirmDeposit').prop('disabled', false).html('Confirm Deposit');
    }


    // Handle withdrawal confirmation
    async function handleWithdraw() {
        const amount = parseFloat($('#withdrawAmount').val().replace(/,/g, ''));
        const accountNumber = $('#impsAccountNumber').val().trim();
        const ifscCode = $('#ifscCode').val().trim();

        if (!isValidAmount(amount, 100, 25000) || !accountNumber || !ifscCode) {
            displayAlert("Please enter valid amount and account details.", "error");
            return;
        }

        // Disable button and show loading spinner
        $('#confirmWithdraw').prop('disabled', true).html('Processing <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');

        await makeWithdraw(amount, accountNumber, ifscCode);

        // Re-enable the button and show success message
        $('#confirmWithdraw').prop('disabled', false).html('Confirm Withdrawal');
    }

    // Pagination controls
    function goToPreviousPage() {
        if (currentPage > 1) {
            currentPage--;
            updateTransactionUI();
        }
    }

    function goToNextPage() {
        if ((currentPage * itemsPerPage) < transactions.length) {
            currentPage++;
            updateTransactionUI();
        }
    }

    // Authentication check
    async function checkAuth() {
        const response = await fetch(`${baseurl}/verify-token`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Authentication failed');
        const data = await response.json(); // Fetch the response data
        username = data.username; // Store the username for later use
    }

    // Fetch wallet details
    async function fetchWalletDetails() {
        const response = await fetch(`${baseurl}/wallet`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch wallet details');
        const data = await response.json();
        transactions = data.transactions.reverse(); // Show newest first
        updateWalletUI(data);
        updateTransactionUI();
    }

    // Deposit function
    async function makeDeposit(amount, utrNumber, screenshot) {
        const formData = new FormData();
        formData.append('utn', utrNumber);
        formData.append('amount', amount);
        formData.append('username', username); // Append username to formData
        if (screenshot) formData.append('screenshot', screenshot);

        try {
            const response = await $.ajax({
                url: `${baseurl}/api/submit-deposit`,
                type: 'POST',
                contentType: false,
                processData: false,
                data: formData,
                xhrFields: { withCredentials: true }
            });

            // Show deposit success modal
            $('#depositSuccessModal').removeClass('hidden').addClass('flex');
            resetModalFields();
            await fetchWalletDetails(); // Refresh wallet details after deposit
        } catch (xhr) {
            displayAlert(xhr.responseJSON?.message || "An error occurred while making the deposit.", "error");
        }
    }

    // Withdrawal function
    async function makeWithdraw(amount, accountNumber, ifscCode) {
        try {
            const response = await $.ajax({
                url: `${baseurl}/api/submit-withdrawal`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ 
                    amount,
                    username,  // Sending username
                    accountNumber, // Sending account number
                    ifscCode // Sending IFSC code
                }),
                xhrFields: { withCredentials: true }
            });

            // Show withdrawal success modal
            $('#withdrawSuccessModal').removeClass('hidden').addClass('flex');
            resetWithdrawModal();
            await fetchWalletDetails(); // Refresh wallet details after withdrawal
        } catch (xhr) {
            displayAlert(xhr.responseJSON?.message || "An error occurred while processing the withdrawal.", "error");
        }
    }

    // Validate amount
    function isValidAmount(amount, min = 0, max = Infinity) {
        return !isNaN(amount) && amount >= min && amount <= max;
    }

    // Update wallet UI
    function updateWalletUI(data) {
        $('#walletBalance').text(formatCurrency(data.balance)); // Format the balance
    }

    function updateTransactionUI() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        // Filter transactions to include only Deposits and Withdrawals
        const filteredTransactions = transactions.filter(transaction => 
            transaction.type === 'Deposit' || transaction.type === 'Withdraw'
        );

        const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

        const $transactionList = $('#transactionList');
        $transactionList.empty();

        if (currentTransactions.length === 0) {
    $transactionList.append('<li style="color: red;">No transactions found...</li>');
    } else {
            currentTransactions.forEach(transaction => {
                const date = new Date(transaction.date);
                const formattedDate = date.toLocaleDateString();
                const formattedTime = date.toLocaleTimeString();

                let transactionClass = '';
                let transactionSymbol = '';
                let formattedAmount = '';

                // Handle Deposit (green, + symbol)
                if (transaction.type === 'Deposit') {
                    transactionClass = 'bg-green-500 text-white'; // Full green background and white text
                    transactionSymbol = '+';
                    formattedAmount = `${transactionSymbol} ₹${formatCurrency(transaction.amount)}`;
                }
                // Handle Withdraw (red, - symbol)
                else if (transaction.type === 'Withdraw') {
                    transactionClass = 'bg-red-500 text-white'; // Full red background and white text
                    transactionSymbol = '-';
                    formattedAmount = `${transactionSymbol} ₹${formatCurrency(transaction.amount)}`;
                }

                // Construct the transaction button with formatted details
                const transactionButton = `
                    <li>
                        <button class="neon-button btn-transaction w-full text-left flex justify-between px-4 py-2 mb-2 ${transactionClass}">
                            <span>${formattedAmount} (${transaction.type})</span>
                            <span>
                                <button class="dark-button px-2 py-1 mr-2">${formattedDate}</button>
                                <button class="dark-button px-2 py-1">${formattedTime}</button>
                            </span>
                        </button>
                    </li>`;
                $transactionList.append(transactionButton);
            });
        }

        // Handle pagination visibility
        $('#prevPage').toggleClass('hidden', currentPage === 1);
        $('#nextPage').toggleClass('hidden', endIndex >= filteredTransactions.length);
    }

    // Format amount with commas (Indian style)
    function formatCurrency(amount) {
        return amount.toLocaleString('en-IN'); // Indian number formatting
    }

    // Reset withdrawal modal
    function resetWithdrawModal() {
        $('#withdrawModal').addClass('hidden').removeClass('flex');
        $('#withdrawAmount').val('');
        $('#impsAccountNumber').val('');
        $('#ifscCode').val('');
    }

    // Reset modal fields after closing
    function resetModalFields() {
        $('#depositModal, #utrModal, #withdrawModal').addClass('hidden').removeClass('flex');
        $('#depositAmount').val('');
        $('#utrNumber').val('');
        $('#paymentScreenshot').val('');
        $('#amountValue').text('');
        $('#username').val(''); // Reset username input (if exists in the UI)
        $('#upiSection, #utrNumber, #utrLabel, #screenshot, #screenshotLabel').addClass('hidden');
    }

    // Toggle between modals
    function toggleModals(hideModal, showModal) {
        $(hideModal).addClass('hidden').removeClass('flex');
        $(showModal).removeClass('hidden').addClass('flex');
    }

    // Display alert messages
    function displayAlert(message, type) {
        const alertBox = $('#alertBox');
        alertBox.removeClass('hidden').text(message);
        alertBox.toggleClass('alert-success', type === "success").toggleClass('alert-error', type === "error");
        setTimeout(() => alertBox.addClass('hidden'), 3000);
    }

    // Format amount input with commas as user types
    $('#depositAmount, #withdrawAmount').on('input', function () {
        let value = $(this).val().replace(/,/g, ''); // Remove commas
        if (!value) return;
        
        value = Number(value).toLocaleString('en-IN'); // Format as currency
        $(this).val(value);
    });
});
