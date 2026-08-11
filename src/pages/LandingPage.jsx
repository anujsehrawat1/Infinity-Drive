import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Shield, Zap, HardDrive, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo-container">
          <Cloud className="logo-icon" size={32} />
          <span className="logo-text">InfinityDrive</span>
        </div>
        <nav className="header-nav">
          {user ? (
            <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={18} /> Go to Dashboard
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => navigate('/login')}>Login</button>
              <button className="btn-primary" onClick={() => navigate('/login')}>Get Started</button>
            </>
          )}
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">Truly Unlimited Storage, Powered by Telegram.</h1>
            <p className="hero-subtitle">
              Experience infinite cloud storage with the speed and security of Telegram's infrastructure.
              No limits, no subscriptions, just pure space.
            </p>
            <div className="hero-actions">
              {user ? (
                <button className="btn-primary btn-large" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <LayoutDashboard size={20} /> Access Dashboard
                </button>
              ) : (
                <button className="btn-primary btn-large" onClick={() => navigate('/login')}>Start Storing Free</button>
              )}
            </div>
          </div>
          <div className="hero-image-wrapper">
            <div className="floating-el el-1"><Cloud size={28} color="#8e44ad" /></div>
            <div className="floating-el el-2"><Shield size={24} color="#3390ec" /></div>
            <div className="floating-el el-3"><HardDrive size={32} color="#e53935" /></div>
            <div className="floating-el el-4"><Zap size={26} color="#fbc02d" /></div>
            <img src="/hero-image.jpg" alt="Infinity Storage" className="hero-img" />
          </div>
        </section>

        <section className="features-section">
          <div className="feature-card card">
            <HardDrive size={40} className="feature-icon" />
            <h3>Infinite Capacity</h3>
            <p>Upload as much as you want. There are no limits on total storage space. It's truly unlimited.</p>
          </div>
          <div className="feature-card card">
            <Zap size={40} className="feature-icon" />
            <h3>Large Files Supported</h3>
            <p>Upload files larger than 4GB. Our advanced chunking technology seamlessly handles massive files.</p>
          </div>
          <div className="feature-card card">
            <Shield size={40} className="feature-icon" />
            <h3>Secure & Private</h3>
            <p>Your files are securely stored in a private, encrypted Telegram channel that only you can access.</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
