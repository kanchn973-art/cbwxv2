// routes/profile.js - Complete PostgreSQL/Prisma Implementation
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/authtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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

// Get Profile
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                rewards: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            username: user.username,
            xp: user.xp,
            balance: user.balance,
            profilePicture: { pictureName: user.profilePictureName },
            rewards: user.rewards
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Profile Picture
router.post('/profile/image', verifyToken, async (req, res) => {
    try {
        const { profilePicture } = req.body;
        const userId = req.user.id;

        if (!profilePicture) {
            return res.status(400).json({ message: 'Profile picture required' });
        }

        // Remove extension
        const pictureName = profilePicture.split('.').slice(0, -1).join('.');

        await prisma.user.update({
            where: { id: userId },
            data: {
                profilePictureName: pictureName
            }
        });

        res.json({ message: 'Profile picture updated' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Claim Reward
router.post('/claim-reward', verifyToken, async (req, res) => {
    try {
        const { xpRequired } = req.body;
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { rewards: true }
        });

        if (!user.firstDeposit) {
            return res.status(400).json({ message: 'First deposit required' });
        }

        if (user.xp < xpRequired) {
            return res.status(400).json({ message: 'Insufficient XP' });
        }

        const reward = user.rewards.find(r => r.xpRequired === xpRequired && !r.claimed);

        if (!reward) {
            return res.status(400).json({ message: 'Reward not found or already claimed' });
        }

        // Update reward and balance in transaction
        await prisma.$transaction([
            prisma.reward.update({
                where: { id: reward.id },
                data: { claimed: true }
            }),
            prisma.user.update({
                where: { id: userId },
                data: {
                    balance: {
                        increment: reward.rewardAmount
                    }
                }
            }),
            prisma.transaction.create({
                data: {
                    userId,
                    amount: reward.rewardAmount,
                    type: 'Reward'
                }
            })
        ]);

        res.json({
            message: 'Reward claimed',
            rewardAmount: reward.rewardAmount
        });
    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get XP Status
router.get('/xp-status/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await prisma.user.findUnique({
            where: { username },
            select: { xp: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nextMilestone = xpMilestones.find(m => m.xp > user.xp);

        res.json({
            currentXp: user.xp,
            nextMilestone: nextMilestone || null
        });
    } catch (error) {
        console.error('XP status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit Feedback
router.post('/feedback', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'All fields required' });
        }

        await prisma.feedback.create({
            data: {
                name,
                email,
                message
            }
        });

        res.json({ message: 'Feedback submitted' });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset Password
router.post('/reset-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword
            }
        });

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Notifications
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 20
        });

        res.json(notifications);
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Clear Notifications
router.post('/clear-notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        await prisma.notification.deleteMany({
            where: { userId }
        });

        res.json({ message: 'Notifications cleared' });
    } catch (error) {
        console.error('Clear notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;