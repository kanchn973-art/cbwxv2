// routes/auth.js — Full-featured version with fixed exports and robust cookie handling
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helpers
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendOTPEmail(email, otp) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 OTP GENERATED');
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
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin:0; padding:0; }
          .container { max-width:600px; margin:40px auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg,#667eea 0%,#764ba2 100%); padding:30px; text-align:center; }
          .header h1 { color:#fff; margin:0; font-size:28px; }
          .content { padding:40px 30px; }
          .otp-box { background: linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff; font-size:36px; font-weight:bold; padding:20px; border-radius:10px; text-align:center; margin:30px 0; letter-spacing:8px; }
          .info { color:#666; font-size:14px; line-height:1.6; margin:20px 0; }
          .footer { background:#f8f8f8; padding:20px; text-align:center; color:#999; font-size:12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🎮 CberWinX</h1></div>
          <div class="content">
            <h2 style="color:#333;">Email Verification</h2>
            <p class="info">Use the code below to verify your email:</p>
            <div class="otp-box">${otp}</div>
            <p class="info">This code will expire in <strong>5 minutes</strong>.</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} CberWinX. All rights reserved.</p></div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (err) {
    console.error('❌ Failed to send OTP email:', err?.message || err);
    throw err;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request - CberWinX',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}" style="background:#4CAF50;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error('❌ Failed to send password reset email:', err?.message || err);
    throw err;
  }
}

// ===== HANDLERS =====

// REGISTER
async function register(req, res) {
  try {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be 6+ characters' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });

    if (existing) {
      if (!existing.verified) {
        await prisma.user.delete({ where: { id: existing.id } });
        console.log(`🗑️ Deleted unverified user: ${existing.email}`);
      } else {
        return res.status(400).json({
          message: existing.email === email ? 'Email already registered' : 'Username already taken'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpiration = new Date(Date.now() + 5 * 60 * 1000);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        referralCode: username,
        referredBy: referralCode || null,
        otp,
        otpExpiration,
        verified: false
      }
    });

    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
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

    await sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'Registration successful! Check your email for OTP.',
      email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
}

// VERIFY OTP
async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.status(400).json({ message: 'Already verified' });

    if (new Date() > user.otpExpiration) {
      await prisma.user.delete({ where: { id: user.id } });
      return res.status(400).json({ message: 'OTP expired. Please register again.' });
    }

    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, otp: null, otpExpiration: null }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log(`✅ User ${email} verified and logged in`);

    res.json({
      message: 'Email verified successfully!',
      username: user.username,
      token // optional, useful for API clients
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
}

// LOGIN
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.verified) {
      await prisma.user.delete({ where: { id: user.id } });
      return res.status(403).json({ message: 'Email not verified. Please register again.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log(`✅ User ${email} logged in`);

    res.json({
      message: 'Login successful',
      username: user.username,
      balance: user.balance,
      xp: user.xp,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
}

// LOGOUT
function logout(req, res) {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
}

// RESEND OTP
async function resendOTP(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.status(400).json({ message: 'Already verified' });

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
}

// PASSWORD RESET REQUEST
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.verified) return res.status(400).json({ message: 'User not verified' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiration = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiration }
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'Password reset link sent to email' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// ===== EXPLICIT EXPORTS =====
module.exports = {
  register,
  verifyOTP,
  login,
  logout,
  resendOTP,
  requestPasswordReset
};
