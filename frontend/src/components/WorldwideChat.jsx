import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import UserAuth from './UserAuth';
import { translateDynamicText, loadStaticTranslations, getStaticTranslation } from '../utils/translations';
import './ConversationalChat.css';

// Global variable to prevent multiple conversation starts across all instances
let globalWorldwideConversationStarted = false;
let globalWorldwideMessageCount = 0;

const WorldwideChat = ({ 
  onShowLeadForm, 
  onAvatarStateChange, 
  onShowPDFGenerator, 
  showAvatar = true, 
  user = null, 
  onAvatarSpeak,
  avatarReady = false,
  avatarMode = 'initializing',
  conversationStarted,
  selectedMode,
  loadedConversation,
  showPremiumIntro = false,
  showNonPremiumIntro = false,
  onStartConversation,
  onLoadConversation,
  onHidePremiumIntro,
  onStartNonPremiumConversation,
  onHideNonPremiumIntro,
}) => {
  // Unique component instance ID for debugging
  const instanceId = useRef(Math.random().toString(36).substring(7));
  
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userProfile, setUserProfile] = useState({});
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your message...");
  const [profileComplete, setProfileComplete] = useState(false);
  const [destinationCountries, setDestinationCountries] = useState({});
  const [originCountries, setOriginCountries] = useState([]);
  
  // Auth modal state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupData, setSignupData] = useState(null);
  
  // Premium intro state
  const [conversationHistory, setConversationHistory] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState('');
  const [selectedChatMode, setSelectedChatMode] = useState('');
  const [pdfQuestionFlow, setPdfQuestionFlow] = useState({
    questions: [],
    answers: {},
    currentQuestionIndex: 0,
    step: 'initial'
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Non-premium user state
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions] = useState(5);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  
  // Translation state
  const [userLanguage, setUserLanguage] = useState('en');
  const [translationCache, setTranslationCache] = useState({});
  const [staticTranslations, setStaticTranslations] = useState({});
  const [translationsLoaded, setTranslationsLoaded] = useState(false);
  
  const conversationStartedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const awaitingInput = useRef(false);
  const premiumIntroShownRef = useRef(false);

  // Translation helper function for dynamic content (AI responses, user-generated text)
  const translateText = async (text, targetLanguage = 'en') => {
    return await translateDynamicText(text, targetLanguage);
  };
  
  // Get user's language preference and listen for changes
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        console.log(`🚀 [Language] Fetching user language...`);
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('http://localhost:8001/auth/get-language', {
          headers: {
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const newLanguage = data.language || 'en';
          setUserLanguage(newLanguage);
          console.log(`🌐 [Language] User language set to: ${newLanguage}`);
          
          // Load static translations for the new language
          console.log(`🔄 [Language] Loading translations for ${newLanguage}...`);
          await loadLanguageTranslations(newLanguage);
          
          // Clear translation cache when language changes
          if (newLanguage !== userLanguage) {
            setTranslationCache({});
            console.log(`🌐 [Language] Cache cleared for language change: ${userLanguage} → ${newLanguage}`);
          }
        } else {
          console.log(`⚠️ [Language] Failed to fetch language, using default: en`);
          setUserLanguage('en');
          await loadLanguageTranslations('en');
        }
      } catch (error) {
        console.log(`❌ [Language] Error fetching language: ${error.message}`);
        console.log(`🔄 [Language] Using fallback language: en`);
        setUserLanguage('en');
        await loadLanguageTranslations('en');
      }
    };
    
    fetchUserLanguage();
    
    // Set up language change listener
    const handleLanguageChange = async (event) => {
      if (event.detail && event.detail.language) {
        const newLanguage = event.detail.language;
        console.log(`🌐 [Language Change] Language changed to: ${newLanguage}`);
        
        // Update language state
        setUserLanguage(newLanguage);
        
        // Clear translation cache to force reload
        setTranslationCache({}); 
        
        // Force reload of static translations
        await loadLanguageTranslations(newLanguage);
        
        // Re-render existing messages with new language (without clearing conversation)
        if (messages.length > 0) {
          console.log(`🔄 [Language Change] Re-rendering existing messages in ${newLanguage}`);
          // Force a re-render by updating a flag or triggering useEffect
          setTranslationsLoaded(false);
          setTimeout(() => setTranslationsLoaded(true), 100);
        }
        
        console.log(`✅ [Language Change] Language changed to ${newLanguage} without clearing conversation`);
      }
    };
    
    // Listen for language change events from LanguageSelector
    window.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, [messages.length]); // Add messages.length as dependency to track conversation state

  // Load static translations for a language
  const loadLanguageTranslations = async (language) => {
    try {
      console.log(`🌐 [Static Translations] Loading translations for ${language}...`);
      setTranslationsLoaded(false);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Translation loading timeout')), 5000)
      );
      
      const translationPromise = loadStaticTranslations(language);
      
      const translations = await Promise.race([translationPromise, timeoutPromise]);
      setStaticTranslations(translations);
      setTranslationsLoaded(true);
      console.log(`✅ [Static Translations] Loaded for language: ${language}`, Object.keys(translations));
      console.log(`✅ [Static Translations] Messages available:`, Object.keys(translations.messages || {}));
      console.log(`✅ [Static Translations] Buttons available:`, Object.keys(translations.buttons || {}));
      console.log(`✅ [Static Translations] Sample messages:`, translations.messages?.choose_continue);
      console.log(`✅ [Static Translations] Sample buttons:`, translations.buttons?.start_fresh_conversation);
    } catch (error) {
      console.log(`❌ [Static Translations] Error loading ${language}: ${error.message}`);
      // Set empty object as fallback to prevent constant retries
      setStaticTranslations({});
      setTranslationsLoaded(true); // Mark as loaded even on error to prevent infinite loading
    }
  };

    // Helper function to get static translation with placeholders
  const getText = (category, key, placeholders = {}) => {
    try {
      // If translations aren't loaded yet, return the key for now
      if (!staticTranslations || Object.keys(staticTranslations).length === 0 || !translationsLoaded) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ [getText] Translations not loaded yet for ${category}.${key}. Loaded: ${translationsLoaded}`);
        }
        return key;
      }
      
      const result = getStaticTranslation(staticTranslations, category, key, placeholders);
      
      // If getStaticTranslation returned the key (meaning translation not found), 
      // log it but still return the key
      if (result === key && process.env.NODE_ENV === 'development') {
        console.log(`🔄 [getText] Key ${category}.${key} not found in static translations`);
      }
      
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ [getText] Error getting translation for ${category}.${key}: ${error.message}`);
      }
      return key; // Return the key as fallback
    }
  };

  // Only scroll to bottom when new messages are added (not on initial load or tab switches)
  const scrollToBottom = () => {
    // Don't scroll if this is the initial load or if no new messages
    if (isInitialLoadRef.current || messages.length <= lastMessageCountRef.current) {
      return;
    }
    
    // Only scroll if we actually have new messages
    if (messages.length > lastMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      lastMessageCountRef.current = messages.length;
    }
  };

  useEffect(() => {
    // Mark that initial load is complete after first render
    if (isInitialLoadRef.current && messages.length > 0) {
      setTimeout(() => {
        isInitialLoadRef.current = false;
        lastMessageCountRef.current = messages.length;
      }, 500);
    } else if (!isInitialLoadRef.current) {
      // Only scroll for new messages after initial load
      scrollToBottom();
    }
  }, [messages]);

  // Sync typing state with avatar
  useEffect(() => {
    if (onAvatarStateChange) {
      onAvatarStateChange(isTyping, false);
    }
  }, [isTyping, onAvatarStateChange]);

  // Load worldwide data on component mount
  useEffect(() => {
    loadWorldwideData();
  }, []);

  // Load static translations on component mount and when language changes
  useEffect(() => {
    loadLanguageTranslations(userLanguage);
  }, [userLanguage]);

  // Initialize conversation state from sessionStorage (not localStorage)
  useEffect(() => {
    const savedConversation = sessionStorage.getItem('worldwideConversation');
    if (savedConversation) {
      try {
        const parsed = JSON.parse(savedConversation);
        // Only restore if it's for the same user (or no user)
        const currentUserId = user?.id || 'anonymous';
        if (parsed.userId === currentUserId && parsed.messages && parsed.messages.length > 0) {
          console.log('Restoring conversation from sessionStorage (tab switch)');
          setMessages(parsed.messages);
          setCurrentStep(parsed.currentStep || 'welcome');
          setUserProfile(parsed.userProfile || {});
          setWaitingForUser(parsed.waitingForUser || false);
          setShowInputField(parsed.showInputField || false);
          setProfileComplete(parsed.profileComplete || false);
          conversationStartedRef.current = true;
          globalWorldwideConversationStarted = true;
          lastMessageCountRef.current = parsed.messages.length;
          return; // Don't start new conversation
        }
      } catch (e) {
        console.log('Failed to parse saved conversation, starting fresh');
      }
    }
  }, [user?.id]);

  // Save conversation state to sessionStorage whenever it changes (maintains across tabs, not refreshes)
  useEffect(() => {
    if (messages.length > 0) {
      const conversationState = {
        userId: user?.id || 'anonymous',
        messages,
        currentStep,
        userProfile,
        waitingForUser,
        showInputField,
        profileComplete,
        timestamp: Date.now()
      };
      sessionStorage.setItem('worldwideConversation', JSON.stringify(conversationState));
    }
  }, [messages, currentStep, userProfile, waitingForUser, showInputField, profileComplete, user?.id]);

  // Auto-start worldwide conversation when data is loaded and avatar is ready
  useEffect(() => {
    // Don't auto-start if premium intro or non-premium intro is showing
    if (showPremiumIntro || showNonPremiumIntro) {
      console.log('🔍 [Debug] Intro active, skipping auto-start', { showPremiumIntro, showNonPremiumIntro });
      return;
    }
    
    // Prevent multiple starts with stricter checking
    if (globalWorldwideConversationStarted || conversationStartedRef.current || messages.length > 0) {
      console.log('🔍 [Debug] Conversation already started or has messages, skipping auto-start');
      return;
    }
    
    if (destinationCountries && Object.keys(destinationCountries).length > 0) {
      console.log(`🤖 [Chat] Avatar readiness check - Ready: ${avatarReady}, Mode: ${avatarMode}`);
      console.log(`🤖 [Chat] Conversation started: ${conversationStarted}`);
      
      // Wait for BOTH avatar to be ready AND conversationStarted to be true
      if (conversationStarted && (avatarReady || avatarMode === 'fallback')) {
        console.log('🚀 [Chat] Both conditions met, starting conversation');
        globalWorldwideConversationStarted = true;
        conversationStartedRef.current = true;
        startWorldwideConversation();
      } else {
        console.log('⏳ [Chat] Still waiting for conditions to be met');
      }
    }
  }, [conversationStarted, avatarReady, avatarMode, destinationCountries, messages.length, showPremiumIntro, showNonPremiumIntro]);

  // Reset conversation only when user actually changes (login/logout), not tab switches
  useEffect(() => {
    if (conversationStartedRef.current && user?.id !== undefined) {
      const currentUserId = user?.id || 'anonymous';
      const storedUserId = localStorage.getItem('lastWorldwideUserId');
      
      if (currentUserId !== storedUserId) {
        console.log(`[${instanceId.current}] User changed, resetting worldwide conversation`);
        // Clear conversation state
        setMessages([]);
        setCurrentStep('welcome');
        setUserProfile({});
        setWaitingForUser(false);
        setShowInputField(false);
        setProfileComplete(false);
        conversationStartedRef.current = false;
        globalWorldwideConversationStarted = false;
        globalWorldwideMessageCount = 0; // Reset global message count
        lastMessageCountRef.current = 0;
        isInitialLoadRef.current = true;
        premiumIntroShownRef.current = false; // Reset premium intro flag
        
        // Clear saved conversation
        sessionStorage.removeItem('worldwideConversation');
        
        // Store new user ID
        localStorage.setItem('lastWorldwideUserId', currentUserId);
        
        // Restart conversation with new user context
        setTimeout(() => {
          if (destinationCountries && Object.keys(destinationCountries).length > 0) {
            startWorldwideConversation();
          }
        }, 500);
      } else {
        // Same user, just store the ID if not already stored
        localStorage.setItem('lastWorldwideUserId', currentUserId);
      }
    }
  }, [user?.id, destinationCountries]);

  // Handle intro dismissal (consolidated for both premium and non-premium)
  useEffect(() => {
    const wasShowingIntro = showPremiumIntro || showNonPremiumIntro;
    const isNowHidden = !showPremiumIntro && !showNonPremiumIntro;
    
    // Only trigger if intro was showing and is now hidden
    if (wasShowingIntro && isNowHidden && conversationStarted && user && messages.length === 0) {
      console.log('🔍 [Debug] Intro dismissed, checking if conversation should start');
      
      // Only start if not already started
      if (!globalWorldwideConversationStarted && !conversationStartedRef.current) {
        console.log('🔍 [Debug] Starting conversation after intro dismissal');
        
        // Set the selected chat mode from the prop for premium users
        if (selectedMode && ['starter', 'pro', 'elite'].includes(user.tier)) {
          setSelectedChatMode(selectedMode);
          console.log('🔍 [Debug] Set selectedChatMode to:', selectedMode);
        }
        
        globalWorldwideConversationStarted = true;
        conversationStartedRef.current = true;
        
        // Start conversation with appropriate settings
        const isFreshStart = selectedMode && !loadedConversation;
        startWorldwideConversation(isFreshStart);
      }
    }
  }, [showPremiumIntro, showNonPremiumIntro, conversationStarted, user, messages.length, selectedMode, loadedConversation]);

  const loadWorldwideData = async () => {
    try {
      // Load destination countries
      const destResponse = await fetch('http://127.0.0.1:8001/destination-countries');
      const destData = await destResponse.json();
      
      // Fix: Use the correct property name from backend response
      if (destData.destination_countries) {
        setDestinationCountries(destData.destination_countries);
        console.log(`✅ Loaded ${Object.keys(destData.destination_countries).length} destination countries`);
      } else {
        throw new Error('Invalid destination countries response');
      }

      // Load origin countries
      const originResponse = await fetch('http://127.0.0.1:8001/origin-countries');
      const originData = await originResponse.json();
      
      // Fix: Use the correct property name from backend response
      if (originData.origin_countries) {
        // Convert array to objects with flags
        const countryObjects = originData.origin_countries.map(countryName => ({
          name: countryName,
          flag: getCountryFlag(countryName)
        }));
        setOriginCountries(countryObjects);
        console.log(`✅ Loaded ${originData.origin_countries.length} origin countries`);
      } else {
        throw new Error('Invalid origin countries response');
      }
    } catch (error) {
      console.error('Error loading worldwide data:', error);
      // Fallback to basic data
      setDestinationCountries({
        usa: { name: "United States", flag: "🇺🇸" },
        canada: { name: "Canada", flag: "🇨🇦" },
        united_kingdom: { name: "United Kingdom", flag: "🇬🇧" },
        australia: { name: "Australia", flag: "🇦🇺" },
        germany: { name: "Germany", flag: "🇩🇪" }
      });
      setOriginCountries([
        { name: "India", flag: "🇮🇳" },
        { name: "China", flag: "🇨🇳" },
        { name: "Mexico", flag: "🇲🇽" },
        { name: "Brazil", flag: "🇧🇷" },
        { name: "Nigeria", flag: "🇳🇬" },
        { name: "Philippines", flag: "🇵🇭" },
        { name: "Other", flag: "🌍" }
      ]);
    }
  };

  // Helper function to get country flags
  const getCountryFlag = (countryName) => {
    const flagMap = {
      'India': '🇮🇳',
      'China': '🇨🇳',
      'Mexico': '🇲🇽',
      'Brazil': '🇧🇷',
      'Nigeria': '🇳🇬',
      'Philippines': '🇵🇭',
      'Pakistan': '🇵🇰',
      'Bangladesh': '🇧🇩',
      'Vietnam': '🇻🇳',
      'South Korea': '🇰🇷',
      'Iran': '🇮🇷',
      'Ukraine': '🇺🇦',
      'Russia': '🇷🇺',
      'Venezuela': '🇻🇪',
      'Colombia': '🇨🇴',
      'Peru': '🇵🇪',
      'Egypt': '🇪🇬',
      'Turkey': '🇹🇷',
      'Thailand': '🇹🇭',
      'Indonesia': '🇮🇩',
      'Malaysia': '🇲🇾',
      'Morocco': '🇲🇦',
      'Algeria': '🇩🇿',
      'South Africa': '🇿🇦',
      'Ghana': '🇬🇭',
      'Kenya': '🇰🇪',
      'Ethiopia': '🇪🇹',
      'United States': '🇺🇸',
      'Canada': '🇨🇦',
      'United Kingdom': '🇬🇧',
      'Australia': '🇦🇺',
      'Other': '🌍'
    };
    return flagMap[countryName] || '🌍';
  };

  // Convert destination countries to dropdown options
  const getDestinationOptions = () => {
    return Object.entries(destinationCountries).map(([code, country]) => ({
      text: `${country.flag} ${country.name}`,
      value: code
    })).sort((a, b) => a.text.localeCompare(b.text));
  };

  // Convert origin countries to dropdown options with flags
  const getOriginOptions = () => {
    return originCountries.map(country => ({
      text: `${country.flag} ${country.name}`,
      value: country.name
    }));
  };

  // Worldwide profile steps with new flow - using static translations
  const getWorldwideSteps = async () => {
    // Get translations directly - don't rely on React state
    let currentTranslations = staticTranslations;
    
    if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
      console.log(`🔄 [getWorldwideSteps] Loading translations for ${userLanguage} before generating steps...`);
      try {
        currentTranslations = await loadStaticTranslations(userLanguage);
        setStaticTranslations(currentTranslations); // Update state for next time
        console.log(`✅ [getWorldwideSteps] Loaded translations directly`, !!currentTranslations);
      } catch (error) {
        console.log(`❌ [getWorldwideSteps] Failed to load translations: ${error.message}`);
        currentTranslations = {};
      }
    }
    
    // Helper function that uses the directly loaded translations
    const getTextDirect = (category, key, placeholders = {}) => {
      try {
        if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
          console.log(`⚠️ [getTextDirect] No translations available for ${category}.${key}`);
          return key;
        }
        const result = getStaticTranslation(currentTranslations, category, key, placeholders);
        return result;
      } catch (error) {
        console.log(`❌ [getTextDirect] Error: ${error.message}`);
        return key;
      }
    };
    
    console.log(`🔧 [getWorldwideSteps] Generating steps with ${Object.keys(currentTranslations).length} translation categories`);
    
    return {
      welcome: {
        getMessage: () => {
          // For paid tier users in PDF mode, show different message
          if (user && ['starter', 'pro', 'elite'].includes(user.tier) && selectedChatMode === 'pdf') {
            // This is dynamic content, so still use API translation
            return translateText(`Report Generation Mode Activated. Let's start - which country do you want to immigrate TO?`, userLanguage);
          }
          
          if (user && user.first_name) {
            console.log(`🔍 [getMessage] Getting welcome_sarah for user: ${user.first_name}`);
            const result = getTextDirect('ui', 'welcome_sarah', { first_name: user.first_name });
            console.log(`🔍 [getMessage] Result: ${result}`);
            return result;
          }
          const result = getTextDirect('ui', 'welcome_sarah_simple');
          console.log(`🔍 [getMessage] Simple welcome result: ${result}`);
          return result;
        },
        getNextMessage: () => getTextDirect('ui', 'latest_government_data'),
        inputType: "select",
        getPlaceholder: () => getTextDirect('placeholders', 'select_destination'),
        getOptions: getDestinationOptions
      },
      origin_country: {
        getMessage: () => getTextDirect('ui', 'excellent_choice_from'),
        inputType: "select", 
        getPlaceholder: () => getTextDirect('placeholders', 'select_current_country'),
        getOptions: getOriginOptions
      },
      immigration_goal: {
        getMessage: () => getTextDirect('ui', 'wonderful_immigration_goal'),
        inputType: "select",
        getPlaceholder: () => getTextDirect('placeholders', 'select_your_goal'),
        getOptions: () => [
          { text: `💼 ${getTextDirect('goals', 'work')}`, value: "work" },
          { text: `🎓 ${getTextDirect('goals', 'study')}`, value: "study" },
          { text: `👨‍👩‍👧‍👦 ${getTextDirect('goals', 'family')}`, value: "family" },
          { text: `💰 ${getTextDirect('goals', 'invest')}`, value: "invest" },
          { text: `✈️ ${getTextDirect('goals', 'visit')}`, value: "visit" },
          { text: `🏡 ${getTextDirect('goals', 'permanent_residence')}`, value: "permanent_residence" },
          { text: `🛂 ${getTextDirect('goals', 'citizenship')}`, value: "citizenship" },
          { text: `🌟 ${getTextDirect('goals', 'other')}`, value: "other" }
        ]
      }
    };
  };

  const addMessage = async (text, isUser = false, hasOptions = false, options = null, inputType = null, placeholder = null, skipTranslation = false) => {
    if (!text && !hasOptions) return;
    
    let finalText = text;
    
    // Replace template variables in messages
    if (finalText && typeof finalText === 'string') {
      // Replace common template variables
      finalText = finalText.replace(/\{limit\}/g, maxQuestions || 5);
      finalText = finalText.replace(/\{first_name\}/g, user?.first_name || 'User');
      finalText = finalText.replace(/\{user_name\}/g, user?.first_name || 'User');
      finalText = finalText.replace(/\{max_questions\}/g, maxQuestions || 5);
      
      // Replace tier-specific limits for paid tier users
      if (user && ['starter', 'pro', 'elite'].includes(user.tier)) {
        finalText = finalText.replace(/\{limit\}/g, '无限制'); // Unlimited in Chinese
        finalText = finalText.replace(/unlimited/gi, '无限制');
      }
    }
    
    const messageId = Math.random().toString(36).substring(7);
    
    const message = {
      id: messageId,
      text: finalText,
      isUser,
      timestamp: new Date().toLocaleTimeString(),
      hasOptions,
      options: options || [],
      inputType,
      placeholder,
      skipTranslation
    };
    
    setMessages(prev => {
      console.log(`[${instanceId.current}] Adding message: [${isUser ? 'USER' : 'ASSISTANT'}] "${(finalText || '').substring(0, 50)}..."`);
      
      const newMessages = [...prev, message];
      lastMessageCountRef.current = newMessages.length;
      return newMessages;
    });
    
    // Send to avatar for speaking if it's an assistant message with text
    if (!isUser && finalText && finalText.trim()) {
      if (onAvatarSpeak) {
        console.log(`🗣️ [AvatarSpeak] Triggering avatar speech: "${finalText.substring(0, 50)}..."`);
        onAvatarSpeak(finalText);
      }
    }
  };

  const simulateTyping = async (delay = 1000) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, delay));
    setIsTyping(false);
  };

  const handleUserChoice = async (choice) => {
    console.log('User chose:', choice, 'Current step:', currentStep);
    
    // Prevent duplicate calls
    if (!waitingForUser) {
      console.log('🚫 [handleUserChoice] Already processing, ignoring duplicate call');
      return;
    }
    
    setWaitingForUser(false);
    
    // Find the selected option text for display
    const lastMessage = messages[messages.length - 1];
    let selectedOptionText = choice;
    
    if (lastMessage?.options) {
      const selectedOption = lastMessage.options.find(opt => opt.value === choice);
      if (selectedOption) {
        selectedOptionText = selectedOption.text;
      }
    }
    
    // Add the user's selection only once
    const messageId = await addMessage(selectedOptionText, true);
    console.log('✅ [handleUserChoice] Added user message with ID:', messageId);

    // Handle each step in the worldwide flow
    if (currentStep === 'welcome') {
      // User selected destination country
      setUserProfile(prev => ({ ...prev, destination_country: choice }));
      
      const destinationCountry = destinationCountries[choice];
      await simulateTyping(800);
      const greatChoiceMessage = getText('ui', 'great_choice_opportunities', { 
        destination: destinationCountry.name, 
        goal: userProfile.goal || 'immigration'
      });
      await addMessage(greatChoiceMessage, false, false, null, null, null, true);
      await simulateTyping(1000);
      
      // Check if user is logged in and we know their origin country
      if (user && user.origin_country) {
        // Skip origin country selection and show confirmation instead
        setUserProfile(prev => ({ ...prev, origin_country: user.origin_country }));
        
        // Use static translations for button texts
        const yesText = getText('buttons', 'yes_from_country', { country: user.origin_country });
        const noText = getText('buttons', 'no_select_different');
        
        const confirmMessage = getText('ui', 'confirm_origin_country', { country: user.origin_country });
        await addMessage(confirmMessage, false, true, [
          { text: yesText, value: `confirm_${user.origin_country}` },
          { text: noText, value: "select_different_origin" }
        ], null, null, true);
        setWaitingForUser(true);
        setCurrentStep('confirm_origin');
      } else {
        // Regular origin country selection for non-logged users
        const worldwideSteps = await getWorldwideSteps();
        const originStep = worldwideSteps.origin_country;
        await addMessage(originStep.getMessage(), false, false, null, null, null, true);
        await simulateTyping(500);
        await addMessage("", false, true, originStep.getOptions(), originStep.inputType, originStep.getPlaceholder());
        setWaitingForUser(true);
        setCurrentStep('origin_country');
      }
      
    } else if (currentStep === 'confirm_origin') {
      // Handle origin country confirmation for logged-in users
      if (choice.startsWith('confirm_')) {
        const confirmedCountry = choice.replace('confirm_', '');
        await simulateTyping(800);
        const destCountry = destinationCountries[userProfile.destination_country];
        const moveMessage = await translateText(`Great! So you want to move from ${confirmedCountry} to ${destCountry.name} ${destCountry.flag}`, userLanguage);
        await addMessage(moveMessage, false, false, null, null, null, true);
        await simulateTyping(1000);
        
        const worldwideSteps = await getWorldwideSteps();
        const goalStep = worldwideSteps.immigration_goal;
        await addMessage(goalStep.getMessage(), false, false, null, null, null, true);
        await simulateTyping(500);
        await addMessage("", false, true, goalStep.getOptions(), goalStep.inputType, goalStep.getPlaceholder());
        setWaitingForUser(true);
        setCurrentStep('immigration_goal');
      } else if (choice === 'select_different_origin') {
        await simulateTyping(800);
        const worldwideSteps = await getWorldwideSteps();
        const originStep = worldwideSteps.origin_country;
        await addMessage(originStep.getMessage(), false, false, null, null, null, true);
        await simulateTyping(500);
        await addMessage("", false, true, originStep.getOptions(), originStep.inputType, originStep.getPlaceholder());
        setWaitingForUser(true);
        setCurrentStep('origin_country');
      }
      
    } else if (currentStep === 'origin_country') {
      // User selected origin country
      setUserProfile(prev => ({ ...prev, origin_country: choice }));
      
      if (choice === 'Other') {
        await simulateTyping(800);
        const pleaseMessage = await translateText("Please tell me which country you're from:", userLanguage);
        await addMessage(pleaseMessage, false, false, null, null, null, true);
        setShowInputField(true);
        const placeholderText = await translateText("Enter your country...", userLanguage);
        setInputPlaceholder(placeholderText);
        setWaitingForUser(true);
        setCurrentStep('origin_input');
        return;
      }
      
      await simulateTyping(800);
      const destCountry = destinationCountries[userProfile.destination_country];
      const moveMessage2 = await translateText(`Great! So you want to move from ${choice} to ${destCountry.name} ${destCountry.flag}`, userLanguage);
      await addMessage(moveMessage2, false, false, null, null, null, true);
      await simulateTyping(1000);
      
      const worldwideSteps = await getWorldwideSteps();
      const goalStep = worldwideSteps.immigration_goal;
      await addMessage(goalStep.getMessage(), false, false, null, null, null, true);
      await simulateTyping(500);
      await addMessage("", false, true, goalStep.getOptions(), goalStep.inputType, goalStep.getPlaceholder());
      setWaitingForUser(true);
      setCurrentStep('immigration_goal');
      
    } else if (currentStep === 'immigration_goal') {
      setUserProfile(prev => ({ ...prev, goal: choice }));
      
      await simulateTyping(1000);
      
      // For paid tier users, continue with consultation instead of showing PDF popup
      setProfileComplete(true);
      
      // Check if this is PDF generation mode
      if (selectedChatMode === 'pdf') {
        console.log('🔍 DEBUG: PDF mode - starting structured question flow');
        await startPDFQuestionFlow(choice);
      } else {
        console.log('🔍 DEBUG: Q&A mode - starting regular conversation');
        console.log('🔍 DEBUG: userProfile:', userProfile);
        console.log('🔍 DEBUG: Calling handleWorldwideAIResponse with goal:', choice);
        await handleWorldwideAIResponse(null, choice);
      }
    } else if (currentStep === 'pdf_question') {
      // Handle PDF question flow answers - don't add message here since it's already added above
      await handlePDFQuestionAnswer(choice);
    } else if (currentStep === 'destination') {
      const destCountry = destinationCountries[choice];
      setUserProfile(prev => ({ ...prev, destination_country: choice }));
      
      // Show user's selection
      addMessage(`${destCountry.name} ${destCountry.flag}`, true);
      
      await simulateTyping(1000);
      
      // Use shorter message for paid tier PDF mode
      if (user && ['starter', 'pro', 'elite'].includes(user.tier) && selectedChatMode === 'pdf') {
        const nowMessage = await translateText("Now, what country are you FROM?", userLanguage);
        addMessage(nowMessage, false, false, null, null, null, true);
      } else {
        const greatChoiceMessage = await translateText(`Great choice! ${destCountry.name} ${destCountry.flag} has excellent immigration opportunities.`, userLanguage);
        addMessage(greatChoiceMessage, false, false, null, null, null, true);
        await simulateTyping(1000);
        const excellentMessage = await translateText("Excellent choice! Now, what country are you FROM?", userLanguage);
        addMessage(excellentMessage, false, false, null, null, null, true);
      }
      
      await simulateTyping(800);
      addMessage("", false, true, getOriginOptions(), "select", "Select your current country");
      
      setWaitingForUser(true);
      setCurrentStep('origin');
    } else if (currentStep === 'origin') {
      const originCountry = originCountries[choice] || choice;
      setUserProfile(prev => ({ ...prev, origin_country: choice }));
      
      // Show user's selection
      addMessage(originCountry, true);
      
      await simulateTyping(1000);
      
      // Use shorter message for paid tier PDF mode
      if (user && ['starter', 'pro', 'elite'].includes(user.tier) && selectedChatMode === 'pdf') {
        const goalMessage = await translateText("What's your immigration goal?", userLanguage);
        addMessage(goalMessage, false, false, null, null, null, true);
      } else {
        const destCountry = destinationCountries[userProfile.destination_country];
        const perfectMessage = await translateText(`Perfect! So you want to move from ${originCountry} to ${destCountry.name} ${destCountry.flag}`, userLanguage);
        addMessage(perfectMessage, false, false, null, null, null, true);
        await simulateTyping(1000);
        const mainGoalMessage = await translateText("What's your main immigration goal?", userLanguage);
        addMessage(mainGoalMessage, false, false, null, null, null, true);
      }
      
      await simulateTyping(800);
      const worldwideSteps = await getWorldwideSteps();
      const goalStep = worldwideSteps.immigration_goal;
      addMessage("", false, true, goalStep.getOptions(), goalStep.inputType, goalStep.getPlaceholder());
      
      setWaitingForUser(true);
      setCurrentStep('immigration_goal');
    }
  };

  // Handle text input from user
  const handleTextInput = async (text) => {
    if (!text.trim()) return;
    
    setShowInputField(false);
    setWaitingForUser(false);
    
    // Add user message
    addMessage(text, true);
    
    await simulateTyping(1500);
    
    // For non-premium users in Q&A mode, track question count
    if (user && user.tier !== 'premium' && currentStep === 'non_premium_qa') {
      const newQuestionCount = questionCount + 1;
      setQuestionCount(newQuestionCount);
      
      console.log(`🔢 [Debug] Non-premium question count: ${newQuestionCount}/${maxQuestions}`);
      
      if (newQuestionCount >= maxQuestions) {
        // Reached question limit, show upgrade prompt
        await handleWorldwideAIResponse(text);
        
        await simulateTyping(1500);
        
        addMessage(`🎯 **You've reached your ${maxQuestions} question limit!**\n\n✨ **Upgrade to Premium for:**\n• Unlimited questions\n• Conversation history\n• Detailed PDF reports\n• Priority support`);
        
        setTimeout(() => {
          const upgradeOptions = [
            { text: "🚀 Upgrade to Premium", value: "upgrade_premium" },
            { text: "📄 Generate Simple Report", value: "generate_simple_report" }
          ];
          
          addMessage("", false, true, upgradeOptions, "buttons");
          setWaitingForUser(true);
          setCurrentStep('upgrade_prompt');
        }, 1000);
        
        return;
      } else {
        // Still have questions left
        await handleWorldwideAIResponse(text);
        
        const questionsLeft = maxQuestions - newQuestionCount;
        await simulateTyping(1000);
        
        addMessage(`💡 You have **${questionsLeft}** more questions remaining. What else would you like to know?`);
        setShowInputField(true);
        setInputPlaceholder("Ask your next question...");
        setWaitingForUser(true);
        return;
      }
    }
    
    // Handle other steps normally
    if (currentStep === 'fresh_start') {
      await handleWorldwideAIResponse(text, userProfile.goal || 'general');
    } else {
      await handleWorldwideAIResponse(text);
    }
    
    // Check if we should auto-generate premium PDF after consultation
    const shouldGeneratePDF = await checkForPremiumPDFGeneration();
    if (shouldGeneratePDF) {
      return; // Exit early as PDF generation takes over
    }
  };

  // Check if we should show PDF generation option 
  const checkForPDFGenerationOption = async () => {
    console.log('🔍 [Debug] PDF generation check called:', {
      userTier: user?.tier,
      selectedChatMode,
      selectedMode,
      isPaidTier: ['starter', 'pro', 'elite'].includes(user?.tier),
      shouldCheck: user && ['starter', 'pro', 'elite'].includes(user.tier)
    });
    
    // Only for paid tier users who have had a consultation
    if (user && ['starter', 'pro', 'elite'].includes(user.tier)) {
      // Check if we have basic profile information AND sufficient consultation
      const hasBasicInfo = userProfile.destination_country && userProfile.origin_country && userProfile.goal;
      
      // Count only AI response messages (not user selections or setup messages)
      const aiResponseCount = messages.filter(msg => 
        !msg.isUser && 
        !msg.hasOptions && 
        !msg.text.includes("which country do you want") &&
        !msg.text.includes("what country are you FROM") &&
        !msg.text.includes("main immigration goal") &&
        !msg.text.includes("Welcome") &&
        msg.text.length > 50 // Only substantial responses
      ).length;
      
      const hasConsultation = aiResponseCount >= 3; // After at least 3 substantial AI responses
      
      // Show PDF generation option once we have enough information and haven't shown it yet
      if (hasBasicInfo && hasConsultation && !sessionStorage.getItem('pdfOptionShown')) {
        console.log('🔍 [Debug] Conditions met - showing PDF generation option');
        
        // Set flag to prevent multiple prompts
        sessionStorage.setItem('pdfOptionShown', 'true');
        
        await simulateTyping(1500);
        addMessage("📄 **Great!** I have enough information about your immigration plans. Would you like me to generate a comprehensive PDF report with all the details?", null, [
          { text: "📄 Generate PDF Report", value: "generate_pdf" },
          { text: "💬 Continue Conversation", value: "continue_chat" }
        ]);
        
        return true; // Indicate PDF option was shown
      } else {
        console.log('🔍 [Debug] PDF generation conditions not met - continuing consultation');
      }
    } else {
      console.log('🔍 [Debug] Not paid tier - skipping PDF generation check');
    }
    return false; // No PDF option shown
  };

  // Start structured PDF question flow
  const startPDFQuestionFlow = async (immigrationGoal) => {
    console.log('📄 [PDF] Starting structured question flow for goal:', immigrationGoal);
    
    try {
      // Initialize PDF question flow with basic info
      setPdfQuestionFlow(prev => ({
        ...prev,
        answers: {
          destination_country: userProfile.destination_country,
          origin_country: userProfile.origin_country,
          goal: immigrationGoal
        }
      }));
      
      await simulateTyping(1000);
      addMessage("📄 **Perfect!** I'll now ask you specific questions to create a comprehensive immigration report tailored to your needs.", null, null, null, null, null, true);
      
      // Start with first targeted question
      await askNextPDFQuestion();
      
    } catch (error) {
      console.error('📄 [PDF] Error starting question flow:', error);
      addMessage("I apologize, but I encountered an issue starting the PDF question flow. Let me continue with a regular consultation instead.", null, null, null, null, null, true);
      await handleWorldwideAIResponse(null, immigrationGoal);
    }
  };

  // Ask the next question in the PDF flow with explicit index
  const askNextPDFQuestionWithIndex = async (questionIndex) => {
    console.log('📄 [PDF] Asking next question with index:', questionIndex);
    
    // Get current answers and goal
    const currentAnswers = pdfQuestionFlow.answers;
    const goal = currentAnswers.goal?.toLowerCase() || 'work';
    
    // Define questions based on immigration goal (same as before)
    const questionSets = {
      work: [
        {
          id: 'education_level',
          question: "What is your highest level of education?",
          options: ["High School", "Bachelor's Degree", "Master's Degree", "PhD/Doctorate", "Professional Certificate"]
        },
        {
          id: 'work_experience',
          question: "How many years of work experience do you have in your field?",
          options: ["0-2 years", "3-5 years", "6-10 years", "11-15 years", "15+ years"]
        },
        {
          id: 'job_offer',
          question: "Do you currently have a job offer in the United States?",
          options: ["Yes, I have a job offer", "No, but I'm actively searching", "No, I need help finding opportunities"]
        },
        {
          id: 'timeline',
          question: "What is your preferred timeline for immigration?",
          options: ["Within 6 months", "6-12 months", "1-2 years", "2+ years", "Flexible"]
        },
        {
          id: 'family_situation',
          question: "Will you be immigrating with family members?",
          options: ["Just myself", "With spouse", "With spouse and children", "With other family members"]
        }
      ],
      student: [
        {
          id: 'education_level',
          question: "What level of education are you planning to pursue?",
          options: ["High School", "Bachelor's Degree", "Master's Degree", "PhD/Doctorate", "English Language Program"]
        },
        {
          id: 'field_of_study',
          question: "What field of study are you interested in?",
          options: ["STEM (Science, Technology, Engineering, Math)", "Business", "Arts & Humanities", "Social Sciences", "Medicine/Health", "Other"]
        },
        {
          id: 'school_acceptance',
          question: "Have you been accepted to a school in the United States?",
          options: ["Yes, I have an acceptance letter", "Applied, waiting for response", "Not yet applied", "Need help choosing schools"]
        },
        {
          id: 'funding',
          question: "How do you plan to fund your education?",
          options: ["Personal/Family funds", "Scholarships", "Student loans", "Employer sponsorship", "Mixed funding sources"]
        },
        {
          id: 'timeline',
          question: "When do you plan to start your studies?",
          options: ["Next semester", "Within 1 year", "1-2 years", "2+ years", "Flexible"]
        }
      ],
      family: [
        {
          id: 'relationship',
          question: "What is your relationship to your US sponsor?",
          options: ["Spouse", "Child", "Parent", "Sibling", "Other relative"]
        },
        {
          id: 'sponsor_status',
          question: "What is your sponsor's status in the United States?",
          options: ["US Citizen", "Green Card holder", "Work visa holder", "Not sure"]
        },
        {
          id: 'petition_filed',
          question: "Has a family petition been filed for you?",
          options: ["Yes, petition approved", "Yes, petition pending", "No, not filed yet", "Not sure"]
        },
        {
          id: 'timeline',
          question: "What is your preferred timeline for immigration?",
          options: ["Within 6 months", "6-12 months", "1-2 years", "2+ years", "Flexible"]
        },
        {
          id: 'family_situation',
          question: "Will other family members be immigrating with you?",
          options: ["Just myself", "With spouse", "With children", "With extended family", "Not sure"]
        }
      ],
      investment: [
        {
          id: 'investment_amount',
          question: "What is your planned investment amount?",
          options: ["$500,000 - $1,000,000", "$1,000,000 - $2,000,000", "$2,000,000+", "Not sure yet"]
        },
        {
          id: 'investment_type',
          question: "What type of investment are you considering?",
          options: ["EB-5 Regional Center", "Direct EB-5 Investment", "E-2 Treaty Investor", "Start a new business", "Buy existing business"]
        },
        {
          id: 'business_experience',
          question: "Do you have business management experience?",
          options: ["Extensive experience", "Some experience", "Limited experience", "No experience"]
        },
        {
          id: 'timeline',
          question: "What is your preferred timeline for immigration?",
          options: ["Within 1 year", "1-2 years", "2-3 years", "3+ years", "Flexible"]
        },
        {
          id: 'family_situation',
          question: "Will family members be included in your application?",
          options: ["Just myself", "With spouse", "With spouse and children", "With extended family"]
        }
      ],
      tourism: [
        {
          id: 'visit_purpose',
          question: "What is the primary purpose of your visit?",
          options: ["Vacation/Tourism", "Visit family/friends", "Business meetings", "Medical treatment", "Other"]
        },
        {
          id: 'duration',
          question: "How long do you plan to stay?",
          options: ["Less than 1 month", "1-3 months", "3-6 months", "Up to 1 year", "Not sure"]
        },
        {
          id: 'travel_history',
          question: "Have you traveled to the US before?",
          options: ["Yes, multiple times", "Yes, once", "No, first time", "Applied before but denied"]
        },
        {
          id: 'ties_to_home',
          question: "What ties do you have to your home country?",
          options: ["Job/Business", "Property ownership", "Family responsibilities", "Multiple strong ties", "Limited ties"]
        },
        {
          id: 'timeline',
          question: "When do you plan to travel?",
          options: ["Within 3 months", "3-6 months", "6-12 months", "1+ years", "Flexible"]
        }
      ],
      business: [
        {
          id: 'business_type',
          question: "What type of business activities will you conduct?",
          options: ["Meetings/Conferences", "Negotiations", "Training", "Trade shows", "Consulting", "Other"]
        },
        {
          id: 'business_relationship',
          question: "What is your relationship with the US business?",
          options: ["Same company (different location)", "Partner company", "Client/Customer", "Supplier", "New business relationship"]
        },
        {
          id: 'duration',
          question: "How long will your business activities take?",
          options: ["Few days", "1-2 weeks", "1 month", "2-3 months", "Up to 6 months"]
        },
        {
          id: 'frequency',
          question: "How often do you plan to travel for business?",
          options: ["One-time trip", "Occasional (few times a year)", "Regular (monthly)", "Frequent (weekly)", "Not sure"]
        },
        {
          id: 'timeline',
          question: "When do you need to travel?",
          options: ["Within 1 month", "1-3 months", "3-6 months", "6+ months", "Flexible"]
        }
      ],
      permanent: [
        {
          id: 'current_status',
          question: "What is your current immigration status?",
          options: ["Work visa holder", "Student visa holder", "Family visa holder", "No current visa", "Other"]
        },
        {
          id: 'pathway',
          question: "What pathway to permanent residence are you considering?",
          options: ["Employment-based", "Family-based", "Investment-based", "Diversity visa", "Not sure"]
        },
        {
          id: 'eligibility',
          question: "Do you believe you meet the eligibility requirements?",
          options: ["Yes, I meet all requirements", "Yes, but need confirmation", "Partially meet requirements", "Not sure", "Probably not"]
        },
        {
          id: 'timeline',
          question: "What is your preferred timeline for permanent residence?",
          options: ["Within 1 year", "1-2 years", "2-5 years", "5+ years", "Flexible"]
        },
        {
          id: 'family_situation',
          question: "Will family members be included in your application?",
          options: ["Just myself", "With spouse", "With spouse and children", "With extended family"]
        }
      ],
      other: [
        {
          id: 'specific_goal',
          question: "Can you specify your immigration goal?",
          options: ["Transit visa", "Medical treatment", "Religious work", "Cultural exchange", "Asylum/Refugee", "Other"]
        },
        {
          id: 'duration',
          question: "How long do you plan to stay in the United States?",
          options: ["Short-term (days/weeks)", "Medium-term (months)", "Long-term (years)", "Permanent", "Not sure"]
        },
        {
          id: 'urgency',
          question: "How urgent is your immigration need?",
          options: ["Very urgent (within weeks)", "Somewhat urgent (within months)", "Not urgent", "Flexible timing"]
        },
        {
          id: 'complexity',
          question: "How complex do you think your case might be?",
          options: ["Simple/Straightforward", "Moderately complex", "Very complex", "Not sure"]
        },
        {
          id: 'assistance',
          question: "What type of assistance do you need most?",
          options: ["Legal guidance", "Document preparation", "Process explanation", "Timeline planning", "All of the above"]
        }
      ]
    };
    
    // Get questions for the specific goal, fallback to work questions
    const questions = questionSets[goal] || questionSets.work;
    
    if (questionIndex < questions.length) {
      const question = questions[questionIndex];
      
      await simulateTyping(1000);
      await addMessage(question.question, false, false, null, null, null, true);
      await simulateTyping(500);
      await addMessage("", false, true, question.options.map(opt => ({ text: opt, value: opt })), "select", "Select your answer...");
      setWaitingForUser(true);
      setCurrentStep('pdf_question');
      
      // Update question flow state with current question
      setPdfQuestionFlow(prev => ({
        ...prev,
        currentQuestion: question,
        currentQuestionIndex: questionIndex
      }));
      
    } else {
      // All questions answered, generate PDF
      await generatePDFReport();
    }
  };

  // Ask the next question in the PDF flow (legacy function for compatibility)
  const askNextPDFQuestion = async () => {
    const currentIndex = pdfQuestionFlow.currentQuestionIndex;
    await askNextPDFQuestionWithIndex(currentIndex);
  };



  // Handle PDF question answer
  const handlePDFQuestionAnswer = async (answer) => {
    console.log('📄 [PDF] Received answer:', answer);
    
    // Store the answer and get the next question index
    const currentQuestion = pdfQuestionFlow.currentQuestion;
    const nextQuestionIndex = pdfQuestionFlow.currentQuestionIndex + 1;
    
    // Update state with answer and incremented index
    setPdfQuestionFlow(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: answer
      },
      currentQuestionIndex: nextQuestionIndex
    }));
    
    // User's answer is already shown by handleUserChoice, so no need to add it again
    
    // Ask next question with explicit index
    await askNextPDFQuestionWithIndex(nextQuestionIndex);
  };

  // Generate PDF report
  const generatePDFReport = async () => {
    console.log('📄 [PDF] Generating final report...');
    
    await simulateTyping(2000);
    addMessage("📄 **Excellent!** I now have all the information needed to create your comprehensive immigration report. Generating your personalized report...", null, null, null, null, null, true);
    
    // Trigger PDF generation
    if (onShowPDFGenerator) {
      setTimeout(() => {
        onShowPDFGenerator();
      }, 2000);
    }
  };

  // Enhanced handleWorldwideAIResponse to check for PDF generation
  const handleWorldwideAIResponse = async (question = null, goal = null) => {
    try {
      console.log('🔍 DEBUG: handleWorldwideAIResponse called with goal:', goal);
      console.log('🔍 DEBUG: userProfile.goal:', userProfile.goal);
      console.log('🔍 DEBUG: user tier:', user?.tier);
      console.log('🔍 DEBUG: selectedChatMode:', selectedChatMode);
      console.log('🔍 DEBUG: messages.length:', messages.length);
      
      const destCountry = destinationCountries[userProfile.destination_country];
      
      if (!question) {
        // Initial comprehensive guidance
        await addMessage("Let me get you comprehensive immigration guidance based on official government sources...");
        question = `I want to immigrate from ${userProfile.origin_country} to ${destCountry.name} for ${goal}. What should I know?`;
        console.log('🔍 DEBUG: Generated question:', question);
      } else {
        await addMessage("Analyzing your question with the latest immigration laws...");
      }
      
      await simulateTyping(1500);
      
      // Build complete user profile for worldwide API
      const profileData = {
        destination_country: userProfile.destination_country,
        origin_country: userProfile.origin_country,
        current_status: 'none',
        goal: goal || userProfile.goal
      };
      
      console.log('🔍 DEBUG: Sending profileData to API:', profileData);
      
      // Call the worldwide API
      const response = await callWorldwideAPI(question, profileData);
      console.log('🔍 DEBUG: Got response from API:', response ? response.substring(0, 100) + '...' : 'null');
      
      // Validate response
      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from API');
      }
      
      // Extract follow-up question from response
      const followUpQuestion = extractQuestionFromResponse(response);
      console.log('🔍 DEBUG: Extracted follow-up question:', followUpQuestion);
      
      // Clean the response (remove the question part)
      let cleanResponse = response;
      if (followUpQuestion && followUpQuestion !== "Is there anything else you would like to know?") {
        const questionSentences = response.split(/[.!]+/).map(s => s.trim()).filter(s => s.length > 0);
        const responseWithoutQuestion = questionSentences.filter(sentence => 
          !sentence.includes('?') && sentence.length > 10
        ).join('. ');
        
        if (responseWithoutQuestion.trim()) {
          cleanResponse = responseWithoutQuestion + '.';
        }
      }
      
      console.log('🔍 DEBUG: Final clean response:', cleanResponse.substring(0, 100) + '...');
      
      // Replace loading message with AI response
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && !lastMessage.isUser && 
            (lastMessage.text.includes("Let me get you") || lastMessage.text.includes("Analyzing your"))) {
          console.log('🔍 DEBUG: Replacing loading message with clean response');
          lastMessage.text = cleanResponse;
        } else {
          console.log('🔍 DEBUG: Could not find loading message to replace');
        }
        return newMessages;
      });
      
      // Send the AI response to avatar for speaking
      if (onAvatarSpeak && cleanResponse) {
        console.log('🗣️ Sending AI response to avatar for speaking');
        onAvatarSpeak(cleanResponse);
      }
      
      // Add follow-up question
      await simulateTyping(1500);
      await addMessage(followUpQuestion);
      
      // Send the follow-up question to avatar for speaking
      if (onAvatarSpeak && followUpQuestion) {
        console.log('🗣️ Sending follow-up question to avatar for speaking');
        onAvatarSpeak(followUpQuestion);
      }
      
      // Check if we should show PDF generation option
      const shouldShowPDFOption = await checkForPDFGenerationOption();
      if (shouldShowPDFOption) {
        return; // Exit early as PDF option is shown
      }
      
      // Always show text input for natural conversation flow
      setShowInputField(true);
      setInputPlaceholder("Ask me anything about immigration...");
      setWaitingForUser(true);
      
    } catch (error) {
      console.error('Worldwide AI response failed:', error);
      
      // Check if it's a rate limiting error
      if (error.message.includes('403')) {
        // Replace loading message with rate limit error
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && !lastMessage.isUser && 
              (lastMessage.text.includes("Let me get you") || lastMessage.text.includes("Analyzing your"))) {
            lastMessage.text = "🔄 You've reached your daily question limit. Upgrade to premium for unlimited AI consultations!";
          }
          return newMessages;
        });
        
        await simulateTyping(1000);
        addMessage("", false, true, [
          { text: "🚀 Upgrade to Premium", value: "upgrade_premium" },
          { text: "📋 Get personalized assessment", value: "get_assessment" },
          { text: "🔐 Login", value: "login" }
        ]);
        setWaitingForUser(true);
        return;
      }
      
      // Check if it's an authentication error
      if (error.message.includes('Authentication required')) {
        // Replace loading message with auth error
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && !lastMessage.isUser && 
              (lastMessage.text.includes("Let me get you") || lastMessage.text.includes("Analyzing your"))) {
            lastMessage.text = "🔐 Please log in to use the AI assistant";
          }
          return newMessages;
        });
        
        await simulateTyping(1000);
        addMessage("Create a free account to get 5 AI questions per day, or login if you already have an account!", false, true, [
          { text: "🔐 Login", value: "login" },
          { text: "🚀 Sign Up", value: "signup" },
          { text: "📋 Get personalized assessment", value: "get_assessment" }
        ]);
        setWaitingForUser(true);
        return;
      }
      
      // Get destination country name from user profile
      const destinationCountry = userProfile.destination_country || 'your destination';
      const countryName = destinationCountry.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      addMessage(`I apologize, but I'm having trouble accessing the immigration database for ${countryName}. Please try again, or I can connect you with our assessment team.`);
      
      await simulateTyping(1000);
      addMessage("", false, true, [
        { text: "🔄 Try again", value: "retry" },
        { text: "📋 Get personalized assessment", value: "get_assessment" }
      ]);
      setWaitingForUser(true);
    }
  };

  const callWorldwideAPI = async (question, profileData) => {
    try {
      console.log('🔍 Calling worldwide API:', { question, profileData });
      
      // Add instruction for more concise responses
      const modifiedQuestion = `${question}\n\n[Please provide a concise, direct response. Be helpful and engaging but avoid unnecessary filler words. Keep responses focused and to the point.]`;
      
      // Always check for authToken directly, not just user state
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 [WorldwideChat] Sending Authorization header with token:', authToken.substring(0, 20) + '...');
      } else {
        console.log('⚠️ [WorldwideChat] No auth token found - sending request without authentication');
      }

      const response = await fetch('http://localhost:8001/ask-worldwide', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          question: modifiedQuestion,
          user_profile: profileData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        if (response.status === 403) {
          throw new Error('403');
        }
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check if response is streaming based on content-type
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      console.log('🔍 Raw response received:', responseText.substring(0, 100) + '...');
      console.log('🔍 Content-Type:', contentType);
      
      // Check if response contains streaming data
      if (contentType && contentType.includes('text/event-stream') || responseText.includes('data: {')) {
        console.log('🔍 Processing streaming SSE response...');
        
        // More robust parsing for streaming response
        let fullContent = '';
        
        // Split by lines and process each data line
        const lines = responseText.split('\n');
        let inStreamingSection = false;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('data: {')) {
            inStreamingSection = true;
            try {
              const jsonStr = trimmedLine.substring(6); // Remove 'data: ' prefix
              
              // Handle incomplete JSON lines that end with periods
              const cleanJsonStr = jsonStr.replace(/\.$/, ''); // Remove trailing period
              
              if (cleanJsonStr && !cleanJsonStr.includes('"done": true')) {
                const jsonData = JSON.parse(cleanJsonStr);
                if (jsonData.content) {
                  fullContent += jsonData.content;
                }
              }
            } catch (parseError) {
              console.log('Skipping malformed JSON line:', trimmedLine);
            }
          } else if (inStreamingSection && trimmedLine === '') {
            // Empty line might signal end of streaming section
            continue;
          } else if (!trimmedLine.startsWith('data:') && !inStreamingSection && trimmedLine.length > 0) {
            // Regular content before streaming section
            fullContent += trimmedLine + ' ';
          }
        }
        
        // Clean up the content
        fullContent = fullContent.trim();
        
        console.log('✅ Parsed streaming content:', fullContent.substring(0, 200) + '...');
        return fullContent;
      } else {
        // Regular text response
        console.log('✅ Regular response received:', responseText.substring(0, 200) + '...');
        return responseText;
      }
    } catch (error) {
      console.error('❌ API call failed:', error);
      throw error;
    }
  };

  const extractQuestionFromResponse = (response) => {
    // Extract questions from the response
    const sentences = response.split(/[.!]+/).map(s => s.trim()).filter(s => s.length > 0);
    const questionSentences = sentences.filter(sentence => sentence.includes('?'));
    
    if (questionSentences.length > 0) {
      return questionSentences[questionSentences.length - 1];
    }
    
    return "Is there anything else you would like to know?";
  };

  // Premium intro functions
  const loadConversationHistory = async () => {
    console.log('🔍 [Debug] Starting to load conversation history');
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('authToken');
      console.log('🔍 [Debug] Auth token exists:', !!token);
      
      const response = await fetch('http://localhost:8001/auth/conversation-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 [Debug] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [Debug] API response data:', data);
        
        if (data.status === 'success') {
          console.log('✅ [Debug] Setting conversation history:', data.conversations);
          setConversationHistory(data.conversations || []);
          
          // Add conversation selection as chat messages
          setTimeout(async () => {
            // Ensure we have fresh translations for the current language
            console.log(`🔄 [Premium Intro] Loading fresh translations for: ${userLanguage}`);
            const currentTranslations = await loadStaticTranslations(userLanguage);
            console.log(`📋 [Premium Intro] Available translations:`, Object.keys(currentTranslations));
            
            const chooseMessage = getStaticTranslation(currentTranslations, 'messages', 'choose_continue');
            const freshButtonText = getStaticTranslation(currentTranslations, 'buttons', 'start_fresh_conversation');
            
            console.log(`📝 [Premium Intro] Choose message: "${chooseMessage}"`);
            console.log(`📝 [Premium Intro] Fresh button: "${freshButtonText}"`);
            
            // Use translations directly (they are already loaded)
            addMessage(chooseMessage);
            
            // Create combined options for same row display
            const allOptions = [
              { text: freshButtonText, value: "fresh", type: "button" }
            ];
            
            // Add dropdown options if previous conversations exist
            if (data.conversations && data.conversations.length > 0) {
              const previousConversations = data.conversations.map(conv => ({
                text: `📋 ${conv.title} (${formatDate(conv.last_updated)})`,
                value: conv.id,
                type: "option"
              }));
              
              const previousConversationsText = getStaticTranslation(currentTranslations, 'ui', 'previous_conversations') || "📋 Previous conversations";
              allOptions.push({
                text: previousConversationsText,
                value: "dropdown",
                type: "dropdown",
                options: previousConversations
              });
            }
            
            setTimeout(() => {
              addMessage("", false, true, allOptions, "mixed");
              setWaitingForUser(true);
              setCurrentStep('conversation_selection');
            }, 500);
          }, 1000);
        } else {
          console.log('❌ [Debug] API error:', data.message);
          // Fallback to fresh conversation only
          setTimeout(async () => {
            console.log(`🔄 [Fallback] Loading translations for: ${userLanguage}`);
            const currentTranslations = await loadStaticTranslations(userLanguage);
            const freshConversationText = getStaticTranslation(currentTranslations, 'messages', 'choose_continue');
            const freshButtonText = getStaticTranslation(currentTranslations, 'buttons', 'start_fresh_conversation');
            
            console.log(`📝 [Fallback] Choose message: "${freshConversationText}"`);
            console.log(`📝 [Fallback] Fresh button: "${freshButtonText}"`);
            
            const finalChooseMessage = freshConversationText;
            const finalFreshButtonText = freshButtonText;
            
            addMessage(finalChooseMessage);
            setTimeout(() => {
              addMessage("", false, true, [
                { text: finalFreshButtonText, value: "fresh" }
              ], "button");
              setWaitingForUser(true);
              setCurrentStep('conversation_selection');
            }, 800);
          }, 1000);
        }
      } else {
        console.error('❌ [Debug] API response not ok:', response.status);
        // Fallback to fresh conversation only
        setTimeout(async () => {
          const currentTranslations = await loadStaticTranslations(userLanguage);
          const freshConversationText = getStaticTranslation(currentTranslations, 'messages', 'choose_continue');
          const freshButtonText = getStaticTranslation(currentTranslations, 'buttons', 'start_fresh_conversation');
          addMessage(freshConversationText);
          setTimeout(() => {
            addMessage("", false, true, [
              { text: freshButtonText, value: "fresh" }
            ], "button");
            setWaitingForUser(true);
            setCurrentStep('conversation_selection');
          }, 800);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ [Debug] Error loading conversation history:', error);
      // Fallback to fresh conversation only
      setTimeout(async () => {
        const currentTranslations = await loadStaticTranslations(userLanguage);
        const freshConversationText = getStaticTranslation(currentTranslations, 'messages', 'choose_continue');
        const freshButtonText = getStaticTranslation(currentTranslations, 'buttons', 'start_fresh_conversation');
        addMessage(freshConversationText);
        setTimeout(() => {
          addMessage("", false, true, [
            { text: freshButtonText, value: "fresh" }
          ], "button");
          setWaitingForUser(true);
          setCurrentStep('conversation_selection');
        }, 800);
      }, 1000);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConversationSelect = (conversationId) => {
    setSelectedConversation(conversationId);
    setSelectedChatMode(''); // Reset mode when conversation changes
  };

  const handleModeSelect = (mode) => {
    setSelectedChatMode(mode);
  };

  const handlePremiumStart = async () => {
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
            onLoadConversation(data.conversation, selectedChatMode);
          }
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      }
    } else {
      // Start fresh conversation
      onStartConversation(selectedChatMode);
    }
    
    // Hide premium intro
    onHidePremiumIntro();
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

  // Handle premium intro when user logs in
  useEffect(() => {
    console.log('🔍 [Debug] Premium intro check:', {
      showPremiumIntro,
      user: user ? { email: user.email, tier: user.tier } : null,
      userTier: user?.tier,
      isPaidTier: user && ['starter', 'pro', 'elite'].includes(user.tier)
    });
    
    if (showPremiumIntro && user && ['starter', 'pro', 'elite'].includes(user.tier)) {
      console.log('✅ [Debug] Loading conversation history for premium user');
      
      // Prevent duplicate premium intro messages
      if (premiumIntroShownRef.current) {
        console.log('🔍 [Debug] Premium intro already shown, skipping');
        return;
      }
      
      // Mark as shown to prevent duplicates
      premiumIntroShownRef.current = true;
      
      // Clear any existing messages when premium intro is shown
      setMessages([]);
      setCurrentStep('premium_intro');
      setWaitingForUser(false);
      setShowInputField(false);
      conversationStartedRef.current = true; // Mark as started to prevent auto-start
      globalWorldwideConversationStarted = true;
      setQuestionCount(0); // Reset question count
      
      // Add premium intro message with proper language support
      setTimeout(async () => {
        // First, ensure we have the correct user language
        let actualUserLanguage = userLanguage;
        
        // For authenticated users, always fetch the latest language preference
        if (user) {
          try {
            const authToken = localStorage.getItem('authToken');
            const response = await fetch('http://localhost:8001/auth/get-language', {
              headers: {
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              actualUserLanguage = data.language || 'en';
              
              // Update local state if different
              if (actualUserLanguage !== userLanguage) {
                setUserLanguage(actualUserLanguage);
                console.log(`🌐 [Premium Intro] Updated language to: ${actualUserLanguage}`);
              }
            }
          } catch (error) {
            console.log(`❌ [Premium Intro] Error fetching language: ${error.message}`);
          }
        }
        
        // Load translations for the correct language
        console.log('🔄 [Premium Intro] Loading translations for:', actualUserLanguage);
        await loadLanguageTranslations(actualUserLanguage);
        
        // Try to get translations with fallback
        let welcomeMessage;
        try {
          const currentTranslations = await loadStaticTranslations(actualUserLanguage);
          welcomeMessage = getStaticTranslation(currentTranslations, 'ui', 'welcome_back_premium', { first_name: user.first_name });
          
          // If we get the raw key back, use fallback in the correct language
          if (welcomeMessage === 'welcome_back_premium' || !welcomeMessage) {
            // Use a generic fallback that works in any language
            if (actualUserLanguage === 'zh') {
              welcomeMessage = `欢迎回来，${user.first_name}！👋\n\n作为**高级会员**，您可以访问对话历史记录和高级功能。`;
            } else if (actualUserLanguage === 'es') {
              welcomeMessage = `¡Bienvenido de vuelta, ${user.first_name}! 👋\n\nComo **miembro Premium**, tienes acceso al historial de conversaciones y funciones avanzadas.`;
            } else {
              welcomeMessage = `Welcome back, ${user.first_name}! 👋\n\nAs a **Premium member**, you have access to conversation history and advanced features.`;
            }
          }
        } catch (error) {
          console.log('❌ [Premium Intro] Translation error, using language-appropriate fallback:', error.message);
          if (actualUserLanguage === 'zh') {
            welcomeMessage = `欢迎回来，${user.first_name}！👋\n\n作为**高级会员**，您可以访问对话历史记录和高级功能。`;
          } else if (actualUserLanguage === 'es') {
            welcomeMessage = `¡Bienvenido de vuelta, ${user.first_name}! 👋\n\nComo **miembro Premium**, tienes acceso al historial de conversaciones y funciones avanzadas.`;
          } else {
            welcomeMessage = `Welcome back, ${user.first_name}! 👋\n\nAs a **Premium member**, you have access to conversation history and advanced features.`;
          }
        }
        
        console.log('📝 [Premium Intro] Welcome message:', welcomeMessage);
        addMessage(welcomeMessage, false, false, null, null, null, true);
        setTimeout(() => {
          loadConversationHistory();
        }, 1000);
      }, 500);
    }
    
    // Set default mode for paid tier users who might bypass intro
    if (user && ['starter', 'pro', 'elite'].includes(user.tier) && !selectedChatMode && selectedMode) {
      console.log('🔍 [Debug] Setting default chat mode for paid tier user:', selectedMode);
      setSelectedChatMode(selectedMode);
    }
  }, [showPremiumIntro, user, selectedMode]);

  // Load non-premium intro when component mounts for non-premium users
  useEffect(() => {
    console.log('🔍 [Debug] Non-premium intro check:', {
      showNonPremiumIntro,
      user: user ? { email: user.email, tier: user.tier } : null,
      userTier: user?.tier,
      isNonPremium: user && user.tier !== 'premium'
    });
    
    if (showNonPremiumIntro && user && user.tier !== 'premium') {
      console.log('✅ [Debug] Showing non-premium intro for logged-in user');
      
      // Clear any existing messages when non-premium intro is shown
      setMessages([]);
      setCurrentStep('non_premium_intro');
      setWaitingForUser(false);
      setShowInputField(false);
      conversationStartedRef.current = true; // Mark as started to prevent auto-start
      globalWorldwideConversationStarted = true;
      setQuestionCount(0); // Reset question count
      
      // Add non-premium intro messages
      setTimeout(() => {
        const welcomeMessage = getText('ui', 'welcome_user', { first_name: user.first_name });
        addMessage(welcomeMessage, false, false, null, null, null, true);
        
        setTimeout(() => {
          const modeOptions = [
            { 
              text: getText('buttons', 'qa_mode'),
              value: "qa" 
            },
            { 
              text: getText('buttons', 'pdf_report'),
              value: "pdf" 
            }
          ];
          
          addMessage("", false, true, modeOptions, "buttons");
          setWaitingForUser(true);
          setCurrentStep('non_premium_mode_selection');
        }, 1000);
      }, 500);
    }
  }, [showNonPremiumIntro, user]);

  const startWorldwideConversation = async (isFreshStart = false) => {
    console.log('🌍 Starting worldwide conversation...', isFreshStart ? '(Fresh Start)' : '(Regular)');
    console.log('🌐 [startWorldwideConversation] Current user language:', userLanguage);
    
    // Ensure we have the user's language preference before starting
    if (user && userLanguage === 'en') {
      // Try to get the actual language preference for authenticated users
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('http://localhost:8001/auth/get-language', {
          headers: {
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.language && data.language !== 'en') {
            setUserLanguage(data.language);
            console.log(`🌐 [startWorldwideConversation] Updated language to: ${data.language}`);
          }
        }
      } catch (error) {
        console.log(`🌐 [startWorldwideConversation] Error fetching language: ${error.message}`);
      }
    }
    
    // For fresh starts or free users, always use generic welcome (no API calls)
    if (isFreshStart || !user || user.tier === 'free') {
      console.log('🆕 Using generic welcome (fresh start or free user)');
      
      const worldwideSteps = await getWorldwideSteps();
      const welcomeStep = worldwideSteps.welcome;
      
      await simulateTyping(1000);
      await addMessage(await welcomeStep.getMessage(), false, false, null, null, null, true);
      
      await simulateTyping(1500);
      await addMessage(welcomeStep.getNextMessage(), false, false, null, null, null, true);
      
      await simulateTyping(800);
      await addMessage("", false, true, welcomeStep.getOptions(), welcomeStep.inputType, welcomeStep.getPlaceholder());
      
      setWaitingForUser(true);
      setCurrentStep('welcome');
      return;
    }
    
    // Only for paid users, check if they have conversation history and try personalized welcome
    if (user && ['starter', 'pro', 'elite', 'premium'].includes(user.tier)) {
      try {
        console.log('🔍 Checking for personalized welcome for paid user...');
        
        // Build basic profile from available data
        const profileData = {
          destination_country: userProfile.destination_country || 'united_states',
          origin_country: userProfile.origin_country || user?.origin_country || 'united_states',
          goal: userProfile.goal || 'family'
        };
        
        // Only make API call if user has some profile data suggesting returning user
        if (user.origin_country || Object.keys(userProfile).length > 0) {
          // Make API call with simple greeting to trigger personalized welcome
          const personalizedWelcome = await callWorldwideAPI('Hello', profileData);
          
          if (personalizedWelcome && personalizedWelcome.length > 0) {
            console.log('✅ Got personalized welcome from backend');
            
            // Display the personalized welcome message with buttons
            await simulateTyping(1000);
            await addMessage(personalizedWelcome, false, true, [
              { text: "✅ Yes, continue with this", value: "continue_previous" },
              { text: "🔄 No, I want to discuss something else", value: "start_fresh" }
            ]);
            
            // Send the welcome message to avatar for speaking
            if (onAvatarSpeak && personalizedWelcome) {
              console.log('🗣️ Sending initial welcome to avatar for speaking');
              onAvatarSpeak(personalizedWelcome);
            }
            
            setWaitingForUser(true);
            setCurrentStep('personalized_welcome');
            setProfileComplete(true); // Enable AI responses
            return;
          }
        }
      } catch (error) {
        console.log('❌ Failed to get personalized welcome, using generic:', error.message);
        // Fall through to generic welcome
      }
    }
    
    // Generic welcome for new paid users or if personalized welcome failed
    console.log('📝 Using generic welcome');
    const worldwideSteps = await getWorldwideSteps();
    const welcomeStep = worldwideSteps.welcome;
    
    await simulateTyping(1000);
    await addMessage(await welcomeStep.getMessage(), false, false, null, null, null, true);
    
    await simulateTyping(1500);
    await addMessage(welcomeStep.getNextMessage(), false, false, null, null, null, true);
    
    await simulateTyping(800);
    await addMessage("", false, true, welcomeStep.getOptions(), welcomeStep.inputType, welcomeStep.getPlaceholder());
    
    setWaitingForUser(true);
    setCurrentStep('welcome');
  };

  // Handle special button clicks
  const handleSpecialChoice = async (choice) => {
    if (choice === 'login' || choice === 'signup') {
      // These will be handled by the parent component's tab switching
      return;
    }
    
    if (choice === 'get_assessment') {
      if (onShowLeadForm) {
        onShowLeadForm();
      }
      return;
    }
    
    if (choice === 'generate_pdf') {
      if (onShowPDFGenerator) {
        onShowPDFGenerator();
      }
      return;
    }
    
    if (choice === 'retry') {
      await handleWorldwideAIResponse();
      return;
    }
    
    // Handle premium intro conversation selection
    if (currentStep === 'conversation_selection') {
      setSelectedConversation(choice);
      setWaitingForUser(false);
      
      // Show user's choice
      const currentTranslations = await loadStaticTranslations(userLanguage);
      const freshButtonText = getStaticTranslation(currentTranslations, 'buttons', 'start_fresh_conversation');
      const selectedOption = choice === 'fresh' ? 
        freshButtonText : 
        conversationHistory.find(c => c.id === choice)?.title || "Selected conversation";
      addMessage(selectedOption, true);
      
      await simulateTyping(800);
      
      // Show mode selection as buttons (cleaner for just 2 options)
      const perfectModeMessage = getStaticTranslation(currentTranslations, 'messages', 'perfect_qa_mode') || "Perfect! Now choose your consultation mode:";
      addMessage(perfectModeMessage);
      
      const qaText = getStaticTranslation(currentTranslations, 'buttons', 'qa_mode_interactive') || "💬 Q&A Mode - Interactive conversation with Sarah";
      const pdfText = getStaticTranslation(currentTranslations, 'buttons', 'pdf_mode_report') || "📄 PDF Mode - Generate comprehensive report";
      
      const modeOptions = [
        { text: qaText, value: "qa" },
        { text: pdfText, value: "pdf" }
      ];
      
      setTimeout(() => {
        addMessage("", false, true, modeOptions, "buttons", "Select mode");
        setWaitingForUser(true);
        setCurrentStep('mode_selection');
      }, 1000);
      
      return;
    }
    
    // Handle premium intro mode selection
    if (currentStep === 'mode_selection') {
      setSelectedChatMode(choice);
      setWaitingForUser(false);
      
      // Show user's choice
      const currentTranslations = await loadStaticTranslations(userLanguage);
      const qaText = getStaticTranslation(currentTranslations, 'buttons', 'qa_mode_interactive') || "💬 Q&A Mode - Interactive conversation with Sarah";
      const pdfText = getStaticTranslation(currentTranslations, 'buttons', 'pdf_mode_report') || "📄 PDF Mode - Generate comprehensive report";
      
      const selectedMode = choice === 'qa' ? qaText : pdfText;
      addMessage(selectedMode, true);
      
      await simulateTyping(800);
      
      if (selectedConversation === 'fresh') {
        // Start fresh conversation
        if (choice === 'pdf') {
          const activatingMessage = getStaticTranslation(currentTranslations, 'messages', 'activating_report_mode') || "Activating Report Generation Mode...";
          addMessage(activatingMessage);
          await simulateTyping(1000);
          
          // For premium PDF mode, start consultation to gather info for detailed report
          setMessages([]); // Clear premium intro messages
          startWorldwideConversation(true); // Start fresh consultation
        } else {
          const startingMessage = getStaticTranslation(currentTranslations, 'messages', 'starting_consultation') || "Starting your fresh consultation session...";
          addMessage(startingMessage);
          await simulateTyping(1000);
          
          // For Q&A mode, start fresh conversation directly
          setMessages([]); // Clear premium intro messages
          startWorldwideConversation(true); // Pass fresh start flag
        }
      } else {
        // Load previous conversation
        const conversation = conversationHistory.find(c => c.id === selectedConversation);
        if (choice === 'pdf') {
          const loadingReportMessage = getStaticTranslation(currentTranslations, 'messages', 'loading_conversation_report', { title: conversation?.title }) || `Loading your previous conversation: "${conversation?.title}"... I'll then generate a comprehensive report based on our discussion.`;
          addMessage(loadingReportMessage);
        } else {
          const loadingMessage = getStaticTranslation(currentTranslations, 'messages', 'loading_conversation', { title: conversation?.title }) || `Loading your previous conversation: "${conversation?.title}"...`;
          addMessage(loadingMessage);
        }
        onLoadConversation(conversation, choice);
      }
      
      return;
    }
    
    // Handle non-premium intro mode selection
    if (currentStep === 'non_premium_mode_selection') {
      setWaitingForUser(false);
      
              // Show user's choice
        const currentTranslations = await loadStaticTranslations(userLanguage);
        const qaText = getStaticTranslation(currentTranslations, 'buttons', 'qa_mode') || "💬 Q&A Mode - Ask questions directly";
        const pdfText = getStaticTranslation(currentTranslations, 'buttons', 'pdf_report') || "📄 PDF Report - Get a comprehensive report";
        const selectedMode = choice === 'qa' ? qaText : pdfText;
        addMessage(selectedMode, true);
        
        await simulateTyping(800);
        
        if (choice === 'pdf') {
          // Start PDF generation for non-premium user
          const generatingMessage = getStaticTranslation(currentTranslations, 'messages', 'generating_report') || "Generating your immigration report...";
          addMessage(generatingMessage);
          await simulateTyping(1000);
          onStartNonPremiumConversation(choice);
      } else {
        // Start Q&A mode with question limit
        const currentTranslations = await loadStaticTranslations(userLanguage);
        const perfectMessage = getStaticTranslation(currentTranslations, 'messages', 'perfect_qa_mode', { limit: maxQuestions }) || `Perfect! You can ask up to ${maxQuestions} questions. Let's get started!`;
        const questionMessage = getStaticTranslation(currentTranslations, 'ui', 'whats_immigration_goal') || "What's your immigration question?";
        const placeholder = getStaticTranslation(currentTranslations, 'placeholders', 'ask_immigration_question') || "Ask your immigration question...";
        
        addMessage(perfectMessage);
        await simulateTyping(1000);
        
        addMessage(questionMessage);
        setShowInputField(true);
        setInputPlaceholder(placeholder);
        setWaitingForUser(true);
        setCurrentStep('non_premium_qa');
      }
      
      return;
    }
    
    // Handle personalized welcome responses
    if (choice === 'continue_previous') {
      addMessage("✅ Yes, continue with this", true);
      await simulateTyping(1000);
      
      // Continue with previous immigration topic using stored profile
      const profileData = {
        destination_country: userProfile.destination_country || 'united_states',
        origin_country: userProfile.origin_country || user?.origin_country || 'kenya',
        goal: userProfile.goal || 'family'
      };
      
      const currentTranslations = await loadStaticTranslations(userLanguage);
      const continueMessage = getStaticTranslation(currentTranslations, 'messages', 'perfect_continue') || "Perfect! Let me continue helping you with your immigration case...";
      addMessage(continueMessage);
      
      // Send response to avatar for speaking
      if (onAvatarSpeak) {
        console.log('🗣️ Sending continue response to avatar for speaking');
        onAvatarSpeak(continueMessage);
      }
      
      await simulateTyping(1500);
      
      // Call AI to get contextual follow-up
      await handleWorldwideAIResponse("Continue helping me with my case", userProfile.goal || 'family');
      return;
    }
    
    if (choice === 'start_fresh') {
      addMessage("🔄 No, I want to discuss something else", true);
      await simulateTyping(1000);
      
      // Start fresh conversation flow
      const currentTranslations = await loadStaticTranslations(userLanguage);
      const noProblemMessage = getStaticTranslation(currentTranslations, 'messages', 'no_problem_discuss') || "No problem! What would you like to discuss today?";
      addMessage(noProblemMessage);
      
      // Send response to avatar for speaking
      if (onAvatarSpeak) {
        console.log('🗣️ Sending start fresh response to avatar for speaking');
        onAvatarSpeak(noProblemMessage);
      }
      
      await simulateTyping(1000);
      
      // Show text input for new topic
      const questionPlaceholder = getStaticTranslation(currentTranslations, 'placeholders', 'ask_immigration_question') || "What's your immigration question?";
      setShowInputField(true);
      setInputPlaceholder(questionPlaceholder);
      setWaitingForUser(true);
      setCurrentStep('fresh_start');
      return;
    }
    
    // Handle other special cases
    if (choice.includes('application_process') || choice.includes('required_documents') || 
        choice.includes('costs_fees') || choice.includes('processing_times')) {
      const questionMap = {
        'application_process': 'What is the application process?',
        'required_documents': 'What documents do I need?',
        'costs_fees': 'What are the costs and fees?',
        'processing_times': 'How long does processing take?'
      };
      
      const question = questionMap[choice] || 'Tell me more about this.';
      await handleTextInput(question);
      return;
    }
    
    // Handle upgrade prompt for non-premium users
    if (currentStep === 'upgrade_prompt') {
      setWaitingForUser(false);
      
      if (choice === 'upgrade_premium') {
        addMessage("🚀 Upgrade to Premium", true);
        await simulateTyping(800);
        
        // Show upgrade information
        addMessage("🌟 **Premium Membership Benefits:**\n\n• **Unlimited Q&A** - Ask as many questions as you need\n• **Conversation History** - Resume previous discussions\n• **Detailed PDF Reports** - Comprehensive immigration guides\n• **Priority Support** - Faster response times\n\n💰 **Only $9.99/month** - Cancel anytime");
        
        setTimeout(() => {
          const subscribeOptions = [
            { text: "💳 Subscribe Now", value: "subscribe_premium" },
            { text: "📄 Get Simple Report Instead", value: "generate_simple_report" }
          ];
          
          addMessage("", false, true, subscribeOptions, "buttons");
          setWaitingForUser(true);
          setCurrentStep('subscription_prompt');
        }, 1000);
        
      } else if (choice === 'generate_simple_report') {
        addMessage("📄 Generate Simple Report", true);
        await simulateTyping(800);
        
        addMessage("I'll generate a simple one-page immigration report for you based on our conversation.");
        await simulateTyping(1000);
        
        // Trigger simple PDF generation
        onStartNonPremiumConversation('pdf');
      }
      
      return;
    }

    // Handle subscription prompt
    if (currentStep === 'subscription_prompt') {
      setWaitingForUser(false);
      
      if (choice === 'subscribe_premium') {
        addMessage("💳 Subscribe Now", true);
        await simulateTyping(800);
        
        // Redirect to subscription page or show payment form
        addMessage("🔄 **Redirecting to secure payment...**\n\nYou'll be redirected to our secure payment processor to complete your Premium upgrade.");
        
        // Here you would integrate with your payment processor
        // For now, just show a message
        setTimeout(() => {
          window.open('https://your-payment-processor.com', '_blank');
        }, 2000);
        
      } else if (choice === 'generate_simple_report') {
        addMessage("📄 Get Simple Report Instead", true);
        await simulateTyping(800);
        
        addMessage("I'll generate a simple one-page immigration report for you based on our conversation.");
        await simulateTyping(1000);
        
        // Trigger simple PDF generation
        onStartNonPremiumConversation('pdf');
      }
      
      return;
    }
    
    // Default: treat as regular choice
    await handleUserChoice(choice);
  };

  // Handle signup button click
  const handleSignupClick = () => {
    // Store current guest session data for transfer after signup
    const currentSelections = {
      destination_country: userProfile.destination_country,
      origin_country: userProfile.origin_country,
      goal: userProfile.goal
    };
    
    setSignupData(currentSelections);
    setShowSignupModal(true);
  };

  // Handle successful authentication
  const handleAuthSuccess = async (userData, token) => {
    setShowSignupModal(false);
    
    // Store auth info
    localStorage.setItem('authToken', token);
    localStorage.setItem('userInfo', JSON.stringify(userData));
    
    // Show success message
    addMessage("🎉 Account created successfully! Welcome to World Immigration Consultant!");
    await simulateTyping(1000);
    
    // Continue the conversation with the new user context
    addMessage("Now let me continue with your personalized immigration plan...");
    await simulateTyping(1500);
    
    // Call AI with the stored guest session data
    const profileData = signupData || userProfile;
    await handleWorldwideAIResponse("Continue with my immigration plan", profileData.goal);
    
    // Clear signup data
    setSignupData(null);
    
    // Update parent component user state without page reload
    // This will be handled by the parent component's user state management
    console.log('✅ [Auth] Authentication successful - user state will be updated by parent');
  };

  // Render message text with signup button replacement
  const renderMessageText = (text) => {
    if (!text) return '';
    
    // Convert literal \n\n to actual line breaks
    const formattedText = text
      .replace(/\\n\\n/g, '\n\n')  // Convert literal \n\n to actual newlines
      .replace(/\\n/g, '\n')       // Convert literal \n to actual newlines
      .replace(/\n\n+/g, '\n\n')   // Normalize multiple newlines
      .trim();
    
    // Split by newlines and render with proper spacing
    const lines = formattedText.split('\n');
    
    return lines.map((line, index) => {
      if (line.trim() === '') {
        return <br key={index} />;
      }
      
      // Handle markdown-style formatting
      let processedLine = line;
      
      // Bold text
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Bullet points
      if (processedLine.trim().startsWith('•') || processedLine.trim().startsWith('-')) {
        return (
          <div key={index} style={{ marginLeft: '20px', marginBottom: '5px' }}>
            <span dangerouslySetInnerHTML={{ __html: processedLine }} />
          </div>
        );
      }
      
      return (
        <div key={index} style={{ marginBottom: index < lines.length - 1 ? '8px' : '0' }}>
          <span dangerouslySetInnerHTML={{ __html: processedLine }} />
        </div>
      );
    });
  };

  // Language-aware fallback system
  const getLanguageAwareFallback = (key, language) => {
    const fallbacks = {
      'messages.choose_continue': {
        'en': 'Choose how you\'d like to continue:',
        'es': 'Elige cómo te gustaría continuar:',
        'fr': 'Choisissez comment vous aimeriez continuer :',
        'de': 'Wählen Sie, wie Sie fortfahren möchten:',
        'pt': 'Escolha como gostaria de continuar:',
        'ru': 'Выберите, как вы хотите продолжить:',
        'zh': '选择您希望如何继续：',
        'hi': 'चुनें कि आप कैसे जारी रखना चाहते हैं:',
        'ar': 'اختر كيف تريد المتابعة:',
        'ja': '続行方法を選択してください：',
        'ko': '계속하려는 방법을 선택하세요：',
        'it': 'Scegli come vorresti continuare:',
        'tr': 'Nasıl devam etmek istediğinizi seçin:',
        'vi': 'Chọn cách bạn muốn tiếp tục:',
        'th': 'เลือกว่าคุณต้องการดำเนินการต่อยังไง:',
        'pl': 'Wybierz, jak chcesz kontynuować:',
        'nl': 'Kies hoe je wilt doorgaan:',
        'sv': 'Välj hur du vill fortsätta:',
        'id': 'Pilih bagaimana Anda ingin melanjutkan:',
        'fil': 'Piliin kung paano ninyo gustong magpatuloy:',
        'hu': 'Válassza ki, hogyan szeretne folytatni:',
        'cs': 'Vyberte, jak chcete pokračovat:',
        'uk': 'Виберіть, як ви хочете продовжити:',
        'ms': 'Pilih bagaimana anda ingin meneruskan:'
      },
      'buttons.start_fresh_conversation': {
        'en': '🆕 Start Fresh Conversation',
        'es': '🆕 Iniciar Conversación Nueva',
        'fr': '🆕 Commencer une Nouvelle Conversation',
        'de': '🆕 Neues Gespräch beginnen',
        'pt': '🆕 Iniciar Conversa Nova',
        'ru': '🆕 Начать новую беседу',
        'zh': '🆕 开始新对话',
        'hi': '🆕 नई बातचीत शुरू करें',
        'ar': '🆕 بدء محادثة جديدة',
        'ja': '🆕 新しい会話を始める',
        'ko': '🆕 새로운 대화 시작',
        'it': '🆕 Inizia Nuova Conversazione',
        'tr': '🆕 Yeni Konuşma Başlat',
        'vi': '🆕 Bắt đầu cuộc trò chuyện mới',
        'th': '🆕 เริ่มการสนทนาใหม่',
        'pl': '🆕 Rozpocznij nową rozmowę',
        'nl': '🆕 Begin nieuw gesprek',
        'sv': '🆕 Starta nytt samtal',
        'id': '🆕 Mulai percakapan baru',
        'fil': '🆕 Simulan ang bagong pag-uusap',
        'hu': '🆕 Új beszélgetés kezdése',
        'cs': '🆕 Začít novou konverzaci',
        'uk': '🆕 Почати нову розмову',
        'ms': '🆕 Mulakan perbualan baru'
      }
    };
    
    return fallbacks[key]?.[language] || fallbacks[key]?.['en'] || 'Translation not found';
  };

  // Render component with proper ConversationalChat structure
  return (
    <div className="conversational-chat">
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.isUser ? 'user' : 'assistant'}`}>
            <div className="message-content">
              {message.text && renderMessageText(message.text)}
              
              {message.hasOptions && message.options && (
                <div className="message-options">
                  {message.inputType === 'select' ? (
                    <select
                      className="dropdown-select"
                      onChange={(e) => {
                        if (waitingForUser && e.target.value) {
                          handleSpecialChoice(e.target.value);
                        }
                      }}
                      disabled={!waitingForUser}
                      defaultValue=""
                    >
                      <option value="" disabled>{message.placeholder || "Select an option"}</option>
                      {message.options.map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.text}
                        </option>
                      ))}
                    </select>
                  ) : message.inputType === 'mixed' ? (
                    <div className="mixed-options">
                      {message.options.map((option, index) => (
                        option.type === 'button' ? (
                          <button
                            key={index}
                            className={`option-button ${!waitingForUser ? 'disabled' : ''}`}
                            onClick={() => {
                              console.log('Button clicked:', option.value);
                              if (waitingForUser) {
                                handleSpecialChoice(option.value);
                              }
                            }}
                            disabled={!waitingForUser}
                          >
                            <span className="option-text">{option.text}</span>
                          </button>
                        ) : option.type === 'dropdown' ? (
                          <select
                            key={index}
                            className="dropdown-select"
                            onChange={(e) => {
                              if (waitingForUser && e.target.value) {
                                handleSpecialChoice(e.target.value);
                              }
                            }}
                            disabled={!waitingForUser}
                            defaultValue=""
                          >
                            <option value="" disabled>{option.text}</option>
                            {option.options.map((subOption, subIndex) => (
                              <option key={subIndex} value={subOption.value}>
                                {subOption.text}
                              </option>
                            ))}
                          </select>
                        ) : null
                      ))}
                    </div>
                  ) : (
                    message.options.map((option, index) => (
                      <button
                        key={index}
                        className={`option-button ${!waitingForUser ? 'disabled' : ''}`}
                        onClick={() => {
                          console.log('Button clicked:', option.value);
                          if (waitingForUser) {
                            handleSpecialChoice(option.value);
                          }
                        }}
                        disabled={!waitingForUser}
                      >
                        <span className="option-icon">{option.icon}</span>
                        <span className="option-text">{option.text}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        {showInputField && (
          <div className="text-input-container">
            <input
              type="text"
              placeholder={inputPlaceholder}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleTextInput(e.target.value.trim());
                  e.target.value = '';
                }
              }}
              autoFocus
              className="text-input"
            />
            <button
              className="send-button"
              onClick={(e) => {
                const input = e.target.previousSibling;
                if (input.value.trim()) {
                  handleTextInput(input.value.trim());
                  input.value = '';
                }
              }}
            >
              Send
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Signup Modal */}
      {showSignupModal && (
        <UserAuth
          onClose={() => setShowSignupModal(false)}
          initialMode="register"
          onAuthSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default WorldwideChat;