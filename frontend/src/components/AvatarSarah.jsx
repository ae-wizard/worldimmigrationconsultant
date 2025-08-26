import React, { useState, useEffect, useRef } from 'react';
import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType } from '@heygen/streaming-avatar';
import './AvatarSarah.css';

const AvatarSarah = ({ onAvatarReady, textToSpeak, onStartConversation }) => {
  // State management
  const [streamingAvatar, setStreamingAvatar] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('waiting');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showUserInteraction, setShowUserInteraction] = useState(false);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [userLanguage, setUserLanguage] = useState('en');
  const [voiceQuality, setVoiceQuality] = useState('standard');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSessionToken, setCurrentSessionToken] = useState(null);
  const [manualStartReady, setManualStartReady] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

  // Refs for managing timeouts and DOM elements
  const mediaElementRef = useRef(null);
  const initializationTimeoutRef = useRef(null);
  const readyTimeoutRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const countdownRef = useRef(null);

  // Enhanced logging with timestamp
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Avatar Sarah: ${message}`);
  };

  // Initialize user language and voice quality on mount
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        const response = await fetch('http://localhost:8001/user/language', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserLanguage(data.language || 'en');
        }
      } catch (error) {
        log(`⚠️ Could not fetch user language: ${error.message}`);
      }
    };

    const handleLanguageChange = async (event) => {
      const newLanguage = event.detail;
      log(`🌐 Language changed to: ${newLanguage}`);
      setUserLanguage(newLanguage);
      
      // Force restart avatar with new language for better synchronization
      if (streamingAvatar && isReady) {
        log(`🔄 Restarting avatar for language change: ${newLanguage}`);
        try {
          // Stop current avatar
          await streamingAvatar.interrupt();
          setIsReady(false);
          setIsConnected(false);
          setAvatarStatus('connecting');
          
          // Restart with new language
          setTimeout(() => {
            initializeAvatar();
          }, 1000);
        } catch (error) {
          log(`⚠️ Error restarting avatar for language change: ${error.message}`);
        }
      }
    };

    fetchUserLanguage();
    checkVoiceQuality();
    
    // Listen for language changes
    window.addEventListener('languageChange', handleLanguageChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange);
      cleanup();
    };
  }, []);

  // Check voice quality (ElevenLabs availability)
  const checkVoiceQuality = async () => {
    try {
      const response = await fetch('http://localhost:8001/heygen/voices', {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setVoiceQuality(data.voice_quality || 'standard');
      }
    } catch (error) {
      log(`⚠️ Could not check voice quality: ${error.message}`);
    }
  };

  // Idle timeout management
  const startIdleTimeout = () => {
    // Clear any existing timeouts
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    // Set warning timeout (1.5 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      setShowIdleWarning(true);
      setTimeRemaining(30);
      
      // Start countdown
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            handleIdleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1.5 * 60 * 1000); // 1.5 minutes (so total timeout is 2 minutes with 30-second countdown)
  };

  const resetIdleTimeout = () => {
    // Clear all timeout-related timers
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    setShowIdleWarning(false);
    
    // Restart the idle timeout
    if (isReady) {
      startIdleTimeout();
    }
  };

  const handleIdleTimeout = async () => {
    log('⏰ Session ended due to inactivity');
    
    // Track session before ending
    await trackAvatarSession();
    
    // Clean up
    setShowIdleWarning(false);
    setIsReady(false);
    setIsConnected(false);
    setAvatarStatus('idle_timeout');
    
    if (streamingAvatar) {
      streamingAvatar.disconnect();
    }
    
    // Notify parent
    if (onAvatarReady) {
      onAvatarReady(false, 'idle_timeout');
    }
  };

  // Track avatar session for analytics
  const trackAvatarSession = async () => {
    if (!sessionStartTime) return;
    
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    try {
      await fetch('http://localhost:8001/analytics/track-avatar-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_duration: sessionDuration,
          language: userLanguage,
          voice_quality: voiceQuality,
          session_id: currentSessionId
        })
      });
      
      log(`📊 Avatar session tracked: ${sessionDuration}s duration`);
    } catch (error) {
      log(`⚠️ Failed to track avatar session: ${error.message}`);
    }
  };

  const extendSession = () => {
    log('⏱️ Session extended by user');
    
    // Clear warning state
    setShowIdleWarning(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    // Restart idle timeout
    startIdleTimeout();
  };

  // Handle manual start button
  const handleManualStart = async () => {
    log('🎬 Manual start triggered');
    setManualStartReady(false);
    setAvatarStatus('initializing');
    await initializeAvatar();
  };

  // Initialize the StreamingAvatar
  const initializeAvatar = async () => {
    try {
      log('🚀 Initializing HeyGen StreamingAvatar...');
      
      const sessionData = await createAccessToken();
      const avatar = new StreamingAvatar({
        token: sessionData.token,
      });

      setStreamingAvatar(avatar);
      setAvatarStatus('connecting');

      // Set up event listeners
      avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);
      avatar.on(StreamingEvents.AVATAR_START_TALKING, handleAvatarStartTalking);
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, handleAvatarStopTalking);
      
      // Add listener to intercept any automatic speech
      avatar.on(StreamingEvents.TASK_START, (event) => {
        log(`🎯 Avatar task started: ${JSON.stringify(event.detail)}`);
      });
      avatar.on(StreamingEvents.TASK_FINISH, (event) => {
        log(`✅ Avatar task finished: ${JSON.stringify(event.detail)}`);
      });

      // Create and start avatar session with HR avatar
      log(`🎭 Using HR avatar: June_HR_public`);
      log(`🌐 Language: ${userLanguage}`);
      log(`⚙️ Quality: Low`);
      
      const sessionInfo = await avatar.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: 'June_HR_public', // Using HR avatar to debug her behavior
        language: userLanguage,
        disableIdleTimeout: true
      });

      log(`📋 Session response: ${JSON.stringify(sessionInfo, null, 2)}`);

      // Store session details for enhanced voice calls
      if (sessionInfo && sessionInfo.session_id) {
        setCurrentSessionId(sessionInfo.session_id);
        setCurrentSessionToken(sessionData.token);
        log(`✅ Avatar session created: ${sessionInfo.session_id} (language: ${userLanguage})`);
      } else {
        log(`❌ Session created but no session_id received: ${JSON.stringify(sessionInfo)}`);
      }

      log('✅ Avatar session created and started (HR avatar for debugging)');

    } catch (error) {
      log(`❌ Avatar initialization failed: ${error.message}`);
      log(`❌ Full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      log(`❌ Error stack: ${error.stack}`);
      
      setAvatarStatus('error');
      
      // Set fallback timeout
      fallbackTimeoutRef.current = setTimeout(() => {
        handleFallbackMode();
      }, 5000);
    }
  };

  // Create access token for HeyGen
  const createAccessToken = async () => {
    try {
      log('🎟️ Creating HeyGen access token...');
      const response = await fetch('http://localhost:8001/heygen/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      log('✅ Access token created successfully');
      return {
        token: data.session_token,
        usage_info: data.usage_info || {}
      };
    } catch (error) {
      log(`❌ Failed to create access token: ${error.message}`);
      throw error;
    }
  };

  // Get authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Handle stream ready event
  const handleStreamReady = (event) => {
    log('✅ Avatar stream ready');
    
    if (event.detail && mediaElementRef.current) {
      log('📺 Video stream attached');
      mediaElementRef.current.srcObject = event.detail;
      
      // Try to play video with autoplay handling
      const playPromise = mediaElementRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(async () => {
            log('📺 Video started playing');
            setIsConnected(true);
            setIsReady(true);
            setAvatarStatus('ready');
            setSessionStartTime(Date.now());
            
            // Ready to accept custom text - no aggressive blocking needed
            log('✅ Avatar ready to receive custom text with ElevenLabs voice');
            
            // Start idle timeout monitoring
            startIdleTimeout();
            
            // Notify parent component
            if (onAvatarReady) {
              onAvatarReady(true, 'ready');
            }
            
            log('🎉 Avatar is now ready - notifying parent component');
          })
          .catch((error) => {
            log(`⚠️ Video autoplay blocked: ${error.message}`);
            setShowUserInteraction(true);
          });
      }
    }
  };

  // Handle user interaction to enable video/audio
  const handleUserInteraction = async () => {
    try {
      if (mediaElementRef.current) {
        await mediaElementRef.current.play();
        setShowUserInteraction(false);
        setIsConnected(true);
        setIsReady(true);
        setAvatarStatus('ready');
        setSessionStartTime(Date.now());
        
        // Start idle timeout monitoring
        startIdleTimeout();
        
        if (onAvatarReady) {
          onAvatarReady(true, 'ready');
        }
        
        log('✅ User interaction completed - avatar ready');
      }
    } catch (error) {
      log(`❌ Failed to start video after interaction: ${error.message}`);
    }
  };

  // Handle stream disconnected event
  const handleStreamDisconnected = async () => {
    log('🔌 Avatar stream disconnected');
    
    // Track the session before disconnecting
    await trackAvatarSession();
    
    setIsConnected(false);
    setIsReady(false);
    setAvatarStatus('disconnected');
    
    if (onAvatarReady) {
      onAvatarReady(false, 'disconnected');
    }
  };

  // Handle avatar talking events
  const handleAvatarStartTalking = (event) => {
    log('🗣️ Avatar started talking');
    log(`📋 Talk event details: ${JSON.stringify(event?.detail || 'no details')}`);
    setIsSpeaking(true);
    
    // Reset idle timeout on any speech activity
    resetIdleTimeout();
  };

  const handleAvatarStopTalking = (event) => {
    log('🤐 Avatar stopped talking');
    log(`📋 Stop talk event details: ${JSON.stringify(event?.detail || 'no details')}`);
    setIsSpeaking(false);
  };

  // Function to stop any current avatar speech - AGGRESSIVE MODE
  const stopAvatarSpeech = async () => {
    if (streamingAvatar) {
      try {
        log('🛑 AGGRESSIVELY stopping all avatar speech (built-in voice disabled)...');
        
        // Try multiple methods to stop speech
        await streamingAvatar.interrupt();
        
        // Also try to stop any tasks
        try {
          await streamingAvatar.stopSpeaking();
        } catch (e) {
          // Method might not exist, ignore
        }
        
        setIsSpeaking(false);
        log('✅ All avatar speech stopped - ElevenLabs only mode');
      } catch (error) {
        log(`❌ Failed to stop avatar speech: ${error.message}`);
        // Force set speaking to false anyway
        setIsSpeaking(false);
      }
    }
  };

  // Send speaking task to avatar - ELEVENLABS ONLY (no built-in avatar voice)
  const speakText = async (text) => {
    if (!streamingAvatar || !isConnected || !isReady) {
      log(`❌ Avatar not ready for speaking (connected: ${isConnected}, ready: ${isReady})`);
      return;
    }

    if (!currentSessionId || !currentSessionToken) {
      log(`❌ Session not available for ElevenLabs voice (sessionId: ${!!currentSessionId}, token: ${!!currentSessionToken})`);
      return;
    }

    // Use the user's selected language directly - don't try to detect from text
    const storedLanguage = window.localStorage.getItem('userLanguage');
    const currentLanguage = storedLanguage || userLanguage || 'en';
    
    log(`🔍 Language selection: stored=${storedLanguage}, state=${userLanguage}, final=${currentLanguage}`);

    // Clean the text for speech - preserve Chinese characters and names
    const cleanedText = text
      .replace(/[*_~`#]/g, '') // Remove markdown
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '') // Remove emojis (SAFE: doesn't affect Chinese chars)
      .replace(/🇦🇺|🇩🇿|🇺🇸|🇬🇧|🇨🇦|🇩🇪|🇫🇷|🇮🇹|🇪🇸|🇳🇱/g, '') // Remove specific flag emojis
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();

    try {
      log('ELEVENLABS ONLY: Sending text for voice generation: "' + cleanedText.substring(0, 50) + '..."');
      log('Original length: ' + text.length + ', cleaned length: ' + cleanedText.length);
      log('Language: ' + currentLanguage + ', Voice quality: ' + voiceQuality);
      
      // Stop any current default speech but allow our custom text
      if (isSpeaking) {
        log('Stopping current speech to start our custom text...');
        await stopAvatarSpeech();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setIsSpeaking(true);

      // Send our custom text to avatar using REPEAT mode (no HR knowledge base)
      log('REPEAT MODE: Sending immigration text to avatar: "' + cleanedText + '"');
      const response = await fetch('http://localhost:8001/heygen/send-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          session_token: currentSessionToken,
          text: cleanedText, // OUR custom immigration text
          task_type: 'repeat', // CRITICAL: Use 'repeat' to avoid HR knowledge base
          use_elevenlabs: true, // Replace voice with ElevenLabs 
          language: currentLanguage
        })
      });

      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }

      const result = await response.json();
      log('REPEAT MODE task sent successfully - Sarah will speak OUR text with ElevenLabs voice (provider: ' + result.voice_provider + ')');

      // Reset idle timeout on activity
      resetIdleTimeout();

    } catch (error) {
      log('Failed to send REPEAT MODE task: ' + error.message);
      log('Sarah will not speak our immigration text');
      
      setIsSpeaking(false);
    }
  };

  // Handle text to speak prop changes
  useEffect(() => {
    if (textToSpeak && textToSpeak.length > 0) {
      speakText(textToSpeak);
    }
  }, [textToSpeak]);

  // Handle fallback mode
  const handleFallbackMode = () => {
    log('Switching to embed fallback mode');
    setUseEmbedFallback(true);
    setAvatarStatus('embed');
    
    if (onAvatarReady) {
      onAvatarReady(false, 'fallback');
    }
  };

  // Cleanup function
  const cleanup = async () => {
    // Clear all timers
    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
    }
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    // Track session if there was one
    if (sessionStartTime) {
      await trackAvatarSession();
    }
    
    if (streamingAvatar) {
      streamingAvatar.disconnect();
    }
  };

  // Render manual start overlay
  if (manualStartReady && avatarStatus === 'waiting') {
    return (
      <div className="avatar-sarah">
        <div className="avatar-header">
          <h3>Meet Sarah, Your Immigration Consultant</h3>
        </div>
        <div className="manual-start-overlay">
          <div className="start-content">
            <div className="start-icon">👩‍💼</div>
            <h3>Ready to Start Your Consultation</h3>
            <p>Click below to begin speaking with Sarah, your AI-powered immigration consultant.</p>
            <button 
              className="start-button"
              onClick={handleManualStart}
            >
              <span>🎬</span>
              Start Immigration Consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main avatar render
  return (
    <div className="avatar-sarah">
      <div className="avatar-header">
        <h3>Sarah - Immigration Consultant</h3>
      </div>
      
      <div className="avatar-container">
        {/* Video element for live avatar */}
        <video
          ref={mediaElementRef}
          autoPlay
          playsInline
          muted={false}
          className="avatar-video"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: useEmbedFallback ? 'none' : 'block'
          }}
        />

        {/* User interaction overlay */}
        {showUserInteraction && (
          <div className="user-interaction-overlay">
            <div className="interaction-content">
              <div className="interaction-icon">🎥</div>
              <h3>Enable Video & Audio</h3>
              <p>Click to start video and enable Sarah's voice</p>
              <button 
                className="interaction-button"
                onClick={handleUserInteraction}
              >
                <span>🔊</span>
                Start Video & Audio
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {(avatarStatus === 'initializing' || avatarStatus === 'connecting') && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              {avatarStatus === 'initializing' ? 'Initializing Sarah...' : 'Connecting to Sarah...'}
            </div>
          </div>
        )}

        {/* Idle warning overlay */}
        {showIdleWarning && (
          <div className="idle-warning-overlay">
            <div className="idle-warning-content">
              <div className="warning-icon">⏰</div>
              <h3>Session Ending Soon</h3>
              <p>Your session will end in <strong>{timeRemaining}</strong> seconds due to inactivity.</p>
              <div className="warning-actions">
                <button 
                  className="extend-session-btn"
                  onClick={extendSession}
                >
                  Continue Session
                </button>
                <button 
                  className="end-session-btn"
                  onClick={handleIdleTimeout}
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Embed fallback */}
        {useEmbedFallback && (
          <div className="embed-fallback">
            <iframe
              src="https://app.heygen.com/embeds/avatar_selector"
              width="100%"
              height="100%"
              frameBorder="0"
              allow="camera; microphone"
              title="Sarah - Immigration Consultant"
            />
          </div>
        )}

        {/* Error overlay */}
        {avatarStatus === 'error' && (
          <div className="error-overlay">
            <div className="error-content">
              <div className="error-icon">💬</div>
              <h3>Chat Mode Active</h3>
              <p>Sarah is currently available in chat mode. All premium features are fully functional!</p>
              <div className="premium-features">
                <div className="feature">✅ Unlimited AI conversations</div>
                <div className="feature">✅ Detailed PDF reports</div>
                <div className="feature">✅ Priority support</div>
                <div className="feature">✅ Full immigration guidance</div>
              </div>
              <p style={{marginTop: '10px', fontSize: '14px', color: '#666'}}>
                Video avatar temporarily unavailable - chat experience is identical!
              </p>
            </div>
          </div>
        )}

        {/* Idle timeout overlay */}
        {avatarStatus === 'idle_timeout' && (
          <div className="error-overlay">
            <div className="error-content">
              <div className="error-icon">⏰</div>
              <h3>Session Ended</h3>
              <p>Your avatar session has ended due to inactivity. You can continue chatting in text mode.</p>
              <button 
                className="restart-btn"
                onClick={handleManualStart}
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarSarah;