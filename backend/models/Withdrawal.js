const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    checked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
module.exports = Withdrawal;
