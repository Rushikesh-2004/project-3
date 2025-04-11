require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uaParser = require('ua-parser-js');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://your-frontend-url.onrender.com' // ADD YOUR DEPLOYED FRONTEND URL HERE
    ],
    methods: ["GET", "POST"],
    credentials: true
}));

// Database Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/project3';

mongoose.connect(MONGO_URL)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// Models
const loginSchema = new mongoose.Schema({
    userAgent: String,
    browser: String,
    os: String,
    device: String,
    ip: String,
    timestamp: Date,
    otp: String
});

const Login = mongoose.model('Login', loginSchema);

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Routes
app.post('/login', async (req, res) => {
    try {
        const userAgent = uaParser(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const browser = userAgent.browser.name;
        const os = userAgent.os.name;
        const device = userAgent.device.type || 'desktop';
        const timestamp = new Date();

        const newLogin = new Login({
            userAgent: req.headers['user-agent'],
            browser: browser,
            os: os,
            device: device,
            ip: ip,
            timestamp: timestamp
        });

        await newLogin.save();

        if (browser === 'Chrome') {
            const otp = Math.floor(100000 + Math.random() * 900000);
            
            // Save OTP to database for verification
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

app.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ message: 'OTP is required' });
        }

        // Find the most recent login attempt with this OTP
        const loginAttempt = await Login.findOne({ 
            otp,
            timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // OTP valid for 15 mins
        }).sort({ timestamp: -1 });

        if (!loginAttempt) {
            return res.status(401).json({ message: 'Invalid or expired OTP' });
        }

        // Clear OTP after successful verification
        loginAttempt.otp = undefined;
        await loginAttempt.save();

        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
