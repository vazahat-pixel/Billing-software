const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middlewares/error.middleware');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        // Allow any localhost port (5173, 5174, 5175, etc.)
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        // Allow Vercel deployments and configured frontend URLs
        if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api', require('./routes/index.js'));

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Billing Software SaaS API is running...' });
});

// Error Handler
app.use(errorHandler);

if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
