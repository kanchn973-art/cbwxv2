const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
require('dotenv').config();
const bcrypt = require('bcryptjs');

const User = require('../models/User');  // Assuming your user model is in models/user.js

router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'No user found with that email address' });
        }

        if (!user.verified) {
            return res.status(400).json({ message: 'User is not verified' });
        }

        // Generate password reset token and expiration
        const resetToken = await user.generatePasswordResetToken();

        // Send email with reset link
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const resetLink = `https://cberwinx-reset-password-ljh8.onrender.com/reset-password/${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You have requested to reset your password. Click the following link to reset it: ${resetLink}. This link will expire in 1 hour.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(500).json({ message: 'Error sending email' });
            }
            res.status(200).json({ message: 'Password reset email sent successfully' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An unexpected error occurred' });
    }
});

module.exports = router;
