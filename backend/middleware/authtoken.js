// middleware/authtoken.js - PostgreSQL/Prisma Version
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const verifyToken = async (req, res, next) => {
    const token = req.cookies.auth_token;

    if (!token) {
        return res.status(403).json({ message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                username: true,
                email: true,
                balance: true,
                xp: true,
                verified: true,
                referralCode: true,
                referredBy: true,
                firstDeposit: true,
                profilePictureName: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { verifyToken };