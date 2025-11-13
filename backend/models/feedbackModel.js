// models/feedbackModel.js
const mongoose = require('mongoose');

// Define the feedback schema
const feedbackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    dateSubmitted: { type: Date, default: Date.now }
});

// Create the model for feedback
const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
