import React, { useState, useEffect } from 'react';
import './PremiumUserIntro.css';

const PremiumUserIntro = ({ user, onStartConversation, onLoadConversation }) => {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load conversation history when component mounts
  useEffect(() => {
    loadConversationHistory();
  }, []);

  const loadConversationHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:8001/auth/conversation-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setConversationHistory(data.conversations || []);
        } else {
          setError(data.message || 'Failed to load conversation history');
        }
      } else {
        setError('Failed to load conversation history');
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      setError('Failed to load conversation history');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationSelect = (conversationId) => {
    setSelectedConversation(conversationId);
    setSelectedMode(''); // Reset mode when conversation changes
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
  };

  const handleStart = async () => {
    if (selectedConversation && selectedConversation !== 'fresh') {
      // Load conversation context
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('http://localhost:8001/auth/load-conversation-context', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ conversation_id: selectedConversation })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            onLoadConversation(data.conversation, selectedMode);
          } else {
            setError(data.message || 'Failed to load conversation');
          }
        } else {
          setError('Failed to load conversation');
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        setError('Failed to load conversation');
      }
    } else {
      // Start fresh conversation
      onStartConversation(selectedMode);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="premium-user-intro">
      <div className="intro-header">
        <h2>Welcome back, {user.first_name}! 👋</h2>
        <p className="intro-subtitle">
          As a <strong>Premium member</strong>, you can continue previous conversations or start fresh.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Conversation Selection */}
      <div className="conversation-selection">
        <h3>Choose Your Conversation</h3>
        <div className="conversation-dropdown">
          <select 
            value={selectedConversation} 
            onChange={(e) => handleConversationSelect(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a conversation...</option>
            <option value="fresh">🆕 Start Fresh Conversation</option>
            {conversationHistory.map(conv => (
              <option key={conv.id} value={conv.id}>
                {conv.title} - {formatDate(conv.last_updated)}
              </option>
            ))}
          </select>
        </div>

        {selectedConversation && (
          <div className="conversation-preview">
            {selectedConversation === 'fresh' ? (
              <div className="fresh-conversation">
                <h4>🆕 New Consultation</h4>
                <p>Start a completely new immigration consultation with Sarah.</p>
              </div>
            ) : (
              <div className="previous-conversation">
                {conversationHistory.find(c => c.id === selectedConversation) && (
                  <>
                    <h4>📋 {conversationHistory.find(c => c.id === selectedConversation).title}</h4>
                    <p><strong>From:</strong> {conversationHistory.find(c => c.id === selectedConversation).origin_country}</p>
                    <p><strong>To:</strong> {conversationHistory.find(c => c.id === selectedConversation).destination_country}</p>
                    <p><strong>Goal:</strong> {conversationHistory.find(c => c.id === selectedConversation).immigration_goal}</p>
                    <p><strong>Preview:</strong> {conversationHistory.find(c => c.id === selectedConversation).preview}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mode Selection */}
      {selectedConversation && (
        <div className="mode-selection">
          <h3>Select Your Mode</h3>
          <div className="mode-pills">
            <button 
              className={`mode-pill ${selectedMode === 'qa' ? 'active' : ''}`}
              onClick={() => handleModeSelect('qa')}
            >
              <span className="mode-icon">💬</span>
              <div className="mode-content">
                <h4>Q&A Mode</h4>
                <p>Interactive conversation with Sarah</p>
              </div>
            </button>
            
            <button 
              className={`mode-pill ${selectedMode === 'pdf' ? 'active' : ''}`}
              onClick={() => handleModeSelect('pdf')}
            >
              <span className="mode-icon">📄</span>
              <div className="mode-content">
                <h4>PDF Consultation</h4>
                <p>Generate comprehensive immigration report</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Start Button */}
      {selectedConversation && selectedMode && (
        <div className="start-section">
          <button 
            className="start-button"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? 'Loading...' : 
             selectedConversation === 'fresh' ? 
             (selectedMode === 'qa' ? 'Start Q&A Session' : 'Start PDF Consultation') :
             (selectedMode === 'qa' ? 'Continue Q&A' : 'Generate PDF Report')
            }
          </button>
        </div>
      )}

      {/* Premium Features */}
      <div className="premium-features">
        <h3>Your Premium Benefits</h3>
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <span>Unlimited consultations</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📚</span>
            <span>Access to conversation history</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <span>Sarah AI Avatar</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📄</span>
            <span>PDF report generation</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumUserIntro; 