// routes/withdrawal.js
const express = require('express');
const router = express.Router();
require('dotenv').config();

const User = require('../models/User')
const Withdrawal = require('../models/Withdrawal');
const { verifyToken } = require('../middleware/authtoken'); // Assuming you have an auth middleware for token verification
const verifyAdminToken = require('../middleware/adminonlytoken');  // Adjust the path as needed
// Route to handle withdrawal submission
router.post('/submit-withdrawal', verifyToken, async (req, res) => {
    try {
        // Extract fields from the request body
        const { amount, accountNumber, ifscCode } = req.body;

        // Validate required fields
        if (!amount || !accountNumber || !ifscCode) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Validate amount
        if (amount <= 0 || isNaN(amount)) {
            return res.status(400).json({ error: "Invalid withdrawal amount." });
        }

        // Get the username from the authenticated user
        const username = req.user.username;

        // Create a new Withdrawal document
        const newWithdrawal = new Withdrawal({
            username,
            amount: parseFloat(amount),
            accountNumber,
            ifscCode,
        });

        // Save the withdrawal to the database
        await newWithdrawal.save();

        // Send a success response
        return res.status(200).json({ message: "Withdrawal submitted successfully." });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        return res.status(500).json({ error: "An error occurred while processing your request." });
    }
});

// Route for withdrawing funds (admin-only)
router.post('/only-admin/withdraw', verifyAdminToken, async (req, res) => {
    const { username, amount, withdrawalId } = req.body;

    if (!username || amount <= 0 || !withdrawalId) {
        return res.status(400).json({ message: 'Invalid request: Username, amount, and withdrawalId are required.' });
    }

    try {
        // Find the user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user has enough balance to withdraw
        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Deduct the amount from the user's balance
        user.balance -= amount;

        // Record the withdrawal in the user's transactions
        const transaction = {
            amount,
            type: 'Withdraw',
            date: new Date()
        };
        user.transactions.push(transaction);

        // Save the user record with updated balance and transaction
        await user.save();

        // Find the withdrawal request by ID and mark it as 'checked'
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        // Mark the withdrawal as processed (checked)
        withdrawal.checked = true;
        await withdrawal.save();

        // Send success response
        res.status(200).json({ message: 'Withdrawal successful', balance: user.balance, transaction, withdrawal });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ message: 'An error occurred while processing the withdrawal' });
    }
});
// Route to get all withdrawal requests with filtering and detailed user info
router.get('/admin-only/withdrawals', verifyAdminToken, async (req, res) => {
    const { status } = req.query;

    // Set up a filter based on the status (checked, unchecked, or all)
    let filter = {};
    if (status === 'checked') {
        filter.checked = true;
    } else if (status === 'unchecked') {
        filter.checked = false;
    }

    try {
        // Fetch the withdrawals based on the filter
        const withdrawals = await Withdrawal.find(filter);

        if (!withdrawals || withdrawals.length === 0) {
            return res.status(404).json({ message: 'No withdrawal requests found' });
        }

        // For each withdrawal request, get user details
        const detailedWithdrawals = await Promise.all(
            withdrawals.map(async (withdrawal) => {
                const user = await User.findById(withdrawal.userId).populate('transactions bets rewards');
                return {
                    ...withdrawal.toObject(),
                    user: {
                        username: user.username,
                        email: user.email,
                        balance: user.balance,
                        xp: user.xp,
                        transactions: user.transactions,
                        bets: user.bets,
                        rewards: user.rewards,
                    }
                };
            })
        );

        // Return detailed withdrawal requests with user data
        res.status(200).json({
            message: 'Withdrawal requests fetched successfully with user details',
            withdrawals: detailedWithdrawals
        });
    } catch (error) {
        console.error('Error fetching withdrawal requests:', error);
        res.status(500).json({ message: 'An error occurred while fetching the withdrawal requests' });
    }
});
module.exports = router;
