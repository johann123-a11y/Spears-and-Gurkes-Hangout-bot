const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || '';
    const safeUri = uri.replace(/:([^@]+)@/, ':***@');
    console.log('🔌 Connecting to MongoDB:', safeUri);
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}

module.exports = connectDB;
