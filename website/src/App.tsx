import { useEffect, useState } from 'react';
import { Mic, Sparkles, Zap, Globe, Keyboard, Code, FileText, MessageSquare, Download } from 'lucide-react';
import './index.css';

const DOWNLOAD_URL = 'https://github.com/atlurisatheesh/Speech-flow/releases/latest/download/Speech-Flow.Setup.1.0.0.exe';
const RELEASES_URL = 'https://github.com/atlurisatheesh/Speech-flow/releases/latest';

function App() {
  const [typedText, setTypedText] = useState('');
  const fullText = "Talk to your computer like a person.";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.substring(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    // Try direct download first, fallback to releases page
    const link = document.createElement('a');
    link.href = DOWNLOAD_URL;
    link.download = 'Speech-Flow Setup 1.0.0.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Also open releases page in case direct download doesn't work
    setTimeout(() => {
      window.open(RELEASES_URL, '_blank');
    }, 2000);
  };

  return (
    <>
      <nav>
        <div className="container nav-content">
          <div className="logo">
            <Mic size={24} color="var(--accent-primary)" />
            Speech-Flow
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#apps">Integrations</a>
            <a href="#testimonials">Wall of Love</a>
          </div>
          <button className="btn-secondary" onClick={handleDownload}>
            <Download size={16} />
            Get for Windows
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-glow"></div>
        <div className="container">
          <h1 className="gradient-text">Don't type,<br/>just speak.</h1>
          <p className="typing-text">{typedText}</p>
          <button className="btn-primary" onClick={handleDownload}>
            <Download size={20} />
            Download for Windows
          </button>

          <div className="mockup-container">
            <div className="mockup-widget">
              <div className="mockup-header">
                <span className="mockup-title">Listening...</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="mockup-icon active">
                  <Mic size={18} />
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '20px', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>I need a mobile app, can we build it?</span>
                </div>
                <div className="mockup-icon">
                  <Sparkles size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Made for the way you work.</h2>
          <p style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>Speech-Flow isn't just dictation. It's an AI-powered assistant that formats your thoughts exactly how you intend.</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={32} />
              </div>
              <h3>Progressive Streaming</h3>
              <p>We process your voice in real-time chunks. The moment you stop speaking, your text is already pasted. No waiting.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Globe size={32} />
              </div>
              <h3>Multilingual Mastery</h3>
              <p>Speak in Telugu, Hindi, Tamil, or English. Mix them together. The AI understands context and translates flawlessly.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Sparkles size={32} />
              </div>
              <h3>Voice Profiles</h3>
              <p>Set your tone. Want casual texts for Discord but professional emails for Outlook? Speech-Flow automatically adapts.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="apps" className="apps-showcase">
        <div className="container">
          <h2>Works instantly in all your apps.</h2>
          <p>No integrations required. Just hit Ctrl+Win and start talking anywhere.</p>
          
          <div className="apps-grid">
            <div className="app-icon"><Code color="#3b82f6" /></div>
            <div className="app-icon"><MessageSquare color="#10b981" /></div>
            <div className="app-icon"><FileText color="#6366f1" /></div>
            <div className="app-icon"><Keyboard color="#ec4899" /></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-logo">SPEECH-FLOW</div>
          <button className="btn-primary" onClick={handleDownload} style={{ marginBottom: '40px' }}>
            <Download size={20} />
            Download for Windows
          </button>
          <p style={{ fontSize: '0.9rem' }}>© 2026 Speech-Flow. Built better than the rest.</p>
        </div>
      </footer>
    </>
  );
}

export default App;

