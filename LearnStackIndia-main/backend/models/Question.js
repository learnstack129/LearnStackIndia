// backend/models/Question.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: [true, 'Question text is required']
    },
    options: [{
        type: String,
        required: true
    }],
    correctAnswerIndex: {
        type: Number,
        required: true
    },
    timeLimit: {
        type: Number, // Time limit in seconds
        required: [true, 'A per-question time limit is required'],
        min: 10 // Minimum 10 seconds
    },
    createdBy: { // The mentor who created it
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Question', questionSchema);
