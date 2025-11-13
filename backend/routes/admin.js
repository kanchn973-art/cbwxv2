// routes/admin.js - Complete Admin Panel with Prisma
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Admin Middleware
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ message: 'Admin token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access only' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        const isValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
        
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Deposits
router.get('/deposits', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        
        const filter = {};
        if (status === 'checked') filter.checked = true;
        if (status === 'unchecked') filter.checked = false;

        const deposits = await prisma.deposit.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        balance: true
                    }
                }
            }
        });

        res.json({ deposits });
    } catch (error) {
        console.error('Admin deposits error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Approve Deposit
router.post('/deposit/approve', verifyAdmin, async (req, res) => {
    try {
        const { depositId, username, amount } = req.body;

        if (!depositId || !username || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { username },
            include: { referrals: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if first deposit
        const isFirstDeposit = !user.firstDeposit;

        // Transaction to update everything
        await prisma.$transaction(async (tx) => {
            // Update deposit
            await tx.deposit.update({
                where: { id: depositId },
                data: { checked: true }
            });

            // Update user balance
            const updateData = {
                balance: {
                    increment: amount
                }
            };

            if (isFirstDeposit) {
                updateData.firstDeposit = true;
                updateData.xp = { increment: 1 };
            }

            await tx.user.update({
                where: { id: user.id },
                data: updateData
            });

            // Add transaction record
            await tx.transaction.create({
                data: {
                    userId: user.id,
                    amount,
                    type: 'Deposit'
                }
            });

            // Handle referral rewards if first deposit
            if (isFirstDeposit && user.referredBy) {
                const referrer = await tx.user.findUnique({
                    where: { username: user.referredBy }
                });

                if (referrer) {
                    // Update referral status
                    await tx.referral.updateMany({
                        where: {
                            userId: referrer.id,
                            referredUsername: user.username
                        },
                        data: {
                            hasDeposited: true
                        }
                    });

                    // Give referral reward
                    await tx.user.update({
                        where: { id: referrer.id },
                        data: {
                            balance: {
                                increment: 5
                            }
                        }
                    });

                    await tx.transaction.create({
                        data: {
                            userId: referrer.id,
                            amount: 5,
                            type: 'Referral Reward'
                        }
                    });
                }
            }
        });

        res.json({ message: 'Deposit approved' });
    } catch (error) {
        console.error('Approve deposit error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Withdrawals
router.get('/withdrawals', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        
        const filter = {};
        if (status === 'checked') filter.checked = true;
        if (status === 'unchecked') filter.checked = false;

        const withdrawals = await prisma.withdrawal.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        balance: true
                    }
                }
            }
        });

        res.json({ withdrawals });
    } catch (error) {
        console.error('Admin withdrawals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Approve Withdrawal
router.post('/withdrawal/approve', verifyAdmin, async (req, res) => {
    try {
        const { withdrawalId, username, amount } = req.body;

        if (!withdrawalId || !username || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Transaction
        await prisma.$transaction([
            prisma.withdrawal.update({
                where: { id: withdrawalId },
                data: { checked: true }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: {
                    balance: {
                        decrement: amount
                    }
                }
            }),
            prisma.transaction.create({
                data: {
                    userId: user.id,
                    amount,
                    type: 'Withdraw'
                }
            })
        ]);

        res.json({ message: 'Withdrawal approved' });
    } catch (error) {
        console.error('Approve withdrawal error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send Notification to User
router.post('/notification/send', verifyAdmin, async (req, res) => {
    try {
        const { username, message } = req.body;

        if (!username || !message) {
            return res.status(400).json({ message: 'Username and message required' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await prisma.notification.create({
            data: {
                userId: user.id,
                message
            }
        });

        res.json({ message: 'Notification sent' });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Feedback
router.get('/feedback', verifyAdmin, async (req, res) => {
    try {
        const feedback = await prisma.feedback.findMany({
            orderBy: { dateSubmitted: 'desc' }
        });

        res.json({ feedback });
    } catch (error) {
        console.error('Feedback fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;