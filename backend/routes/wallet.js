// routes/wallet.js - PostgreSQL/Prisma Implementation
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/authtoken');

const prisma = new PrismaClient();

// Get Wallet Balance & Transactions
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get user with transactions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: skip
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            balance: user.balance,
            transactions: user.transactions.map(t => ({
                type: t.type,
                amount: t.amount,
                date: t.date
            }))
        });
    } catch (error) {
        console.error('Wallet fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit Deposit Request (Frontend compatibility routes)
router.post('/api/submit-deposit', verifyToken, async (req, res) => {
    try {
        const { amount, utn, username } = req.body;
        const userId = req.user.id;

        // Validation
        if (!amount || !utn) {
            return res.status(400).json({ message: 'Amount and UTN required' });
        }

        const amt = parseFloat(amount);
        if (amt < 100 || amt > 25000) {
            return res.status(400).json({ message: 'Amount must be ₹100-₹25,000' });
        }

        if (String(utn).length !== 12) {
            return res.status(400).json({ message: 'UTN must be 12 digits' });
        }

        // Handle file upload (screenshot)
        let screenshotData = null;
        let screenshotType = null;
        
        if (req.files && req.files.screenshot) {
            screenshotData = req.files.screenshot.data.toString('base64');
            screenshotType = req.files.screenshot.mimetype;
        }

        // Create deposit request
        await prisma.deposit.create({
            data: {
                userId,
                username: req.user.username,
                amount: amt,
                utn: String(utn),
                screenshotData,
                screenshotType,
                checked: false
            }
        });

        res.json({ message: 'Deposit request submitted successfully' });
    } catch (error) {
        console.error('Deposit submission error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit Withdrawal Request (Frontend compatibility)
router.post('/api/submit-withdrawal', verifyToken, async (req, res) => {
    try {
        const { amount, accountNumber, ifscCode, username } = req.body;
        const userId = req.user.id;

        // Validation
        if (!amount || !accountNumber || !ifscCode) {
            return res.status(400).json({ message: 'All fields required' });
        }

        const amt = parseFloat(amount);
        if (amt < 100) {
            return res.status(400).json({ message: 'Minimum withdrawal: ₹100' });
        }

        // Check balance
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true }
        });

        if (user.balance < amt) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Create withdrawal request
        await prisma.withdrawal.create({
            data: {
                userId,
                username: req.user.username,
                amount: amt,
                accountNumber: String(accountNumber),
                ifscCode: String(ifscCode),
                checked: false
            }
        });

        res.json({ message: 'Withdrawal request submitted successfully' });
    } catch (error) {
        console.error('Withdrawal submission error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;