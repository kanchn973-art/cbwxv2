const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Ultra-secret admin token (store in env, NOT here)
const ULTRA_SECRET_TOKEN = process.env.ULTRA_ADMIN_SECRET;

// Multi-factor admin middleware
const verifyUltraAdmin = async (req, res, next) => {
    const authHeader = req.headers['x-ultra-admin-auth'];
    const tokenHeader = req.headers['x-ultra-admin-token'];
    const timestampHeader = req.headers['x-ultra-admin-timestamp'];
    
    if (!authHeader || !tokenHeader || !timestampHeader) {
        return res.status(404).send('Not Found'); // Hide existence
    }

    // Verify timestamp (5 min window)
    const now = Date.now();
    const timestamp = parseInt(timestampHeader);
    if (Math.abs(now - timestamp) > 300000) {
        return res.status(404).send('Not Found');
    }

    // Verify HMAC signature
    const expectedHmac = crypto
        .createHmac('sha256', ULTRA_SECRET_TOKEN)
        .update(`${tokenHeader}:${timestamp}`)
        .digest('hex');
    
    if (authHeader !== expectedHmac) {
        return res.status(404).send('Not Found');
    }

    // Verify JWT
    try {
        const decoded = jwt.verify(tokenHeader, process.env.JWT_SECRET);
        if (decoded.role !== 'ultra_admin') {
            return res.status(404).send('Not Found');
        }
        next();
    } catch (error) {
        return res.status(404).send('Not Found');
    }
};

// Ultra-admin login (requires secret passphrase + password)
router.post('/auth/omega-login', async (req, res) => {
    const { passphrase, password, challenge } = req.body;
    
    // Verify passphrase hash
    const expectedPassphraseHash = crypto
        .createHash('sha256')
        .update(process.env.ULTRA_ADMIN_PASSPHRASE)
        .digest('hex');
    
    const providedPassphraseHash = crypto
        .createHash('sha256')
        .update(passphrase)
        .digest('hex');
    
    if (providedPassphraseHash !== expectedPassphraseHash) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Rate limit
        return res.status(404).send('Not Found');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, process.env.ULTRA_ADMIN_PASSWORD_HASH);
    
    if (!isValid) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return res.status(404).send('Not Found');
    }

    // Generate token
    const token = jwt.sign(
        { role: 'ultra_admin', challenge }, 
        process.env.JWT_SECRET, 
        { expiresIn: '15m' }
    );

    res.json({ token });
});

// Get all users with full details
router.get('/users/all', verifyUltraAdmin, async (req, res) => {
    const users = await prisma.user.findMany({
        include: {
            transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
            bets: { orderBy: { createdAt: 'desc' }, take: 10 },
            rewards: true,
            referrals: true
        }
    });
    res.json({ users });
});

// Modify user balance
router.post('/users/:userId/balance', verifyUltraAdmin, async (req, res) => {
    const { userId } = req.params;
    const { amount, operation } = req.body; // operation: 'add' or 'set'

    const updateData = operation === 'add' 
        ? { balance: { increment: amount } }
        : { balance: amount };

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
    });

    // Log action
    await prisma.transaction.create({
        data: {
            userId,
            amount: operation === 'add' ? amount : 0,
            type: 'Admin Adjustment'
        }
    });

    res.json({ user });
});

// Get system stats
router.get('/stats/overview', verifyUltraAdmin, async (req, res) => {
    const [userCount, totalDeposits, totalWithdrawals, pendingDeposits, pendingWithdrawals] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.aggregate({ where: { type: 'Deposit' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { type: 'Withdraw' }, _sum: { amount: true } }),
        prisma.deposit.count({ where: { checked: false } }),
        prisma.withdrawal.count({ where: { checked: false } })
    ]);

    res.json({
        users: userCount,
        totalDeposits: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        pendingDeposits,
        pendingWithdrawals
    });
});

// Ban/unban user
router.post('/users/:userId/ban', verifyUltraAdmin, async (req, res) => {
    const { userId } = req.params;
    const { banned } = req.body;

    const user = await prisma.user.update({
        where: { id: userId },
        data: { banned }
    });

    res.json({ user });
});

// Delete user (nuclear option)
router.delete('/users/:userId', verifyUltraAdmin, async (req, res) => {
    const { userId } = req.params;
    
    await prisma.user.delete({
        where: { id: userId }
    });

    res.json({ message: 'User deleted' });
});

// View all deposits with screenshots
router.get('/deposits/all', verifyUltraAdmin, async (req, res) => {
    const deposits = await prisma.deposit.findMany({
        include: {
            user: { select: { username: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json({ deposits });
});

// Bulk approve deposits
router.post('/deposits/bulk-approve', verifyUltraAdmin, async (req, res) => {
    const { depositIds } = req.body;

    for (const depositId of depositIds) {
        const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
        
        await prisma.$transaction([
            prisma.deposit.update({ where: { id: depositId }, data: { checked: true } }),
            prisma.user.update({
                where: { id: deposit.userId },
                data: { balance: { increment: deposit.amount } }
            }),
            prisma.transaction.create({
                data: { userId: deposit.userId, amount: deposit.amount, type: 'Deposit' }
            })
        ]);
    }

    res.json({ message: 'Deposits approved' });
});

module.exports = router;