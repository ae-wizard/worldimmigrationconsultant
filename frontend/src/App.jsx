import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import WorldwideChat from './components/WorldwideChat'
import AvatarSarah from './components/AvatarSarah'
import LeadForm from './components/LeadForm'
import SecureAdminPanel from './components/SecureAdminPanel'
import UserAuth from './components/UserAuth'
import UserProfile from './components/UserProfile'
import LanguageSelector from './components/LanguageSelector'
import PDFReportGenerator from './components/PDFReportGenerator'
import PremiumUserIntro from './components/PremiumUserIntro'
import './App.css'

function App() {
  // Authentication state
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  // Chat and avatar state
  const [isAvatarTyping, setIsAvatarTyping] = useState(false)
  const [avatarReady, setAvatarReady] = useState(false)
  const [avatarMode, setAvatarMode] = useState('initializing') // 'initializing', 'ready', 'fallback'
  const [currentSpeechText, setCurrentSpeechText] = useState('')
  const [conversationStarted, setConversationStarted] = useState(false)
  const [avatarPersistentState, setAvatarPersistentState] = useState({
    isConnected: false,
    sessionId: null,
    lastSpeechText: null
  })

  // Form states
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [showPDFGenerator, setShowPDFGenerator] = useState(false)
  const [consultationData, setConsultationData] = useState({})

  // Premium user intro states
  const [showPremiumIntro, setShowPremiumIntro] = useState(false)
  const [selectedMode, setSelectedMode] = useState('')
  const [loadedConversation, setLoadedConversation] = useState(null)

  // Check for authentication state changes
  useEffect(() => {
    const checkAuthState = () => {
      const token = localStorage.getItem('authToken');
      const userInfo = localStorage.getItem('userInfo');
      
      if (token && userInfo && !user) {
        try {
          const userData = JSON.parse(userInfo);
          console.log('🔐 [App] User authenticated via localStorage:', userData.email);
          setUser(userData);
          console.log('🤖 [App] Maintaining avatar connection after authentication');
        } catch (error) {
          console.error('Error parsing user info:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('userInfo');
        }
      } else if (!token && user) {
        console.log('🔐 [App] User logged out');
        setUser(null);
      }
    };

    checkAuthState();
    const authCheckInterval = setInterval(checkAuthState, 1000);
    return () => clearInterval(authCheckInterval);
  }, [user]);

  // Fetch fresh user data from API
  const fetchFreshUserData = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    try {
      const response = await fetch('http://localhost:8001/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('🔄 [App] Fresh user data fetched:', userData.email, 'created_at:', userData.created_at);
        // Update localStorage with fresh data
        localStorage.setItem('userInfo', JSON.stringify(userData));
        return userData;
      } else {
        console.error('❌ [App] Failed to fetch fresh user data:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ [App] Error fetching fresh user data:', error);
      return null;
    }
  };

  // Initialize user on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('userInfo');
    
    if (token && userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        console.log('🔐 [App] Initializing with stored user:', userData.email);
        setUser(userData);
        
        // Fetch fresh user data to update any missing fields
        fetchFreshUserData().then(freshUserData => {
          if (freshUserData) {
            console.log('✅ [App] Updated user with fresh data');
            setUser(freshUserData);
          }
        });
      } catch (error) {
        console.error('Error parsing stored user info:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
      }
    }
    
    // Listen for user data refresh events
    const handleRefreshUserData = () => {
      console.log('🔄 [App] Refreshing user data via event...');
      fetchFreshUserData().then(freshUserData => {
        if (freshUserData) {
          console.log('✅ [App] User data refreshed via event');
          setUser(freshUserData);
        }
      });
    };
    
    window.addEventListener('refreshUserData', handleRefreshUserData);
    
    return () => {
      window.removeEventListener('refreshUserData', handleRefreshUserData);
    };
  }, []);

  const handleShowLeadForm = (profileData = {}) => {
    setConsultationData(profileData);
    setShowLeadForm(true);
  }

  const handleShowPDFGenerator = (profileData = {}) => {
    setConsultationData(profileData);
    setShowPDFGenerator(true);
  }

  const handleAvatarStateChange = (typing, speaking) => {
    setIsAvatarTyping(typing);
  }

  // Handle avatar readiness changes
  const handleAvatarReady = (ready, mode = 'ready') => {
    console.log(`🤖 [App] Avatar ready state changed: ${ready}, mode: ${mode}`);
    setAvatarReady(ready);
    setAvatarMode(mode);
    
    setAvatarPersistentState(prev => ({
      ...prev,
      isConnected: ready
    }));
  };

  // Handle conversation start coordination
  const handleStartConversation = () => {
    console.log('🎬 [App] Starting conversation coordination...');
    setConversationStarted(true);
  };

  // For logged-out users, auto-start chat without avatar dependencies
  useEffect(() => {
    if (!user) {
      console.log('🔓 [App] No user logged in, enabling chat without avatar');
      setAvatarMode('fallback');
      setAvatarReady(false); // Avatar not available
      setConversationStarted(true); // But allow chat to start
      setShowPremiumIntro(false); // Hide premium intro
    } else {
      console.log('🔐 [App] User logged in, resetting avatar states for real avatar');
      setAvatarMode('initializing');
      setAvatarReady(false);
      setConversationStarted(false); // Reset so avatar can control conversation start
      
      // Show premium intro for paid tier users
      if (['starter', 'pro', 'elite'].includes(user.tier)) {
        console.log('✨ [App] Paid tier user detected, showing premium intro');
        setShowPremiumIntro(true);
      } else {
        setShowPremiumIntro(false);
      }
    }
  }, [user]);

  // Auto-start conversation for paid tier users when avatar is ready
  useEffect(() => {
    if (user && ['starter', 'pro', 'elite'].includes(user.tier) && avatarReady && !conversationStarted) {
      console.log('🚀 [App] Paid tier user with ready avatar, starting conversation');
      setConversationStarted(true);
    }
  }, [user, avatarReady, conversationStarted]);

  // Handle avatar speaking requests
  const handleAvatarSpeak = (text) => {
    console.log(`🎤 [App] Avatar speaking request: ${text.substring(0, 50)}...`);
    console.log(`🎤 [App] Avatar ready: ${avatarReady}, mode: ${avatarMode}, user: ${user ? 'logged in' : 'logged out'}`);
    
    // For logged-out users, there's no avatar to speak - just log and return
    if (!user) {
      console.log('🔇 [App] No user logged in, skipping avatar speech (no avatar available)');
      return;
    }
    
    setAvatarPersistentState(prev => ({
      ...prev,
      lastSpeechText: text
    }));
    
    if (avatarReady && avatarMode === 'ready') {
      console.log('✅ [App] Sending text to avatar');
      setCurrentSpeechText(text);
      
      setTimeout(() => {
        setCurrentSpeechText('');
      }, 2000);
    } else {
      console.log(`⚠️ [App] Avatar not ready for speaking (ready: ${avatarReady}, mode: ${avatarMode})`);
      
      if (text && text.length > 0) {
        console.log('💾 [App] Queuing speech for when avatar becomes ready');
      }
    }
  };

  // Watch for avatar readiness changes to resume speech
  useEffect(() => {
    if (avatarReady && avatarMode === 'ready' && avatarPersistentState.lastSpeechText && !currentSpeechText) {
      console.log('🔄 [App] Avatar became ready again, resuming last speech');
      handleAvatarSpeak(avatarPersistentState.lastSpeechText);
    }
  }, [avatarReady, avatarMode]);

  // Clear speech text after avatar processes it
  useEffect(() => {
    if (currentSpeechText) {
      const timer = setTimeout(() => {
        setCurrentSpeechText('');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [currentSpeechText]);

  const handleAuthSuccess = async (userData, token) => {
    setUser(userData);
    localStorage.setItem('authToken', token);
    localStorage.setItem('userInfo', JSON.stringify(userData));
    setShowAuth(false);
    
    // Fetch fresh user data to ensure we have all fields
    const freshUserData = await fetchFreshUserData();
    if (freshUserData) {
      console.log('✅ [App] Updated authenticated user with fresh data');
      setUser(freshUserData);
    }
  }

  const handleShowUpgrade = async () => {
    // Upgrade functionality (can be implemented later)
    console.log('Upgrade clicked');
  }

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
  }

  // Premium user intro handlers
  const handleStartConversationFromIntro = (mode) => {
    console.log(`🚀 [App] Starting ${mode} conversation from premium intro`);
    setSelectedMode(mode);
    setLoadedConversation(null);
    setShowPremiumIntro(false);
    setConversationStarted(true);

    if (mode === 'pdf') {
      setShowPDFGenerator(true);
    }
  }

  const handleLoadConversationFromIntro = (conversation, mode) => {
    console.log(`📚 [App] Loading conversation ${conversation.title} in ${mode} mode`);
    setSelectedMode(mode);
    setLoadedConversation(conversation);
    setShowPremiumIntro(false);
    setConversationStarted(true);

    if (mode === 'pdf') {
      setShowPDFGenerator(true);
    }
  }

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <div className="header-main">
              <h1>🌍 World Immigration Consultant</h1>
              <p>Get personalized immigration advice powered by AI</p>
            </div>
            
            <div className="language-section">
              <LanguageSelector 
                user={user}
                onLanguageChange={(language) => {
                  console.log('Language changed to:', language);
                }}
              />
            </div>
            
            <div className="account-section">
              {user ? (
                <UserProfile 
                  user={user} 
                  onShowUpgrade={handleShowUpgrade}
                  onLogout={handleLogout}
                />
              ) : (
                <div className="auth-buttons">
                  <button 
                    className="auth-btn login-btn"
                    onClick={() => {
                      setAuthMode('login');
                      setShowAuth(true);
                    }}
                  >
                    Login
                  </button>
                  <button 
                    className="auth-btn signup-btn"
                    onClick={() => {
                      setAuthMode('register');
                      setShowAuth(true);
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={
            <div className="home-content">
              <div className="main-content">
                <div className="chat-column">
                  <WorldwideChat 
                    onShowLeadForm={handleShowLeadForm}
                    onAvatarStateChange={handleAvatarStateChange}
                    onShowPDFGenerator={handleShowPDFGenerator}
                    onAvatarSpeak={handleAvatarSpeak}
                    avatarReady={avatarReady}
                    avatarMode={avatarMode}
                    conversationStarted={conversationStarted}
                    user={user}
                    selectedMode={selectedMode}
                    loadedConversation={loadedConversation}
                    showPremiumIntro={showPremiumIntro}
                    onStartConversation={handleStartConversationFromIntro}
                    onLoadConversation={handleLoadConversationFromIntro}
                    onHidePremiumIntro={() => setShowPremiumIntro(false)}
                  />
                </div>
                
                {/* Sarah's avatar column - ALWAYS present and unchanged */}
                <div className="avatar-column">
                  {user ? (
                    <AvatarSarah 
                      onAvatarReady={handleAvatarReady}
                      textToSpeak={currentSpeechText}
                      onStartConversation={handleStartConversation}
                    />
                  ) : (
                    <div className="avatar-signup-prompt">
                      <div className="signup-content">
                        <div className="avatar-placeholder">
                          <div className="avatar-icon">👤</div>
                          <h3>Meet Sarah</h3>
                          <p>Your AI Immigration Consultant</p>
                        </div>
                        
                        <div className="signup-message">
                          <h4>🌟 Ready to Get Started?</h4>
                          <p>Create your <strong>FREE account</strong> to interact with Sarah and get personalized immigration guidance!</p>
                          
                          <div className="signup-benefits">
                            <div className="benefit-item">
                              ✅ Chat with AI consultant Sarah
                            </div>
                            <div className="benefit-item">
                              ✅ Get personalized immigration advice
                            </div>
                            <div className="benefit-item">
                              ✅ 5 free consultations daily
                            </div>
                            <div className="benefit-item">
                              ✅ Generate immigration reports
                            </div>
                          </div>
                          
                          <div className="signup-actions">
                            <button 
                              className="primary-signup-btn"
                              onClick={() => {
                                setAuthMode('register');
                                setShowAuth(true);
                              }}
                            >
                              🚀 Sign Up Free
                            </button>
                            <button 
                              className="secondary-login-btn"
                              onClick={() => {
                                setAuthMode('login');
                                setShowAuth(true);
                              }}
                            >
                              Already have an account? Login
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          } />
          
          <Route path="/admin" element={<SecureAdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {showAuth && (
          <UserAuth
            onClose={() => setShowAuth(false)}
            initialMode={authMode}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {showLeadForm && (
          <div className="lead-form-overlay">
            <LeadForm 
              onSubmit={(leadData) => {
                console.log('Lead submitted:', leadData);
                setShowLeadForm(false);
              }}
              onClose={() => setShowLeadForm(false)}
              initialData={consultationData}
              user={user}
            />
          </div>
        )}

        {showPDFGenerator && (
          <div className="pdf-generator-overlay">
            <PDFReportGenerator
              user={user}
              userProfile={consultationData}
              onClose={() => setShowPDFGenerator(false)}
            />
          </div>
        )}
      </div>
    </Router>
  )
}

export default App 