const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/dsa-visualizer';
    
    const conn = await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('📄 Server will continue without database (some features disabled)');
    return false;
  }
};

module.exports = connectDB;