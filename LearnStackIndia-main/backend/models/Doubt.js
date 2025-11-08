// backend/models/Doubt.js
const mongoose = require('mongoose');

// This sub-schema represents a single message in the chat
const doubtMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // We store the role at the time of sending to easily style the chat
    senderRole: {
        type: String,
        enum: ['user', 'mentor', 'admin'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    }
}, {
    timestamps: true // Adds createdAt to each message
});

const doubtSchema = new mongoose.Schema({
    // --- Key Information ---
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        index: true
    },
    title: { // The user's initial question/title
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: 200
    },
    status: {
        type: String,
        enum: ['open', 'answered', 'closed'], // open (user sent), answered (mentor replied), closed (resolved)
        default: 'open',
        index: true
    },
    
    // --- Participants ---
    student: { // The user who created the doubt
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    mentor: { // The mentor who is assigned (e.g., first to reply)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },

    // --- Conversation ---
    messages: [doubtMessageSchema], // The chat history

    // --- Auto-Deletion Logic ---
    closedAt: {
        type: Date,
        default: null
    },
    // This TTL index will automatically delete documents 24 hours
    // AFTER the 'autoDeleteAt' field is set.
    autoDeleteAt: {
        type: Date,
        default: null,
        expires: 86400 // 86400 seconds = 24 hours
    }
}, {
    timestamps: true // Adds createdAt/updatedAt for the whole thread
});

// --- pre-save hook for Auto-Deletion ---
// This logic automatically sets the 24-hour deletion timer
// when the status is changed to 'closed'.
doubtSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        if (this.status === 'closed') {
            const now = new Date();
            this.closedAt = now;
            this.autoDeleteAt = now; // Start the 24-hour timer
        } else {
            // If it's re-opened (e.g., 'open' or 'answered'),
            // clear the deletion timer.
            this.closedAt = null;
            this.autoDeleteAt = null;
        }
    }
    next();
});

module.exports = mongoose.model('Doubt', doubtSchema);
