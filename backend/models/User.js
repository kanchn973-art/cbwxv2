const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const moment = require('moment');
require('dotenv').config();
const crypto = require('crypto');
// Profile Schema: To store profile information including the profile picture
const profileSchema = new mongoose.Schema({
    pictureName: { type: String, default: '1' }, // Default profile picture name
}, { timestamps: true });

// Transaction Schema: To track deposit, withdrawal, and reward transactions
const transactionSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['Deposit', 'Withdraw', 'Reward', 'Referral Reward'], required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

// Bet Schema: Tracking the bets
const betSchema = new mongoose.Schema({
    betType: { type: String, enum: ['color', 'size', 'number'], required: true },
    betValue: { type: mongoose.Schema.Types.Mixed, required: true },
    betAmount: { type: Number, required: true, min: 0 },
    win: { type: Boolean, default: false },
    payoutAmount: { type: Number, default: 0, min: 0 },
    roundId: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Reward Schema to track unlocked and claimed rewards
const rewardSchema = new mongoose.Schema({
    xpRequired: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    claimed: { type: Boolean, default: false }
}, { timestamps: true });

// First Deposit Reward Schema
const firstDepositRewardSchema = new mongoose.Schema({
    rewardAmount: { type: Number, default: 25 }, // First deposit reward amount
    claimed: { type: Boolean, default: false }
}, { timestamps: true });

// User Schema: Holds user details, balance, transactions, bets, XP, and rewards
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, unique: true }, // Referral code is the same as the username
    referredBy: { type: String, default: null }, // Stores the username of the referrer
    referrals: [
        {
            referredUsername: { type: String }, // Referred user's username
            hasDeposited: { type: Boolean, default: false } // Tracks if the user has deposited
        }
    ],
    xp: { type: Number, default: 0 }, // Tracks user XP
    rewards: [rewardSchema], // Rewards unlocked by XP milestones
    firstDepositReward: firstDepositRewardSchema, // First deposit reward
    transactions: [transactionSchema],
    bets: [betSchema], // Historical bets
    currentRoundBets: [betSchema], // To hold bets for the current round
    profile: profileSchema, // Embed the profile schema
    notifications: [{
        message: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }],
    firstDeposit: { type: Boolean, default: false },
    verified: { type: Boolean, default: false }, // Track if the user is verified
    otp: { type: String }, // Store OTP
    otpExpiration: { type: Date }, // Store OTP expiration time // Track if the user made a first deposit
    resetToken: {type: String},
    resetTokenExpiration: { type: Date }
}, { timestamps: true });

