// routes/auth.js - Secure Authentication
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate Secure OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Send OTP Email (NO CONSOLE LOGGING)
async function sendOTPEmail(email, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Email Verification</h2>
                <p>Your OTP code is:</p>
                <h1 style="background: #4CAF50; color: white; padding: 15px; border-radius: 5px; display: inline-block;">
                    ${otp}
                </h1>
                <p>This code expires in 5 minutes.</p>
                <p>If you didn't request this, ignore this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Register
exports.register = async (req, res) => {
    try {
        const { username, email, password, referralCode } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be 6+ characters' });
        }

        // Check existing
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }]
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Username or email exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate OTP
        const otp = generateOTP();
        const otpExpiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Create user
        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                referralCode: username,
                referredBy: referralCode || null,
                otp,
                otpExpiration
            }
        });

        // Handle referral
        if (referralCode) {
            const referrer = await prisma.user.findUnique({
                where: { referralCode }
            });

            if (referrer) {
                await prisma.referral.create({
                    data: {
                        userId: referrer.id,
                        referredUsername: username,
                        hasDeposited: false
                    }
                });
            }
        }

        // Send OTP (NO LOGGING)
        try {
            await sendOTPEmail(email, otp);
        } catch (error) {
            console.error('Email send failed');
        }

        res.status(201).json({ 
            message: 'Registration successful. Check your email for OTP.',
            userId: newUser.id 
        });
    } catch (error) {
        console.error('Registration error');
        res.status(500).json({ message: 'Server error' });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.verified) {
            return res.status(400).json({ message: 'Already verified' });
        }

        // Check expiration
        if (new Date() > user.otpExpiration) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        // Verify OTP
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                verified: true,
                otp: null,
                otpExpiration: null
            }
        });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('OTP verification error');
        res.status(500).json({ message: 'Server error' });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check verified
        if (!user.verified) {
            return res.status(403).json({ message: 'Please verify your email' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set secure cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Login successful',
            username: user.username,
            balance: user.balance,
            xp: user.xp
        });
    } catch (error) {
        console.error('Login error');
        res.status(500).json({ message: 'Server error' });
    }
};

// Logout
exports.logout = (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.verified) {
            return res.status(400).json({ message: 'Already verified' });
        }

        const otp = generateOTP();
        const otpExpiration = new Date(Date.now() + 5 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { otp, otpExpiration }
        });

        await sendOTPEmail(email, otp);

        res.json({ message: 'OTP resent successfully' });
    } catch (error) {
        console.error('Resend OTP error');
        res.status(500).json({ message: 'Server error' });
    }
};

// Password Reset Request
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.verified) {
            return res.status(400).json({ message: 'User not verified' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiration
            }
        });

        // Send email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset</h2>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetLink}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Reset Password
                    </a>
                    <p>This link expires in 1 hour.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Password reset link sent to email' });
    } catch (error) {
        console.error('Password reset request error');
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;