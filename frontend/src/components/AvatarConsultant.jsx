import React, { useState, useEffect } from 'react'
import './AvatarConsultant.css'

const AvatarConsultant = ({ isTyping, onAvatarClick, currentMessage, isWelcoming }) => {
  const [isAnimating, setIsAnimating] = useState(false)
  
  useEffect(() => {
    if (isTyping) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isTyping])

  return (
    <div className="avatar-consultant-container">
      <div className="consultant-info">
        <div className="consultant-badge">
          <span className="consultant-title">Licensed Immigration Consultant</span>
          <span className="consultant-name">Sarah Martinez, Esq.</span>
        </div>
      </div>
      
      <div className={`avatar-container ${isAnimating ? 'speaking' : ''} ${isWelcoming ? 'welcoming' : ''}`}>
        <div className="avatar-image-container">
          {/* Professional female avatar */}
          <div className="avatar-image">
            <div className="avatar-face">
              <div className="avatar-hair"></div>
              <div className="avatar-face-shape">
                <div className="avatar-eyes">
                  <div className="eye left-eye">
                    <div className="pupil"></div>
                  </div>
                  <div className="eye right-eye">
                    <div className="pupil"></div>
                  </div>
                </div>
                <div className="avatar-nose"></div>
                <div className={`avatar-mouth ${isTyping ? 'talking' : ''}`}></div>
              </div>
            </div>
            <div className="avatar-body">
              <div className="avatar-suit"></div>
              <div className="avatar-lapels"></div>
            </div>
          </div>
          
          {/* Thinking indicator */}
          {isTyping && (
            <div className="thinking-indicator">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          {/* Status indicators */}
          <div className="status-indicators">
            <div className="online-indicator">
              <div className="pulse-dot"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
        
        {/* Interactive elements */}
        <div className="avatar-interactions">
          <button 
            className="avatar-clickable"
            onClick={onAvatarClick}
            title="Click to get started"
          >
            <span className="interaction-hint">👋 Click to start consultation</span>
          </button>
        </div>
      </div>
      
      {/* Professional credentials */}
      <div className="credentials">
        <div className="credential-item">
          <span className="credential-icon">🎓</span>
          <span>Harvard Law School</span>
        </div>
        <div className="credential-item">
          <span className="credential-icon">⚖️</span>
          <span>15+ Years Experience</span>
        </div>
        <div className="credential-item">
          <span className="credential-icon">🌟</span>
          <span>98% Success Rate</span>
        </div>
      </div>
    </div>
  )
}

export default AvatarConsultant 