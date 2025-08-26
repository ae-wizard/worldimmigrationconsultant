import React, { useState, useEffect } from 'react';
import { useUITranslations } from '../utils/translations';
import './SubscriptionManager.css';

const SubscriptionManager = ({ user, onClose, onUpgrade }) => {
  const [tiers, setTiers] = useState({});
  const [usage, setUsage] = useState({});
  const [addons, setAddons] = useState({});
  const [currentUser, setCurrentUser] = useState(user); // Fresh user data
  const [selectedTier, setSelectedTier] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUserLanguage, setCurrentUserLanguage] = useState('en');

  // Use translation hook for UI elements
  const { translations } = useUITranslations(currentUserLanguage);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (event) => {
      if (event.detail && event.detail.language) {
        setCurrentUserLanguage(event.detail.language);
      }
    };
    
    // Fetch initial language preference
    const fetchUserLanguage = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('http://localhost:8001/auth/get-language', {
          headers: {
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setCurrentUserLanguage(data.language || 'en');
        }
      } catch (error) {
        console.log(`❌ [SubscriptionManager] Error fetching language: ${error.message}`);
      }
    };
    
    fetchUserLanguage();
    
    // Listen for language change events
    window.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);



  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Fetch fresh user data
      const userResponse = await fetch('http://localhost:8001/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      // Fetch all subscription tiers
      const tiersResponse = await fetch('http://localhost:8001/auth/tiers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const tiersData = await tiersResponse.json();
      
      // Fetch user usage statistics
      const usageResponse = await fetch('http://localhost:8001/auth/usage', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const usageData = await usageResponse.json();
      
      // Fetch available add-ons
      const addonsResponse = await fetch('http://localhost:8001/auth/addons', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const addonsData = await addonsResponse.json();
      
      // Handle user response
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user) {
          setCurrentUser(userData.user);
        } else {
          setCurrentUser(userData);
        }
      }
      
      // Handle tiers response (both wrapped and direct)
      if (tiersData.tiers) {
        setTiers(tiersData.tiers);
      } else if (tiersData.status === 'success') {
        setTiers(tiersData.tiers);
      } else {
        setTiers(tiersData);
      }
      
      // Handle usage response
      if (usageData.status === 'success') {
        setUsage(usageData);
      } else {
        setUsage(usageData);
      }
      
      // Handle addons response
      if (addonsData.status === 'success') {
        setAddons(addonsData.addons);
      } else {
        setAddons(addonsData);
      }
      
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (tier) => {
    if (onUpgrade) {
      onUpgrade(tier);
    }
  };

  const handlePurchaseAddon = async (addon, addonType) => {
    try {
      const response = await fetch('http://localhost:8001/auth/purchase-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          addon_id: addon.id,
          addon_type: addonType
        })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        alert(`Successfully purchased ${addon.name}!`);
        fetchSubscriptionData(); // Refresh data
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error purchasing addon:', error);
      alert('Failed to purchase add-on. Please try again.');
    }
  };

  const renderUsageBar = (used, limit, label, color = 'blue') => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
    
    return (
      <div className="usage-bar-container">
        <div className="usage-bar-header">
          <span className="usage-label">{label}</span>
          <span className="usage-stats">
            {limit > 0 ? `${used} / ${limit}` : `${used} (unlimited)`}
          </span>
        </div>
        <div className="usage-bar">
          <div 
            className={`usage-fill ${color}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="usage-remaining">
          {limit > 0 ? `${remaining} remaining` : 'Unlimited'}
        </div>
      </div>
    );
  };

  const renderTierCard = (tierKey, tierData) => {
    const userTier = currentUser?.tier || 'free';
    const isCurrent = isCurrentTier(tierKey);
    const isUpgrade = isUpgradeTier(userTier, tierKey);
    
    return (
      <div className={`tier-card ${isCurrent ? 'current' : ''}`} key={tierKey}>
        <div className="tier-header">
          <h3>{tierData.name}</h3>
          <div className="tier-price">
            ${tierData.price}
            <span className="price-period">/month</span>
          </div>
        </div>
        
        <div className="tier-features">
          <div className="feature-item">
            <span className="feature-icon">⏰</span>
            <span>
              {tierData.avatar_minutes_monthly === 0 ? (translations.NO_AVATAR_ACCESS || 'No avatar access') :
               tierData.avatar_minutes_monthly === -1 ? (translations.UNLIMITED_AVATAR_TIME || 'Unlimited avatar time') :
               `${tierData.avatar_minutes_monthly} ${translations.MINUTES_AVATAR_TIME || 'minutes avatar time'}`}
            </span>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon">📄</span>
            <span>
              {tierData.pdf_reports_monthly === 0 ? (translations.NO_PDF_REPORTS || 'No PDF reports') :
               tierData.pdf_reports_monthly === -1 ? (translations.UNLIMITED_PDF_REPORTS || 'Unlimited PDF reports') :
               `${tierData.pdf_reports_monthly} ${translations.PDF_REPORTS || 'PDF reports'}`}
            </span>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon">💬</span>
            <span>
              {tierData.limits.ai_chat === -1 ? (translations.UNLIMITED_AI_CHAT || 'Unlimited AI chat') :
               `${tierData.limits.ai_chat} ${translations.QUESTIONS_PER_DAY || 'questions/day'}`}
            </span>
          </div>
          
          {tierData.features.includes('priority_email_support') && (
            <div className="feature-item">
              <span className="feature-icon">📧</span>
              <span>{translations.PRIORITY_EMAIL_SUPPORT_FULL || "Priority email support"}</span>
            </div>
          )}
          
          {tierData.features.includes('visa_agent_connections') && (
            <div className="feature-item">
              <span className="feature-icon">🤝</span>
              <span>Visa agent connections</span>
            </div>
          )}
          
          {tierData.features.includes('multi_country_planning') && (
            <div className="feature-item">
              <span className="feature-icon">🌍</span>
              <span>Multi-country planning</span>
            </div>
          )}
        </div>
        
        <div className="tier-action">
          {isCurrent ? (
            <button className="tier-btn current-tier-btn" disabled>
              {translations.CURRENT_TIER || "Current"}
            </button>
          ) : (
            <button 
              className="tier-btn upgrade-btn"
              onClick={() => handleUpgrade(tierKey)}
            >
              {translations.SELECT_PLAN || "Select Plan"}
            </button>
          )}
        </div>
      </div>
    );
  };

  const getTierLevel = (tier) => {
    const levels = { free: 0, starter: 1, pro: 2, elite: 3, premium: 2 };
    return levels[tier] || 0;
  };

  const isUpgradeTier = (fromTier, toTier) => {
    const fromLevel = getTierLevel(fromTier);
    const toLevel = getTierLevel(toTier);
    return toLevel > fromLevel;
  };

  const isCurrentTier = (tierKey) => {
    const userTier = currentUser?.tier || 'free';
    return userTier === tierKey;
  };

  const renderOverview = () => {
    const userTier = currentUser?.tier || 'free';
    const currentTier = tiers[userTier] || tiers.free || { name: 'Free', price: 0 };
    
    return (
      <div className="overview-content">
        <div className="current-plan-section">
          <h3>{translations.CURRENT_PLAN || "Current Plan"}: {currentTier.name}</h3>
          <div className="plan-price">
            ${currentTier.price}/month
          </div>
        </div>
        
        <div className="usage-section">
          <h4>{translations.USAGE_THIS_MONTH || "Usage This Month"}</h4>
          
          {usage.usage && currentTier && (
            <>
              {currentTier.limits?.avatar_minutes > 0 && (
                <div className="usage-item">
                  {renderUsageBar(
                    usage.usage.monthly_avatar_minutes_used || 0,
                    currentTier.limits.avatar_minutes,
                    translations.AVATAR_TIME_MINUTES || 'Avatar Time (minutes)',
                    usage.usage.avatar_usage_percentage > 80 ? 'red' : 'blue'
                  )}
                </div>
              )}
              
              {currentTier.limits?.pdf_report > 0 && (
                <div className="usage-item">
                  {renderUsageBar(
                    usage.usage.monthly_reports_used || 0,
                    currentTier.limits.pdf_report,
                    translations.PDF_REPORTS || 'PDF Reports',
                    usage.usage.pdf_usage_percentage > 80 ? 'red' : 'green'
                  )}
                </div>
              )}
              
              {currentTier.limits?.ai_chat > 0 && (
                <div className="usage-item">
                  {renderUsageBar(
                    usage.usage.daily_questions_used || 0,
                    currentTier.limits.ai_chat,
                    translations.AI_CHAT_TODAY || 'AI Chat (today)',
                    'purple'
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {usage.usage?.monthly_overage_charges > 0 && (
          <div className="overage-section">
            <div className="overage-alert">
              <span className="overage-icon">⚠️</span>
              <div>
                <strong>{translations.OVERAGE_CHARGES_THIS_MONTH || "Overage Charges This Month"}</strong>
                <div className="overage-amount">
                  ${usage.usage.monthly_overage_charges.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlans = () => {
    const userTier = currentUser?.tier || 'free';
    
    // Show all main tiers (starter, pro, elite) except current tier
    const availableTiers = Object.entries(tiers).filter(([key, tier]) => {
      // Never show current tier
      if (key === userTier) return false;
      
      // Always show the three main tiers: starter, pro, elite
      // Hide free (for paid users) and legacy premium
      if (userTier === 'free') {
        return ['starter', 'pro', 'elite'].includes(key);
      } else {
        return ['starter', 'pro', 'elite'].includes(key);
      }
    });
    
    const isPaidUser = userTier !== 'free';
    
    return (
      <div className="plans-content">
        {/* Current tier indicator */}
        <div className="current-tier-indicator">
          <div className="current-tier-badge">
            <span className="current-tier-icon">✨</span>
            <span>{translations.YOUR_CURRENT_PLAN || "Your Current Plan"}: <strong>{tiers[userTier]?.name || 'Free'}</strong></span>
          </div>
        </div>

        {/* Reset notice */}
        <div className="usage-reset-notice">
          <div className="reset-notice-icon">📅</div>
          <div className="reset-notice-text">
            <strong>{translations.MONTHLY_RESET || "Monthly Reset"}:</strong> {translations.ALL_USAGE_LIMITS_RESET || "All usage limits reset on the 1st of each month and do not carry over."}
          </div>
        </div>
        
        {/* Available tier options */}
        {availableTiers.length > 0 ? (
          <div className="plans-grid">
            {availableTiers.map(([key, tier]) => renderTierCard(key, tier))}
          </div>
        ) : (
          <div className="no-upgrades-message">
            <div className="no-upgrades-icon">🎉</div>
            <div className="no-upgrades-text">
              <strong>{translations.YOURE_ON_TOP_TIER || "You're on our top tier!"}</strong> {translations.YOU_HAVE_ACCESS_TO_ALL || "You have access to all premium features."}
            </div>
          </div>
        )}
        
        {/* Cancellation message for paid users */}
        {isPaidUser && (
          <div className="cancellation-notice">
            <div className="cancellation-icon">📧</div>
            <div className="cancellation-text">
              <strong>{translations.NEED_TO_CANCEL || "Need to cancel your subscription?"}</strong> {translations.EMAIL_US_FOR_CANCELLATION || "Email us at support@immigrationconsultant.com before the last day of your billing cycle to avoid the next charge."}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAddons = () => {
    // Function to translate addon names and descriptions
    const translateAddonContent = (name, description) => {
      const nameTranslations = {
        '+30 minutes Avatar Time': translations.ADDITIONAL_30_MINUTES || name,
        '+1 hour Avatar Time': translations.ADDITIONAL_60_MINUTES || name,
        '+2 hours Avatar Time': translations.ADDITIONAL_120_MINUTES || name,
        'Visa Agent Connection': translations.VISA_AGENT_CONNECTION || name,
        'Rush Email Support': translations.RUSH_EMAIL_SUPPORT || name,
        'Family Account': translations.FAMILY_ACCOUNT || name
      };
      
      const descriptionTranslations = {
        'Additional 30 minutes of avatar consultation time': translations.ADDITIONAL_30_MINUTES || description,
        'Additional 60 minutes of avatar consultation time': translations.ADDITIONAL_60_MINUTES || description,
        'Additional 120 minutes of avatar consultation time': translations.ADDITIONAL_120_MINUTES || description,
        'Priority connection to verified immigration agents': translations.PRIORITY_CONNECTION_AGENTS || description,
        '24-hour email response guarantee': translations.HOUR_EMAIL_RESPONSE || description,
        'Add family members to your subscription': translations.ADD_FAMILY_MEMBERS || description
      };
      
      return {
        name: nameTranslations[name] || name,
        description: descriptionTranslations[description] || description
      };
    };
    
    return (
      <div className="addons-content">
        <div className="addons-section">
          <h4>{translations.AVATAR_TIME_ADDONS || "Avatar Time Add-ons"}</h4>
          <div className="addons-grid">
            {addons.avatar_time?.map(addon => {
              const translated = translateAddonContent(addon.name, addon.description);
              return (
                <div key={addon.id} className="addon-card">
                  <h5>{translated.name}</h5>
                  <p>{translated.description}</p>
                  <div className="addon-price">${addon.price}</div>
                  <button 
                    className="addon-btn"
                    onClick={() => handlePurchaseAddon(addon, 'avatar_time')}
                  >
                    {translations.PURCHASE || "Purchase"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="addons-section">
          <h4>{translations.PREMIUM_SERVICES || "Premium Services"}</h4>
          <div className="addons-grid">
            {addons.services?.map(addon => {
              const translated = translateAddonContent(addon.name, addon.description);
              return (
                <div key={addon.id} className="addon-card">
                  <h5>{translated.name}</h5>
                  <p>{translated.description}</p>
                  <div className="addon-price">
                    ${addon.price}
                    {addon.type === 'monthly_addon' && <span className="price-period">/month</span>}
                  </div>
                  <button 
                    className="addon-btn"
                    onClick={() => handlePurchaseAddon(addon, 'services')}
                  >
                    {translations.PURCHASE || "Purchase"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="subscription-manager-overlay">
        <div className="subscription-manager">
          <div className="loading-spinner">Loading subscription data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-manager-overlay">
      <div className="subscription-manager">
        <div className="subscription-header">
          <h2>{translations.SUBSCRIPTION_MANAGEMENT || "Subscription Management"}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="subscription-tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {translations.OVERVIEW || "Overview"}
          </button>
          <button 
            className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            {translations.PLANS || "Plans"}
          </button>
          <button 
            className={`tab ${activeTab === 'addons' ? 'active' : ''}`}
            onClick={() => setActiveTab('addons')}
          >
            {translations.ADDONS || "Add-ons"}
          </button>
        </div>
        
        <div className="subscription-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'plans' && renderPlans()}
          {activeTab === 'addons' && renderAddons()}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager; 