// routes/game.js - Complete PostgreSQL/Prisma Implementation
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/authtoken');

const prisma = new PrismaClient();

// XP Milestones
const xpMilestones = [
    { xp: 0, reward: 25 },
    { xp: 1025, reward: 200 },
    { xp: 3075, reward: 300 },
    { xp: 9225, reward: 500 },
    { xp: 27675, reward: 3000 },
    { xp: 83025, reward: 12000 },
    { xp: 249075, reward: 43000 },
    { xp: 747225, reward: 65000 },
    { xp: 2241675, reward: 160000 },
    { xp: 6725025, reward: 230000 },
    { xp: 20175074, reward: 540000 }
];

// Check and unlock rewards
async function checkAndUnlockRewards(userId, userXP, firstDeposit) {
    if (!firstDeposit) return;

    const existingRewards = await prisma.reward.findMany({
        where: { userId }
    });

    const existingXPLevels = existingRewards.map(r => r.xpRequired);

    for (const milestone of xpMilestones) {
        if (userXP >= milestone.xp && !existingXPLevels.includes(milestone.xp)) {
            await prisma.reward.create({
                data: {
                    userId,
                    xpRequired: milestone.xp,
                    rewardAmount: milestone.reward
                }
            });
        }
    }
}

// Place Bet
router.post('/bet', verifyToken, async (req, res) => {
    try {
        const { betType, betValue, betAmount, roundId } = req.body;
        const userId = req.user.id;

        // Validation
        if (!betType || betValue === undefined || !betAmount || !roundId) {
            return res.status(400).json({ message: 'All bet fields required' });
        }

        if (betAmount <= 0) {
            return res.status(400).json({ message: 'Bet amount must be positive' });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Place bet
        await prisma.currentRoundBet.create({
            data: {
                userId,
                betType,
                betValue: String(betValue),
                betAmount,
                roundId
            }
        });

        // Update balance and XP
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                balance: {
                    decrement: betAmount
                },
                xp: {
                    increment: 1
                }
            }
        });

        // Check for new rewards
        await checkAndUnlockRewards(userId, updatedUser.xp, updatedUser.firstDeposit);

        res.json({
            message: 'Bet placed successfully',
            balance: updatedUser.balance,
            xp: updatedUser.xp
        });
    } catch (error) {
        console.error('Place bet error:', error);
        res.status(500).json({ message: 'Error placing bet' });
    }
});

// Get Game History
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        const history = await prisma.history.findMany({
            orderBy: {
                roundId: 'desc'
            },
            take: limit
        });

        res.json(history);
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ message: 'Error fetching history' });
    }
});

// Get User Bet History (with username query param for frontend compatibility)
router.get('/user/bet-history', async (req, res) => {
    try {
        const username = req.query.username;
        const limit = parseInt(req.query.limit) || 50;

        if (!username) {
            return res.status(400).json({ message: 'Username required' });
        }

        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const bets = await prisma.bet.findMany({
            where: { userId: user.id },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });

        res.json({ betHistory: bets });
    } catch (error) {
        console.error('Get bets error:', error);
        res.status(500).json({ message: 'Error fetching bets' });
    }
});

// Get Remaining Time
router.get('/time-remaining', async (req, res) => {
    try {
        // Access gameState from parent scope via app.locals
        const gameState = req.app.locals.gameState || { timer: 30 };
        res.json({ timeRemaining: gameState.timer });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching time' });
    }
});

module.exports = router;