// server.js - Complete Production Backend with File Upload
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const http = require('http');
const socketIo = require('socket.io');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// File Upload Middleware (for deposit screenshots)
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    abortOnLimit: true,
    createParentPath: true
}));

// Rate Limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many auth attempts'
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: 'Too many OTP requests'
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100
});

// Database Connection
async function connectDB() {
    try {
        await prisma.$connect();
        console.log('✅ PostgreSQL Connected');
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        process.exit(1);
    }
}

connectDB();

// JWT Middleware
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
                verified: true
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

// Socket.IO Setup
const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

// Game State
let gameState = {
    timer: 30,
    bettingLocked: false,
    currentRoundId: 1
};

// Game Logic
function generateWinningNumber() {
    const number = Math.floor(Math.random() * 10);
    const colorMap = {
        0: 'purple', 1: 'red', 2: 'green', 3: 'red', 4: 'green',
        5: 'purple', 6: 'green', 7: 'red', 8: 'green', 9: 'red'
    };
    const color = colorMap[number];
    const size = number >= 5 ? 'big' : 'small';
    
    return { number, color, size, roundId: gameState.currentRoundId };
}

// Game Timer
setInterval(async () => {
    if (gameState.timer === 0) {
        gameState.bettingLocked = true;
        
        const outcome = generateWinningNumber();
        io.emit('newOutcome', outcome);

        try {
            await prisma.history.create({
                data: {
                    roundId: outcome.roundId,
                    number: outcome.number,
                    color: outcome.color,
                    size: outcome.size
                }
            });

            await processBets(outcome);
        } catch (error) {
            console.error('Game processing error:', error);
        }

        gameState.currentRoundId++;
        gameState.timer = 30;
        gameState.bettingLocked = false;
    } else {
        gameState.timer--;
    }

    io.emit('timerUpdate', { timer: gameState.timer });
}, 1000);

async function processBets(outcome) {
    const users = await prisma.user.findMany({
        where: {
            currentRoundBets: {
                some: {
                    roundId: gameState.currentRoundId - 1
                }
            }
        },
        include: {
            currentRoundBets: {
                where: {
                    roundId: gameState.currentRoundId - 1
                }
            }
        }
    });

    for (const user of users) {
        let totalPayout = 0;

        for (const bet of user.currentRoundBets) {
            const isWinner = 
                (bet.betType === 'color' && bet.betValue === outcome.color) ||
                (bet.betType === 'size' && bet.betValue === outcome.size) ||
                (bet.betType === 'number' && parseInt(bet.betValue) === outcome.number);

            const multiplier = bet.betType === 'number' ? 9 : 2;
            const houseFee = 0.03;
            const payout = isWinner ? (bet.betAmount * multiplier * (1 - houseFee)) : 0;

            totalPayout += payout;
            
            await prisma.bet.create({
                data: {
                    userId: user.id,
                    betType: bet.betType,
                    betValue: bet.betValue,
                    betAmount: bet.betAmount,
                    win: isWinner,
                    payoutAmount: payout,
                    roundId: bet.roundId
                }
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                balance: {
                    increment: totalPayout
                }
            }
        });

        await prisma.currentRoundBet.deleteMany({
            where: {
                userId: user.id,
                roundId: gameState.currentRoundId - 1
            }
        });

        if (user.socketId) {
            const updatedUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { balance: true }
            });
            io.to(user.socketId).emit('balanceUpdate', { balance: updatedUser.balance });
        }
    }
}

// Store gameState in app.locals for route access
app.locals.gameState = gameState;

// Routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const walletRoutes = require('./routes/wallet');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');

// Auth Routes
app.post('/register', authLimiter, authRoutes.register);
app.post('/login', authLimiter, authRoutes.login);
app.post('/logout', authRoutes.logout);
app.post('/verify-otp', otpLimiter, authRoutes.verifyOTP);
app.post('/resend-otp', otpLimiter, authRoutes.resendOTP);
app.post('/request-password-reset', authLimiter, authRoutes.requestPasswordReset);

app.get('/verify-token', verifyToken, (req, res) => {
    res.json({ username: req.user.username });
});

// API Routes
app.use('/api', apiLimiter);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// Wallet Routes (both paths for compatibility)
app.use('/wallet', walletRoutes);
app.use('/api', walletRoutes);

// Profile Routes (both /profile and /api/profile for compatibility)
app.use('/profile', profileRoutes);
app.use('/api/profile', profileRoutes);

// Notifications (direct path for frontend)
app.get('/notifications', verifyToken, async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { date: 'desc' },
        take: 20
    });
    res.json(notifications);
});

app.post('/clear-notifications', verifyToken, async (req, res) => {
    await prisma.notification.deleteMany({
        where: { userId: req.user.id }
    });
    res.json({ message: 'Notifications cleared' });
});

// Legacy routes for frontend compatibility
app.get('/history', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = await prisma.history.findMany({
        orderBy: { roundId: 'desc' },
        take: limit
    });
    res.json(history);
});

app.get('/time-remaining', async (req, res) => {
    res.json({ timeRemaining: gameState.timer });
});

app.get('/api/user/bet-history', async (req, res) => {
    const username = req.query.username;
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
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    res.json({ betHistory: bets });
});

app.post('/bet', verifyToken, async (req, res) => {
    const { betType, betValue, betAmount } = req.body;
    const userId = req.user.id;

    if (!betType || betValue === undefined || !betAmount) {
        return res.status(400).json({ message: 'All bet fields required' });
    }

    if (betAmount <= 0) {
        return res.status(400).json({ message: 'Invalid bet amount' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user.balance < betAmount) {
        return res.status(400).json({ message: 'Insufficient balance' });
    }

    await prisma.currentRoundBet.create({
        data: {
            userId,
            betType,
            betValue: String(betValue),
            betAmount,
            roundId: gameState.currentRoundId
        }
    });

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            balance: { decrement: betAmount },
            xp: { increment: 1 }
        }
    });

    res.json({
        message: 'Bet placed',
        balance: updatedUser.balance,
        xp: updatedUser.xp
    });
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        database: 'postgresql',
        round: gameState.currentRoundId
    });
});

// Socket.IO
io.on('connection', (socket) => {
    socket.on('register', async (userId) => {
        await prisma.user.update({
            where: { id: userId },
            data: { socketId: socket.id }
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    server.close();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});