// Reward XP Milestones
const xpMilestones = [
    { xp: 0, reward: 25},
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

// Indexes for better query performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

// Pre-save hook to ensure a default profile is set
userSchema.pre('save', function (next) {
    if (!this.profile || typeof this.profile !== 'object') {
        this.profile = { pictureName: '1' };
    }
    next();
});

// Method to send OTP to user (for verification)
userSchema.methods.sendOTP = function () {
    return new Promise((resolve, reject) => {
        try {
            // Generate a random OTP (6 digits)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            // Set OTP expiration to 5 minutes from now
            const otpExpiration = moment().add(5, 'minutes').toDate();
            
            // Save OTP and expiration time
            this.otp = otp;
            this.otpExpiration = otpExpiration;

            // Set up transporter to use Gmail SMTP
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER, // Use environment variable
                    pass: process.env.EMAIL_PASS // Use environment variable
                }
            });

// Define email options
const mailOptions = {
    from: process.env.EMAIL_USER,
    to: this.email, // Recipient email (user's email)
    subject: 'Your OTP Verification Code',
    html: `
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 20px;
                    }
                    .email-container {
                        background-color: #ffffff;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        padding: 30px;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    h1 {
                        font-size: 24px;
                        color: #333333;
                        margin-bottom: 10px;
                    }
                    p {
                        font-size: 16px;
                        color: #666666;
                    }
                    .otp-code {
                        display: inline-block;
                        font-size: 40px;
                        font-weight: bold;
                        color: #ffffff;
                        background-color: #4CAF50; /* Green color */
                        padding: 10px 20px;
                        border-radius: 8px;
                        margin-top: 20px;
                    }
                    .footer {
                        font-size: 12px;
                        color: #999999;
                        margin-top: 30px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <h1>Your OTP Verification Code</h1>
                    <p>Dear user,</p>
                    <p>We have received a request to verify your identity. Please use the OTP code below to complete the process:</p>
                    <div class="otp-code">${otp}</div>
                    <p>This OTP code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
                    <div class="footer">
                        <p>Thank you for using our service!</p>
                        <p>If you have any questions, feel free to contact our support team.</p>
                    </div>
                </div>
            </body>
        </html>
    `
};

            // Send the email with the OTP
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    reject(`Error sending OTP email: ${error.message}`);
                } else {
                    this.save()
                        .then(() => resolve(otp)) // Return OTP (you may want to remove this in production)
                        .catch(reject);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Method to verify OTP and set user as verified
userSchema.methods.verifyOTP = function (enteredOtp) {
    return new Promise((resolve, reject) => {
        try {
            // Check if OTP is expired
            if (moment().isAfter(this.otpExpiration)) {
                reject('OTP has expired');
            }

            // Check if entered OTP matches stored OTP
            if (this.otp === enteredOtp) {
                this.verified = true; // Set the user as verified
                this.save()
                    .then(() => resolve('User successfully verified'))
                    .catch(reject);
            } else {
                reject('Invalid OTP');
            }
        } catch (error) {
            reject(error);
        }
    });
};
// Add this method to generate reset token and expiration
userSchema.methods.generatePasswordResetToken = function () {
    return new Promise((resolve, reject) => {
        try {
            // Create a unique token using crypto
            const resetToken = crypto.randomBytes(20).toString('hex');
            const resetTokenExpiration = Date.now() + 3600000; // Token expires in 1 hour

            // Set the token and expiration in the user object
            this.resetToken = resetToken;
            this.resetTokenExpiration = resetTokenExpiration;

            // Save the user with the reset token
            this.save()
                .then(() => resolve(resetToken)) // Return the token (useful for sending it in the email)
                .catch(reject);
        } catch (error) {
            reject(error);
        }
    });
};
// Static method to add XP for bets
userSchema.statics.addXPForBet = async function (userId, betAmount) {
    try {
        const user = await this.findById(userId);
        if (!user) throw new Error('User not found');

        const xpToAdd = Math.floor(betAmount / 10); // Add XP based on bet amount
        user.xp += xpToAdd;

        await user.save();
        return user;
    } catch (error) {
        throw new Error(`Error adding XP for bet for user ${userId}: ${error.message}`);
    }
};
userSchema.methods.checkAndUnlockRewards = function () {
    if (!this.firstDeposit) {
        console.log('Rewards can only be unlocked after the first deposit.');
        return; // Exit early if first deposit hasn't been made
    }

    xpMilestones.forEach(milestone => {
        if (this.xp >= milestone.xp && !this.rewards.some(reward => reward.xpRequired === milestone.xp)) {
            this.rewards.push({ xpRequired: milestone.xp, rewardAmount: milestone.reward });
        }
    });
};


// Static method to add a bet for the current round and increase XP
userSchema.statics.addCurrentRoundBet = async function (userId, betType, betValue, betAmount, roundId) {
    try {
        const user = await this.findById(userId);
        if (!user) throw new Error('User not found');

        const newBet = { betType, betValue, betAmount, roundId };
        
        user.currentRoundBets.push(newBet);
        user.balance -= betAmount;
        
        user.xp += 1; // Increment XP by 1 for each bet placed
        user.checkAndUnlockRewards(); // Check for new rewards based on XP
        
        await user.save();
        return user;
    } catch (error) {
        throw new Error(`Error adding bet for user ${userId}: ${error.message}`);
    }
};

// Method to claim a reward
userSchema.methods.claimReward = async function (xpRequired) {
     if (!this.firstDeposit) {
        throw new Error('Rewards can only be claimed after the first deposit.');
    }
    const reward = this.rewards.find(reward => reward.xpRequired === xpRequired && !reward.claimed);
    if (reward) {
        reward.claimed = true;
        this.balance += reward.rewardAmount;
        this.transactions.push({ amount: reward.rewardAmount, type: 'Reward' });
        await this.save();
        return reward.rewardAmount;
    }
    throw new Error('Reward not found or already claimed');
};

userSchema.statics.handleFirstDeposit = async function (referredUsername) {
    try {
        const referredUser = await this.findOne({ username: referredUsername });
        if (!referredUser) throw new Error('Referred user not found');

        // Mark the referred user as having made their first deposit
        referredUser.firstDeposit = true;
        await referredUser.save();

        // Check if the referred user was referred by someone
        if (referredUser.referredBy) {
            let currentUser = referredUser;
            while (currentUser.referredBy) {
                const referrer = await this.findOne({ username: currentUser.referredBy });
                if (!referrer) throw new Error('Referrer not found');

                // Update the referral status in the referrer's referrals array
                const referral = referrer.referrals.find(r => r.referredUsername === currentUser.username);
                if (referral) {
                    referral.hasDeposited = true;
                }

                // Add a reward for the referrer
                referrer.referralRewards.push({
                    rewardAmount: 5, // ₹5 reward
                    referredUsername: currentUser.username
                });

                referrer.balance += 5; // Add reward directly to balance
                referrer.transactions.push({
                    amount: 5,
                    type: 'Reward'
                });

                await referrer.save();

                // Move to the next referrer in the chain
                currentUser = referrer;
            }
        }
    } catch (error) {
        throw new Error(`Error handling first deposit: ${error.message}`);
    }
};

// Static method to update a bet's result after the game ends
userSchema.statics.updateBetResult = async function (userId, betId, winning, payoutAmount) {
    try {
        if (payoutAmount < 0) throw new Error('Payout amount cannot be negative');
        
        const user = await this.findOneAndUpdate(
            { _id: userId, 'currentRoundBets._id': betId },
            {
                $set: { 'currentRoundBets.$.win': winning, 'currentRoundBets.$.payoutAmount': payoutAmount },
                $inc: { balance: winning ? payoutAmount : 0 }
            },
            { new: true, runValidators: true }
        );
        if (!user) throw new Error('User or bet not found');
        
        return user;
    } catch (error) {
        throw new Error(`Error updating bet result for user ${userId}: ${error.message}`);
    }
};
userSchema.statics.handleReferral = async function (referrerCode, newUser) {
    try {
        const referrer = await this.findOne({ referralCode: referrerCode });
        if (!referrer) throw new Error('Invalid referral code');

        // Update the referredBy field for the new user
        newUser.referredBy = referrer.username;

        // Add the new user to the referrer's referrals array
        referrer.referrals.push({
            referredUsername: newUser.username,
            hasDeposited: false
        });

        // Save both users
        await referrer.save();
        await newUser.save();
    } catch (error) {
        throw new Error(`Error handling referral: ${error.message}`);
    }
};


// Model Creation
const User = mongoose.model('User', userSchema);

module.exports = User;
