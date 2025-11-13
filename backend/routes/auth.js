// routes/auth.js - FIXED with OTP Console Logging
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

// Send OTP Email with CONSOLE LOGGING FOR TESTING
async function sendOTPEmail(email, otp) {
    // ===== LOG OTP TO CONSOLE FOR TESTING =====
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 OTP GENERATED FOR TESTING');
    console.log(`📧 Email: ${email}`);
    console.log(`🔢 OTP: ${otp}`);
    console.log(`⏰ Expires: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Verification Code - CberWinX',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
                    .header h1 { color: white; margin: 0; font-size: 28px; }
                    .content { padding: 40px 30px; }
                    .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 36px; font-weight: bold; padding: 20px; border-radius: 10px; text-align: center; margin: 30px 0; letter-spacing: 8px; }
                    .info { color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0; }
                    .footer { background: #f8f8f8; padding: 20px; text-align: center; color: #999; font-size: 12px; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎮 CberWinX</h1>
                    </div>
                    <div class="content">
                        <h2 style="color: #333;">Email Verification</h2>
                        <p class="info">You're almost there! Use the code below to verify your email and start playing.</p>
                        
                        <div class="otp-box">${otp}</div>
                        
                        <p class="info">This code will expire in <strong>5 minutes</strong>.</p>
                        
                        <div class="warning">
                            ⚠️ If you didn't request this code, please ignore this email or contact support if you're concerned.
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2024 CberWinX. All rights reserved.</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent successfully to ${email}`);
    } catch (error) {
        console.error(`❌ Failed to send OTP email to ${email}:`, error.message);
        // Don't throw - we've logged the OTP, so user can still proceed
    }
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

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Check existing
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }]
            }
        });

        if (existing) {
            return res.status(400).json({ 
                message: existing.email === email ? 'Email already registered' : 'Username already taken' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate OTP
        const otp = generateOTP();
        const otpExpiration = new Date(Date.now() + 5 * 60 * 1000);

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

        // Send OTP (with console logging)
        await sendOTPEmail(email, otp);

        res.status(201).json({ 
            message: 'Registration successful! Check your email (and console) for OTP.',
            userId: newUser.id 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
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
            return res.status(400).json({ message: 'OTP expired. Request a new one.' });
        }

        // Verify OTP
        if (user.otp !== otp) {
            console.log(`❌ OTP mismatch for ${email}: Expected ${user.otp}, Got ${otp}`);
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

        console.log(`✅ User ${email} verified successfully`);

        res.json({ message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Server error during verification' });
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
            return res.status(403).json({ message: 'Please verify your email first' });
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

        console.log(`✅ User ${email} logged in successfully`);

        res.json({
            message: 'Login successful',
            username: user.username,
            balance: user.balance,
            xp: user.xp
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
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
        console.error('Resend OTP error:', error);
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
        const resetTokenExpiration = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiration
            }
        });

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request - CberWinX',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset</h2>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetLink}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                    <p>This link expires in 1 hour.</p>
                    <p>If you didn't request this, ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Password reset link sent to email' });
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;