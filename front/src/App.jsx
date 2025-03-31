// src/App.js
import React, { useState } from 'react';
import axios from 'axios';

function App() {
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = () => {
        //axios.defaults.withCredentials = true; 
        axios.post('http://localhost:3005/login')
            .then(response => {
                if (response.data.otpRequired) {
                    setOtpSent(true);
                    setMessage(response.data.message);
                } else {
                    setMessage(response.data.message);
                }
            })
            .catch(error => {
                setMessage(error.response.data);
            });
    };

    const handleOtpSubmit = () => {
        setMessage('Login successful');
    };

    return (
        <div className="App">
            <h1>Login</h1>
            {otpSent ? (
                <div>
                    <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter OTP"
                    />
                    <button onClick={handleOtpSubmit}>Submit OTP</button>
                </div>
            ) : (
                <button onClick={handleLogin}>Login</button>
            )}
            <p>{message}</p>
        </div>
    );
}

export default App;
