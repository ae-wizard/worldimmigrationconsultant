import React from 'react'
import './App.css'

function AppMinimal() {
  return (
    <div className="app">
      <div className="app-background">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <span className="flag-icon">🌍</span>
            <h1>World Immigration Consultant</h1>
            <span className="brand-tagline">Global Immigration Made Simple</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="consultation-container">
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <h2>🎉 Minimal App is Working!</h2>
            <p>If you see this, React is working fine.</p>
            <p>The issue is in one of the complex components.</p>
            <br />
            <div>
              <button style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '25px',
                cursor: 'pointer',
                fontWeight: '600'
              }}>
                ✅ Test Button
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-links">
            <span>🧪 Minimal Test Version</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppMinimal 