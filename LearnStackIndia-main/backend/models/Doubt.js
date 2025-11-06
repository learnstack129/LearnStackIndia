// backend/models/Doubt.js
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isMentor: { // To easily identify mentor replies
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const doubtSchema = new mongoose.Schema({
    subject: { // e.g., "DSA Visualizer", "C Programming"
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: [true, 'A title is required for the doubt'],
        trim: true
    },
    questionText: {
        type: String,
        required: [true, 'Question text is required']
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    replies: [replySchema],
    isResolved: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Doubt', doubtSchema);
