require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uaParser = require('ua-parser-js');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3005;

// Enhanced Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Secure CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'https://project-3-front.onrender.com' // YOUR FRONTEND URL
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Pre-flight requests
app.options('*', cors());

// Database Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/project3';

mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Models
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
    console.log('Headers:', req.headers);
    next();
});

// Enhanced Login Route
app.post('/login', async (req, res) => {
    try {
        const userAgent = uaParser(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const browser = userAgent.browser?.name || 'Unknown';
        const os = userAgent.os?.name || 'Unknown';
        const device = userAgent.device?.type || 'desktop';
        const timestamp = new Date();

        console.log('Login attempt:', { browser, os, device, ip });

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
            return res.json({ 
                otpRequired: true, 
                message: 'OTP sent to your email' 
            });
        }

        if (device === 'mobile') {
            const hour = timestamp.getHours();
            if (hour < 10 || hour > 13) {
                return res.status(403).json({ 
                    message: 'Access restricted to 10 AM - 1 PM on mobile devices' 
                });
            }
        }

        res.json({ 
            otpRequired: false, 
            message: 'Login successful' 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// OTP Verification
app.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        
        if (!otp || otp.length !== 6) {
            return res.status(400).json({ 
                message: 'Valid 6-digit OTP is required' 
            });
        }

        const loginAttempt = await Login.findOne({ 
            otp,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (!loginAttempt) {
            return res.status(401).json({ 
                message: 'Invalid or expired OTP' 
            });
        }

        loginAttempt.otp = undefined;
        await loginAttempt.save();

        res.json({ 
            message: 'Login successful' 
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message 
        });
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: err.message
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
