// backend/models/DailyProblem.js
const mongoose = require('mongoose');

const dailyProblemSchema = new mongoose.Schema({
    subject: { // e.g., "DSA Visualizer", "C Programming"
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: { // The problem statement (supports markdown)
        type: String,
        required: true
    },
    boilerplateCode: { // Mentor-provided starter code
        type: String,
        default: ''
    },
    solutionCode: { // Mentor-provided correct solution
        type: String,
        required: true
    },
    language: { // OneCompiler language name
        type: String,
        required: true,
        default: 'javascript' // e.g., "javascript", "python", "c", "cpp"
    },
    testCases: [{ // Hidden test cases
        input: { type: String, default: "" }, // stdin
        expectedOutput: { type: String, required: true, trim: true }
    }],
    
    // --- *** MODIFICATION START *** ---
    // Replaced pointsForAttempt with a tiered system
    pointsFirstAttempt: { // Points for getting it right on the 1st run
        type: Number,
        default: 20,
        min: 0
    },
    pointsSecondAttempt: { // Points for getting it right on the 2nd run
        type: Number,
        default: 15,
        min: 0
    },
    pointsOnFailure: { // Points for failing both attempts
        type: Number,
        default: 10,
        min: 0
    },
    // --- *** MODIFICATION END *** ---

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: { // Toggled by mentor
        type: Boolean,
        default: false,
        index: true
    }
}, { timestamps: true });

// Index for finding the active problem for a subject quickly
dailyProblemSchema.index({ subject: 1, isActive: 1 });

module.exports = mongoose.model('DailyProblem', dailyProblemSchema);
