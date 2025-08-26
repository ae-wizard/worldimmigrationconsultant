import React, { useState, useEffect } from 'react';
import './AIAvatar.css';

const AIAvatar = ({ isTyping = false, isSpeaking = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentExpression, setCurrentExpression] = useState('neutral');

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setIsVisible(true), 500);
  }, []);

  useEffect(() => {
    if (isSpeaking) {
      setCurrentExpression('speaking');
    } else if (isTyping) {
      setCurrentExpression('thinking');
    } else {
      setCurrentExpression('neutral');
    }
  }, [isTyping, isSpeaking]);

  // Use the actual uploaded image from the user
  const avatarImageUrl = "/sarah-avatar.png"; // User's uploaded image in public directory
  
  return (
    <div className={`ai-avatar-container ${isVisible ? 'visible' : ''} ${isTyping ? 'thinking' : ''}`}>
      <div className="avatar-glow"></div>
      
      <div className="ai-avatar-frame">
        <div className="avatar-placeholder">
          <div className="placeholder-avatar">
            {/* User's Professional Avatar Image */}
            <img 
              src={avatarImageUrl}
              alt="Sarah Martinez - Immigration Consultant"
              className="avatar-image professional"
            />
            <div className={`expression-overlay ${currentExpression}`}></div>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="avatar-status">
          {isTyping && (
            <div className="status-badge thinking">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Sarah is typing...</span>
            </div>
          )}
          
          {isSpeaking && (
            <div className="status-badge speaking">
              <div className="sound-waves">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Speaking</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Name and credentials - simplified */}
      <div className="avatar-info">
        <h3 className="avatar-name">Sarah Martinez</h3>
        <p className="avatar-title">Immigration Consultant</p>
      </div>
    </div>
  );
};

export default AIAvatar; 