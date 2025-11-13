const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    roundId: { type: Number, unique: true, required: true },
    number: { type: Number, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    totalBets: { type: Number, default: 0 }, // To store total bets for this game round
    winners: { type: Number, default: 0 },   // To store number of winners for this game round
}, { timestamps: true });

const History = mongoose.model('History', historySchema);

module.exports = History;
