require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uaParser = require('ua-parser-js');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3005;

// Configure allowed origins
const allowedOrigins = [
    'https://project-3-front.onrender.com',
    'http://localhost:5173'
];

// Enhanced CORS configuration
const corsOptions = {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // use same options here!


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/project3';
mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schema
const loginSchema = new mongoose.Schema({
    userAgent: String,
    browser: String,
    os: String,
    device: String,
    ip: String,
    timestamp: Date,
    otp: String
}, { timestamps: true });

const Login = mongoose.model('Login', loginSchema);

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        const userAgent = uaParser(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const browser = userAgent.browser?.name || 'Unknown';
        const os = userAgent.os?.name || 'Unknown';
        const device = userAgent.device?.type || 'desktop';

        console.log('Login attempt from:', { browser, os, device, ip });

        const newLogin = new Login({
            userAgent: req.headers['user-agent'],
            browser,
            os,
            device,
            ip,
            timestamp: new Date()
        });

        await newLogin.save();

        if (browser === 'Chrome') {
            const otp = Math.floor(100000 + Math.random() * 900000);
            await Login.updateOne({ _id: newLogin._id }, { otp });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.RECIPIENT_EMAIL,
                subject: 'Login with OTP',
                text: `Your OTP is ${otp}`
            };

            await transporter.sendMail(mailOptions);
            return res.json({ otpRequired: true, message: 'OTP sent to your email' });
        }

        if (device === 'mobile') {
            const hour = new Date().getHours();
            if (hour < 10 || hour >= 13) {
                return res.status(403).json({ 
                message: 'Access restricted to 10 AM - 1 PM on mobile devices' 
                });
            }
        }

        res.json({ otpRequired: false, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// OTP Verification Route
app.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp || otp.length !== 6) {
            return res.status(400).json({ message: 'Valid 6-digit OTP is required' });
        }

        const loginAttempt = await Login.findOne({ 
            otp,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (!loginAttempt) {
            return res.status(401).json({ message: 'Invalid or expired OTP' });
        }

        await Login.updateOne({ _id: loginAttempt._id }, { $unset: { otp: 1 } });

        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// Start Server
app.listen(port,'0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
