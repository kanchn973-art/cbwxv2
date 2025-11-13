const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    utn: { type: String, required: true },
    screenshot: {
        data: { type: String, default: null }, // Allow null for data
        contentType: { type: String, default: null } // Allow null for content type
    },
    checked: { type: Boolean, default: false } // Track if the deposit is checked
});
const Deposit = mongoose.model('Deposit', depositSchema);
module.exports = Deposit;


