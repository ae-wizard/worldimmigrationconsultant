// Import React for hooks
import React from 'react';

// Static translations cache
let staticTranslationsCache = {};

// Clear translations cache (useful for debugging)
export const clearTranslationsCache = () => {
  staticTranslationsCache = {};
  console.log('🧹 [Static Translations] Cache cleared');
};

// Language code to name mapping for backend API
const LANGUAGE_MAPPING = {
  'en': 'English',
  'es': 'Spanish', 
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'pl': 'Polish',
  'tr': 'Turkish',
  'hi': 'Hindi',
  'ur': 'Urdu',
  'id': 'Indonesian',
  'th': 'Thai',
  'hu': 'Hungarian',
  'no': 'Norwegian',
  'bg': 'Bulgarian',
  'ro': 'Romanian',
  'el': 'Greek',
  'fi': 'Finnish',
  'hr': 'Croatian',
  'da': 'Danish',
  'ta': 'Tamil',
  'fil': 'Filipino',
  'cs': 'Czech',
  'sk': 'Slovak',
  'uk': 'Ukrainian',
  'ms': 'Malay'
};

// Load static translations for a language
export const loadStaticTranslations = async (language = 'en') => {
  // Clear cache for the specific language to ensure fresh load
  if (staticTranslationsCache[language]) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧹 [Static Translations] Clearing cache for ${language} to ensure fresh load`);
    }
    delete staticTranslationsCache[language];
  }

  try {
    // Map language code to backend language name
    const backendLanguage = LANGUAGE_MAPPING[language] || 'English';
    if (process.env.NODE_ENV === 'development') {
      console.log(`🌐 [Static Translations] Loading translations for ${language} (backend: ${backendLanguage})...`);
    }
    
    // Add timeout for fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://localhost:8001/static-translations/${backendLanguage}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      
      staticTranslationsCache[language] = data.translations;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [Static Translations] Backend response:`, data);
        console.log(`🔍 [Static Translations] Translation keys:`, Object.keys(data.translations));
        console.log(`🔍 [Static Translations] Messages keys:`, Object.keys(data.translations.messages || {}));
        console.log(`🔍 [Static Translations] Buttons keys:`, Object.keys(data.translations.buttons || {}));
        console.log(`🔍 [Static Translations] UI keys:`, Object.keys(data.translations.ui || {}));
        console.log(`✅ [Static Translations] Loaded and cached translations for ${language}`);
        console.log(`✅ [Static Translations] Cached keys:`, Object.keys(staticTranslationsCache[language]));
        console.log(`✅ [Static Translations] Sample UI translation (welcome_sarah_simple):`, data.translations.ui?.welcome_sarah_simple);
        console.log(`✅ [Static Translations] Sample UI translation (latest_government_data):`, data.translations.ui?.latest_government_data);
      }
      
      return data.translations;
    } else {
      console.log(`⚠️ [Static Translations] Failed to load ${backendLanguage} (${response.status}), falling back to English`);
      // Try to load English as fallback
      if (language !== 'en') {
        return await loadStaticTranslations('en');
      }
      return {};
    }
  } catch (error) {
    console.log(`❌ [Static Translations] Error loading ${language}: ${error.message}`);
    // Try to load English as fallback
    if (language !== 'en' && !error.name === 'AbortError') {
      return await loadStaticTranslations('en');
    }
    return {};
  }
};

// Get static translation for a key with placeholder replacement
export const getStaticTranslation = (translations, category, key, placeholders = {}) => {
  try {
    const text = translations[category]?.[key];
    if (!text) {
      console.log(`⚠️ [Static Translations] Missing translation: ${category}.${key}`);
      return key; // Return the key if translation not found
    }

    // Replace placeholders in the text
    let finalText = text;
    Object.entries(placeholders).forEach(([placeholder, value]) => {
      finalText = finalText.replace(new RegExp(`{${placeholder}}`, 'g'), value);
    });

    return finalText;
  } catch (error) {
    console.log(`❌ [Static Translations] Error getting translation for ${category}.${key}: ${error.message}`);
    return key; // Return the key as fallback
  }
};

