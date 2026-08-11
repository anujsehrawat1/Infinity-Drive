import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Key, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { sendCode, signIn, checkPassword, getClient } from '../telegramClient';
import { setupStorageChannel } from '../storageEngine';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const OTP_LENGTH = 5;

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [step, setStep] = useState('phone'); // phone, otp, 2fa
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  
  // OTP state
  const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef([]);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setLoading(true);
    setError('');
    try {
      const hash = await sendCode(phoneNumber);
      setPhoneCodeHash(hash);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    // Auto-focus next input
    if (value !== '' && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  useEffect(() => {
    const fullOtp = otpValues.join('');
    if (fullOtp.length === OTP_LENGTH && step === 'otp') {
      submitOtp(fullOtp);
    }
  }, [otpValues]);

  const submitOtp = async (code) => {
    setLoading(true);
    setError('');
    try {
      let sessionString = '';
      try {
        sessionString = await signIn(phoneNumber, phoneCodeHash, code);
      } catch (err) {
        if (err.message.includes('SESSION_PASSWORD_NEEDED')) {
          setStep('2fa');
          setLoading(false);
          return;
        } else {
          throw err;
        }
      }
      
      await finalizeLogin(sessionString);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const sessionString = await checkPassword(password);
      await finalizeLogin(sessionString);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const finalizeLogin = async (sessionString) => {
    try {
      const tgUserId = "user_" + phoneNumber.replace(/[^0-9]/g, ''); // Basic id generation for DB tracking
      await setupStorageChannel(tgUserId);
      
      let me = {};
      try {
        const client = getClient();
        if (client) me = await client.getMe();
      } catch (e) {
        console.warn("Could not fetch profile info during login", e);
      }
      
      login({ ...me, id: tgUserId, phone: phoneNumber }, sessionString);
      navigate('/dashboard');
    } catch (err) {
      setError("Failed to setup storage: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container card">
        <div className="login-header">
          <div className="login-icon-wrapper">
            {step === 'phone' && <Phone size={32} color="var(--tg-blue)" />}
            {step === 'otp' && <Key size={32} color="var(--tg-blue)" />}
            {step === '2fa' && <ShieldCheck size={32} color="var(--tg-blue)" />}
          </div>
          <h2>
            {step === 'phone' && 'Sign in to Telegram'}
            {step === 'otp' && 'Enter Validation Code'}
            {step === '2fa' && 'Two-Step Verification'}
          </h2>
          <p className="login-subtitle">
            {step === 'phone' && 'Please enter your phone number to proceed.'}
            {step === 'otp' && `We've sent a 5-digit code to ${phoneNumber}.`}
            {step === '2fa' && 'Your account is protected with an additional password.'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="login-forms">
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit}>
              <div className="input-group">
                <input
                  type="tel"
                  className="input-field"
                  placeholder="e.g. +1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary login-btn" disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : <><ArrowRight size={20} /> Continue</>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div className="otp-container">
              <div className="otp-inputs">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={val}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="otp-box"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
              {loading && <div style={{display: 'flex', justifyContent: 'center', marginTop: '20px'}}><Loader2 className="spinner" size={24} color="var(--tg-blue)" /></div>}
            </div>
          )}

          {step === '2fa' && (
            <form onSubmit={handle2faSubmit}>
              <div className="input-group">
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter your Cloud Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary login-btn" disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : <><ArrowRight size={20} /> Verify</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
