/*
  net start MongoDB
  npm run seed:topics
  npm run seed:achievements

  4. Start the server
  npm run dev
*/

// server.js - Fixed with proper model integration and routes
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import database connection
const connectDB = require('./config/database');

// Load environment variables first
dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
// Apply limiter more broadly if needed, e.g., app.use(limiter);
// Or keep it specific to /api/ routes
app.use('/api/', limiter);

// CORS middleware
app.use(cors({
  origin: true, // This will reflect the request origin, which is safe
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running!',
    timestamp: new Date().toISOString(),
    mongodb: require('mongoose').connection.readyState === 1 ? 'Connected' : 'Disconnected',
    node_env: process.env.NODE_ENV || 'development'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    mongodb: require('mongoose').connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// --- ADJUSTED Route Imports ---
const achievementsModule = require('./routes/achievements'); // Import the router directly

app.use('/api/auth', require('./routes/auth'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/achievements', achievementsModule); // <-- FIXED LINE
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/admin', require('./routes/admin')); // Mount admin routes under /api/admin
app.use('/api/mentor', require('./routes/mentor')); // <-- ADD THIS NEW MENTOR ROUTE
app.use('/api/test', require('./routes/test'));

// --- END ADJUSTED Route Imports ---

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  console.error('Stack trace:', err.stack);

  // Default error message
  let errorMessage = 'Something went wrong!';
  let statusCode = 500;

  // Handle specific error types if needed (e.g., CastError from Mongoose)
  if (err.name === 'CastError') {
    errorMessage = `Invalid format for parameter: ${err.path}`;
    statusCode = 400;
  } else if (err.name === 'ValidationError') {
    errorMessage = `Validation Failed: ${Object.values(err.errors).map(e => e.message).join(', ')}`;
    statusCode = 400;
  }
  // Add more specific error handling as needed

  res.status(statusCode).json({
    message: errorMessage,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableBaseRoutes: [
      '/api/health',
      '/api/test',
      '/api/auth/...',
      '/api/topics/...',
      '/api/achievements/...',
      '/api/leaderboard/...',
      '/api/admin/...',
      '/api/mentor/...', 
      '/api/test/...'
    ]
  });
});

// Start server
const PORT = process.env.PORT || 5000;



// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Promise Rejection:', err);
  // Consider graceful shutdown in production
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  // Consider graceful shutdown in production
  process.exit(1);
});

connectDB();

module.exports = app; // Export app for potential testing