// API-based translation utility for dynamic content (AI responses, user-generated content)
export const translateDynamicText = async (text, targetLanguage = 'en', placeholders = {}) => {
  if (!text || !text.trim() || targetLanguage === 'en') {
    // Still need to replace placeholders even in English
    let finalText = text;
    Object.entries(placeholders).forEach(([key, value]) => {
      finalText = finalText.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    return finalText;
  }
  
  try {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch('http://localhost:8001/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        text: text,
        target_language: targetLanguage,
        source_language: 'en'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      let translatedText = data.translated_text;
      
      // Replace placeholders in translated text
      Object.entries(placeholders).forEach(([key, value]) => {
        translatedText = translatedText.replace(new RegExp(`{${key}}`, 'g'), value);
      });
      
      return translatedText;
    } else {
      console.log(`⚠️ [Dynamic Translation] Failed: ${response.status}`);
      // Fallback: replace placeholders in original text
      let finalText = text;
      Object.entries(placeholders).forEach(([key, value]) => {
        finalText = finalText.replace(new RegExp(`{${key}}`, 'g'), value);
      });
      return finalText;
    }
  } catch (error) {
    console.log(`❌ [Dynamic Translation] Error: ${error.message}`);
    // Fallback: replace placeholders in original text
    let finalText = text;
    Object.entries(placeholders).forEach(([key, value]) => {
      finalText = finalText.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    return finalText;
  }
};

// Legacy compatibility - now uses static translations for better performance
export const translateUIText = translateDynamicText;

// UI text constants that need translation
export const UI_TEXTS = {
  MEET_SARAH: "Meet Sarah",
  AI_IMMIGRATION_CONSULTANT: "Your AI Immigration Consultant",
  UPGRADE_TO_TALK_WITH_SARAH: "🌟 Upgrade to Talk with Sarah!",
  UNLOCK_AVATAR_CONSULTATIONS: "Unlock avatar consultations with our AI immigration expert Sarah!",
  FACE_TO_FACE_CONSULTATIONS: "⭐ Face-to-face consultations with Sarah",
  PREMIUM_DETAILED_PDF_REPORTS: "📄 Premium detailed PDF reports", 
  UNLIMITED_AI_CONVERSATIONS: "💬 Unlimited AI conversations",
  PRIORITY_EMAIL_SUPPORT: "📧 Priority email support",
  UPGRADE_NOW: "🚀 Upgrade Now",
  STARTING_AT_PRICE: "Starting at $19.99/month",
  READY_TO_GET_STARTED: "🌟 Ready to Get Started?",
  CREATE_FREE_ACCOUNT: "Create your FREE account to interact with Sarah and get personalized immigration guidance!",
  CHAT_WITH_AI_CONSULTANT: "✅ Chat with AI consultant Sarah",
  GET_PERSONALIZED_ADVICE: "✅ Get personalized immigration advice", 
  FREE_CONSULTATIONS_DAILY: "✅ 5 free consultations daily",
  GENERATE_IMMIGRATION_REPORTS: "✅ Generate immigration reports",
  
  // Account Overview & Profile
  ACCOUNT_OVERVIEW: "Account Overview",
  MANAGE_SUBSCRIPTION: "Manage Subscription",
  USAGE_THIS_PERIOD: "Usage This Period",
  MEMBER_SINCE: "Member since",
  LOGOUT: "🚪 Logout",
  
  // Subscription Manager
  SUBSCRIPTION_MANAGEMENT: "Subscription Management",
  OVERVIEW: "Overview",
  PLANS: "Plans",
  ADDONS: "Add-ons",
  CURRENT_PLAN: "Current Plan",
  USAGE_THIS_MONTH: "Usage This Month",
  AVATAR_TIME_MINUTES: "Avatar Time (minutes)",
  PDF_REPORTS: "PDF Reports",
  AI_CHAT_TODAY: "AI Chat (today)",
  OVERAGE_CHARGES_THIS_MONTH: "Overage Charges This Month",
  YOUR_CURRENT_PLAN: "Your Current Plan",
  MONTHLY_RESET: "Monthly Reset",
  ALL_USAGE_LIMITS_RESET: "All usage limits reset on the 1st of each month and do not carry over.",
  YOURE_ON_TOP_TIER: "You're on our top tier!",
  YOU_HAVE_ACCESS_TO_ALL: "You have access to all premium features.",
  NEED_TO_CANCEL: "Need to cancel your subscription?",
  EMAIL_US_FOR_CANCELLATION: "Email us at support@immigrationconsultant.com before the last day of your billing cycle to avoid the next charge.",
  UNLIMITED_AVATAR_TIME: "Unlimited avatar time",
  NO_AVATAR_ACCESS: "No avatar access",
  UNLIMITED_PDF_REPORTS: "Unlimited PDF reports",
  NO_PDF_REPORTS: "No PDF reports",
  UNLIMITED_AI_CHAT: "Unlimited AI chat",
  QUESTIONS_PER_DAY: "questions/day",
  PRIORITY_EMAIL_SUPPORT_FULL: "Priority email support",
  MINUTES_AVATAR_TIME: "minutes avatar time",
  SELECT_PLAN: "Select Plan",
  CURRENT_TIER: "Current",
  
  // Main tagline (brand name always stays in English)
  WORLD_IMMIGRATION_CONSULTANT: "🌍 World Immigration Consultant",
  GET_PERSONALIZED_ADVICE_TAGLINE: "Get personalized immigration advice powered by AI",
  
  // Add-ons page
  AVATAR_TIME_ADDONS: "Avatar Time Add-ons",
  PREMIUM_SERVICES: "Premium Services",
  PURCHASE: "Purchase",
  ADDITIONAL_30_MINUTES: "Additional 30 minutes of avatar consultation time",
  ADDITIONAL_60_MINUTES: "Additional 60 minutes of avatar consultation time", 
  ADDITIONAL_120_MINUTES: "Additional 120 minutes of avatar consultation time",
  VISA_AGENT_CONNECTION: "Visa Agent Connection",
  PRIORITY_CONNECTION_AGENTS: "Priority connection to verified immigration agents",
  RUSH_EMAIL_SUPPORT: "Rush Email Support",
  HOUR_EMAIL_RESPONSE: "24-hour email response guarantee",
  FAMILY_ACCOUNT: "Family Account",
  ADD_FAMILY_MEMBERS: "Add family members to your subscription",
  
  // Account overview missing elements
  VIEW_PLANS: "View Plans",
  UPGRADE_FOR_MORE_FEATURES: "⚡ Upgrade for more features!",
  EMAIL_LABEL: "Email:",
  FROM_LABEL: "From:",
  REPORTS_REMAINING: "reports remaining",
  QUESTIONS_REMAINING_TODAY: "questions remaining today",
  RECENTLY: "Recently",
  
  // Intro messages
  WELCOME_BACK_PREMIUM: "Welcome back, {first_name}! 👋\n\nAs a **Premium member**, you have access to conversation history and advanced features.",
  WELCOME_USER: "Welcome, {first_name}! 👋\n\nChoose how you'd like to get immigration guidance:",
  QA_MODE_ASK_QUESTIONS: "💬 Q&A Mode - Ask questions directly",
  PDF_REPORT_COMPREHENSIVE: "📄 PDF Report - Get a comprehensive report",
  IM_SARAH_WORLDWIDE: "Hello {first_name}! I'm Sarah, your worldwide immigration consultant. I help people immigrate to ANY country globally! 🌍",
  IM_SARAH_WORLDWIDE_SIMPLE: "Hello! I'm Sarah, your worldwide immigration consultant. I help people immigrate to ANY country globally! 🌍",
  LATEST_OFFICIAL_GOVERNMENT_DATA: "I use the latest official government data to give you accurate, up-to-date guidance. Let's start - which country do you want to immigrate TO?",
  EXCELLENT_CHOICE_FROM: "Excellent choice! Now, what country are you FROM?",
  WONDERFUL_IMMIGRATION_GOAL: "Wonderful! What's your main immigration goal?"
};

// Create a React hook for UI translations
export const useUITranslations = (userLanguage = 'en') => {
  const [translations, setTranslations] = React.useState({});
  const [isLoading, setIsLoading] = React.useState(false);
  
  React.useEffect(() => {
    const translateAllUITexts = async () => {
      if (userLanguage === 'en') {
        setTranslations(UI_TEXTS);
        return;
      }
      
      setIsLoading(true);
      const translatedTexts = {};
      
      try {
        // Translate all UI texts
        const translationPromises = Object.entries(UI_TEXTS).map(async ([key, text]) => {
          const translatedText = await translateUIText(text, userLanguage);
          return [key, translatedText];
        });
        
        const results = await Promise.all(translationPromises);
        results.forEach(([key, translatedText]) => {
          translatedTexts[key] = translatedText;
        });
        
        setTranslations(translatedTexts);
      } catch (error) {
        console.error('Error translating UI texts:', error);
        setTranslations(UI_TEXTS); // Fallback to original texts
      } finally {
        setIsLoading(false);
      }
    };
    
    translateAllUITexts();
  }, [userLanguage]);
  
  return { translations, isLoading };
}; 