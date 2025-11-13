const express = require('express');
const { check, validationResult } = require('express-validator'); // Import check and validationResult
const router = express.Router();
require('dotenv').config();

const User = require('../models/User'); // Import the User model
const moment = require('moment');

// Verify OTP
router.post('/verify-otp', [
    check('email', 'Please include a valid email').isEmail(),
    check('otp', 'OTP is required').exists().isLength({ min: 6, max: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Check if OTP is expired
        if (moment().isAfter(user.otpExpiration)) {
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Check if OTP is correct
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Mark the user as verified
        user.verified = true;
        user.otp = null; // Clear OTP after verification
        user.otpExpiration = null; // Clear OTP expiration
        await user.save();

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
