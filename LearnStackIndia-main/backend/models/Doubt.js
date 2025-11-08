// backend/models/Doubt.js
const mongoose = require('mongoose');

// Sub-schema for individual messages in the thread
const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // To easily show "by Mentor" or "by [username]"
    senderRole: {
        type: String,
        enum: ['user', 'mentor'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt for each message
});

const doubtSchema = new mongoose.Schema({
    // --- Core Info ---
    user: { // The student who asked
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    subject: { // The subject it's related to (e.g., "DSA Visualizer")
        type: String,
        required: true,
        index: true
    },
    title: { // The initial question/subject line
        type: String,
        required: [true, 'A title for the doubt is required.'],
        trim: true
    },
    
    // --- Conversation Thread ---
    messages: [messageSchema], // The array of back-and-forth messages

    // --- State Management ---
    status: {
        type: String,
        enum: ['open', 'finished'],
        default: 'open',
        index: true
    },
    lastReplier: { // To track who last replied (for UI notifications)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // --- TTL / Auto-Delete ---
    finishedAt: {
        type: Date
    },
    // This index will automatically delete documents 24 hours (86400s)
    // after the 'finishedAt' field is set.
    expireAt: {
        type: Date,
        // Create a TTL index. MongoDB will automatically delete documents
        // where 'expireAt' is in the past.
        index: { expires: '24h' }
    }
}, {
    timestamps: true // Adds createdAt and updatedAt for the whole thread
});

// When 'status' is set to 'finished', set the 'expireAt' field.
doubtSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'finished') {
        const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        this.finishedAt = new Date();
        // Set the expireAt field. MongoDB's TTL index will handle the deletion.
        this.expireAt = twentyFourHoursFromNow;
        console.log(`[Doubt Model] Marking doubt ${this._id} as 'finished'. It will expire at ${this.expireAt}.`);
    }
    next();
});

module.exports = mongoose.model('Doubt', doubtSchema);
