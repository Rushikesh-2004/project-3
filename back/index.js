require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uaParser = require('ua-parser-js');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3005;

const allowedOrigins = [
    'https://project-3-front.onrender.com',
    'http://localhost:5173'
];

// CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// OPTIONS preflight handler
app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// DB Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/project3';

mongoose.connect(MONGO_URL, {
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('MongoDB connected'))
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

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        console.log('Login request received');

        const userAgent = uaParser(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const browser = userAgent.browser?.name || 'Unknown';
        const os = userAgent.os?.name || 'Unknown';
        const device = userAgent.device?.type || 'desktop';
        const timestamp = new Date();

        const newLogin = new Login({
            userAgent: req.headers['user-agent'],
            browser,
            os,
            device,
            ip,
            timestamp
        });

        await newLogin.save();

        if (browser === 'Chrome') {
            const otp = Math.floor(100000 + Math.random() * 900000);
            newLogin.otp = otp;
            await newLogin.save();

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
            const hour = timestamp.getHours();
            if (hour < 10 || hour > 13) {
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
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
        res.setHeader('Access-Control-Allow-Credentials', 'true');

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

        loginAttempt.otp = undefined;
        await loginAttempt.save();

        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.json({ 
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        allowedOrigins
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Health check: https://project-3-back-f6yv.onrender.com/health`);
});
