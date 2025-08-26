import React, { useState, useEffect, useRef } from 'react';
import './LanguageSelector.css';

const LanguageSelector = ({ user, onLanguageChange }) => {
  const [languages, setLanguages] = useState({});
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Language flags mapping
  const languageFlags = {
    'en': '🇺🇸',
    'es': '🇪🇸',
    'zh': '🇨🇳',
    'hi': '🇮🇳',
    'ar': '🇸🇦',
    'fr': '🇫🇷',
    'pt': '🇧🇷',
    'ru': '🇷🇺',
    'de': '🇩🇪',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'it': '🇮🇹',
    'tr': '🇹🇷',
    'vi': '🇻🇳',
    'th': '🇹🇭',
    'pl': '🇵🇱',
    'nl': '🇳🇱',
    'sv': '🇸🇪',
    'id': '🇮🇩',
    // NEW: ElevenLabs additional languages
    'hu': '🇭🇺',  // Hungarian
    'no': '🇳🇴',  // Norwegian
    'bg': '🇧🇬',  // Bulgarian
    'ro': '🇷🇴',  // Romanian
    'el': '🇬🇷',  // Greek
    'fi': '🇫🇮',  // Finnish
    'hr': '🇭🇷',  // Croatian
    'da': '🇩🇰',  // Danish
    'ta': '🇮🇳',  // Tamil (using India flag)
    'fil': '🇵🇭', // Filipino
    'cs': '🇨🇿',  // Czech
    'sk': '🇸🇰',  // Slovak
    'uk': '🇺🇦',  // Ukrainian
    'ms': '🇲🇾'   // Malay
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch supported languages and current user language
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('http://localhost:8001/auth/get-language', {
          headers: headers
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Language data received:', data);
          setLanguages(data.supported_languages || {});
          const userLang = data.language || 'en';
          setCurrentLanguage(userLang);
          
          // Store language in localStorage for avatar and other components
          localStorage.setItem('userLanguage', userLang);
          console.log('Initial language stored in localStorage:', userLang);
        } else {
          console.error('Language fetch failed:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };

    // Always fetch languages, even for non-authenticated users
    fetchLanguages();
  }, [user]);

  const handleLanguageChange = async (languageCode) => {
    if (languageCode === currentLanguage) return;
    
    // Only allow authenticated users to change language
    if (!user) {
      console.log('Must be logged in to change language');
      setIsDropdownOpen(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:8001/auth/set-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ language: languageCode })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Language change response:', data);
        setCurrentLanguage(languageCode);
        setIsDropdownOpen(false);
        
        // Store language in localStorage for avatar and other components
        localStorage.setItem('userLanguage', languageCode);
        console.log('Language stored in localStorage:', languageCode);
        
        // Notify parent component of language change
        if (onLanguageChange) {
          onLanguageChange(languageCode);
        }
        
        // Dispatch custom event for other components to listen
        const languageChangeEvent = new CustomEvent('languageChanged', {
          detail: { language: languageCode }
        });
        window.dispatchEvent(languageChangeEvent);
        
        // Show success message
        console.log('Language changed successfully to:', languageCode);
      } else {
        const errorData = await response.text();
        console.error('Failed to change language:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show for all users but only allow changes for authenticated users
  // if (!user) return null;

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button 
        className="language-selector-button" 
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isLoading}
      >
        <span className="language-flag">
          {languageFlags[currentLanguage] || '🌍'}
        </span>
        <span className="language-name">
          {languages[currentLanguage] || 'English'}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>
      
      {isDropdownOpen && (
        <div className="language-dropdown">
          {Object.entries(languages).map(([code, name]) => (
            <div 
              key={code} 
              className={`language-option ${code === currentLanguage ? 'selected' : ''}`}
              onClick={() => handleLanguageChange(code)}
            >
              <span className="language-flag">
                {languageFlags[code] || '🌍'}
              </span>
              <span className="language-name">
                {name}
              </span>
              {code === currentLanguage && (
                <span className="checkmark">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector; 