const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uaParser = require('ua-parser-js');
const nodemailer = require('nodemailer');
const cors = require('cors');
const env = require('dotenv')
const app = express();
const port = 3005;

app.use(bodyParser.json());
app.use(cors({ origin: ['http://localhost:5173', 'https://project-3-9922.onrender.com'],
    methds:["GET","POST"]
 }));
 const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL)//mongodb://localhost:27017/yourproject' process.env.MONGO_URL
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

const loginSchema = new mongoose.Schema({
    userAgent: String,
    browser: String,
    os: String,
    device: String,
    ip: String,
    timestamp: Date
});

const Login = mongoose.model('Login', loginSchema);

 const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
         user: 'prasadbhakare.5@gmail.com',
         pass: 'csth lvie sjdr jzlk'
     }
 });

app.post('/login', (req, res) => {
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

    newLogin.save().then(() => {
        if (browser === 'Chrome') {
            const otp = Math.floor(100000 + Math.random() * 900000);

            const mailOptions = {
                from: 'prasadbhakare.5@gmail.com',
                to: 'rushikeshkokate118@gmail.com',
                subject: 'Login with otp',
                text: `Your OTP is ${otp}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return res.status(500).send('Error sending OTP');
                }
                res.send({ otpRequired: true, message: 'OTP sent to your email' });
            });
        } else if (browser === 'Edge' || browser === 'Internet Explorer') {
            res.send({ otpRequired: false, message: 'Login successful' });
        } else if (device === 'mobile') {
            const hour = timestamp.getHours();
            if (hour >= 10 && hour <= 13) {
                res.send({ otpRequired: false, message: 'Login successful' });
            } else {
                res.status(403).send('Access to the website is restricted to 10 AM to 1 PM on mobile devices');
            }
        } else {
            res.send({ otpRequired: false, message: 'Login successful' });
        }
    }).catch((error) => res.status(500).send('Error logging in'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
