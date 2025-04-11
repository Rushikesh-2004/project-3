// src/App.js
import React, { useState } from 'react';
import axios from 'axios';

function App() {
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Use environment variable for backend URL
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3005';

    const handleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await axios.post(`${API_BASE_URL}/login`);
            if (response.data.otpRequired) {
                setOtpSent(true);
                setMessage(response.data.message);
            } else {
                setMessage(response.data.message);
                // Here you would typically redirect on successful login
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpSubmit = async () => {
        if (!otp.trim()) {
            setError('Please enter OTP');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const response = await axios.post(`${API_BASE_URL}/verify-otp`, { otp });
            setMessage(response.data.message);
            // Here you would typically:
            // 1. Store authentication token
            // 2. Redirect to dashboard
        } catch (error) {
            setError(error.response?.data?.message || 'OTP verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="App" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center' }}>Login</h1>
            
            {error && (
                <div style={{ 
                    color: 'red', 
                    padding: '10px', 
                    margin: '10px 0',
                    border: '1px solid red',
                    borderRadius: '4px'
                }}>
                    {error}
                </div>
            )}
            
            {message && (
                <div style={{ 
                    color: 'green', 
                    padding: '10px', 
                    margin: '10px 0',
                    border: '1px solid green',
                    borderRadius: '4px'
                }}>
                    {message}
                </div>
            )}

            {otpSent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter OTP"
                        style={{ 
                            padding: '10px',
                            fontSize: '16px',
                            borderRadius: '4px',
                            border: '1px solid #ccc'
                        }}
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleOtpSubmit}
                        disabled={isLoading || !otp.trim()}
                        style={{
                            padding: '10px',
                            backgroundColor: isLoading ? '#ccc' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {isLoading ? 'Verifying...' : 'Submit OTP'}
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleLogin}
                    disabled={isLoading}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: isLoading ? '#ccc' : '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        width: '100%'
                    }}
                >
                    {isLoading ? 'Processing...' : 'Login'}
                </button>
            )}
        </div>
    );
}

export default App;
