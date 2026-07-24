const mongoose = require('mongoose');

async function waitForMongo(timeoutMs = 25000) {
  const start = Date.now();
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('MongoDB connection timeout — start MongoDB or set MONGO_URI');
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function unwrapBody(res) {
  const body = res.body;
  if (body && body.data !== undefined) return body.data;
  return body;
}

module.exports = { waitForMongo, authHeader, unwrapBody };
