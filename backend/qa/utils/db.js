const path = require('path');
const mongoose = require('mongoose');

function loadEnv() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

function getMongoUri() {
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/billing_software'
  );
}

const MONGO_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  maxIdleTimeMS: 45000,
  retryWrites: true,
};

async function connectDb() {
  loadEnv();
  const uri = getMongoUri();
  if (mongoose.connection.readyState === 1) return uri;
  await mongoose.connect(uri, MONGO_OPTIONS);
  return uri;
}

async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { loadEnv, getMongoUri, connectDb, disconnectDb };
