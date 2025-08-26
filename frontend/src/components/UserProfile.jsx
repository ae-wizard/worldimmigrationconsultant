import React, { useState, useEffect } from 'react';
import SubscriptionManager from './SubscriptionManager';
import { useUITranslations } from '../utils/translations';
import './UserProfile.css';

const UserProfile = ({ user, onShowUpgrade, onLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [usage, setUsage] = useState({});
  const [tiers, setTiers] = useState({});
  const [currentUserLanguage, setCurrentUserLanguage] = useState('en');

  // Use translation hook for UI elements
  const { translations } = useUITranslations(currentUserLanguage);

  useEffect(() => {
    fetchUsageAndTiers();
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
        console.log(`❌ [UserProfile] Error fetching language: ${error.message}`);
      }
    };
    
    fetchUserLanguage();
    
    // Listen for language change events
    window.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  const fetchUsageAndTiers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('❌ [UserProfile] No auth token found');
        return;
      }

      console.log('🔄 [UserProfile] Fetching usage and tiers data...');

      // Fetch usage data with timeout
      const usageResponse = await Promise.race([
        fetch('http://localhost:8001/auth/usage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Usage fetch timeout')), 5000))
      ]);

      // Fetch tier information with timeout
      const tiersResponse = await Promise.race([
        fetch('http://localhost:8001/auth/tiers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tiers fetch timeout')), 5000))
      ]);

      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        console.log('✅ [UserProfile] Usage data:', usageData);
        setUsage(usageData);
      } else {
        console.error('❌ [UserProfile] Usage fetch failed:', usageResponse.status, usageResponse.statusText);
      }

      if (tiersResponse.ok) {
        const tiersData = await tiersResponse.json();
        console.log('✅ [UserProfile] Tiers data:', tiersData);
        // Handle both wrapped and direct tier responses
        if (tiersData.tiers) {
          setTiers(tiersData.tiers);
        } else {
          setTiers(tiersData);
        }
      } else {
        console.error('❌ [UserProfile] Tiers fetch failed:', tiersResponse.status, tiersResponse.statusText);
      }
    } catch (error) {
      console.error('❌ [UserProfile] Failed to fetch usage and tiers:', error);
    }
  };

  // Refresh data when dropdown opens
  const handleDropdownToggle = () => {
    const newShowDropdown = !showDropdown;
    setShowDropdown(newShowDropdown);
    
    // Refresh usage data when opening dropdown
    if (newShowDropdown) {
      console.log('🔄 [UserProfile] Dropdown opened, refreshing usage data...');
      fetchUsageAndTiers();
      
      // Also refresh main user data by triggering a page-level refresh
      // This ensures the user object has the latest created_at and other fields
      window.dispatchEvent(new CustomEvent('refreshUserData'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    onLogout();
    window.location.reload();
  };

  const getTierColor = (tier) => {
    const colors = {
      free: '#6b7280',
      starter: '#667eea',
      pro: '#f59e0b',
      elite: '#8b5cf6',
      premium: '#f59e0b' // Legacy premium
    };
    return colors[tier] || '#6b7280';
  };

  const getTierIcon = (tier) => {
    const icons = {
      free: '🆓',
      starter: '🚀',
      pro: '⭐',
      elite: '💎',
      premium: '💎' // Legacy premium
    };
    return icons[tier] || '🆓';
  };

  const getTierDisplayName = (tier) => {
    const currentTier = tiers[tier];
    return currentTier?.name || tier?.toUpperCase() || 'FREE';
  };

  const getUsagePercentage = (used, limit) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const handleUpgradeClick = async () => {
    setUpgradeLoading(true);
    try {
      await onShowUpgrade();
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="user-profile">
      <div className="profile-trigger" onClick={handleDropdownToggle}>
        <div className="user-avatar">
          {user.first_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="user-info">
          <span className="user-name">
            {user.first_name} {user.last_name}
          </span>
          <span className="user-tier" style={{ color: getTierColor(user.tier) }}>
            {getTierIcon(user.tier)} {getTierDisplayName(user.tier)} TIER
          </span>
        </div>
        <div className="dropdown-arrow">▼</div>
      </div>

      {showDropdown && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <h4>{translations.ACCOUNT_OVERVIEW || "Account Overview"}</h4>
          </div>

          <div className="tier-status">
            <div className="tier-badge" style={{ borderColor: getTierColor(user.tier) }}>
              <span className="tier-icon">{getTierIcon(user.tier)}</span>
              <span className="tier-name">{getTierDisplayName(user.tier)} TIER</span>
            </div>
            <button 
              className="manage-subscription-btn"
              onClick={() => setShowSubscriptionManager(true)}
            >
              {translations.MANAGE_SUBSCRIPTION || "Manage Subscription"}
            </button>
          </div>

          {usage.usage && Object.keys(usage.usage).length > 0 && (
            <div className="usage-section">
              <h5>{translations.USAGE_THIS_PERIOD || "Usage This Period"}</h5>
              
              {/* Avatar time usage */}
              {tiers[user.tier]?.limits?.avatar_minutes !== undefined && tiers[user.tier]?.limits?.avatar_minutes !== 0 && (
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">⏰ Avatar Time</span>
                    <span className="usage-stats">
                      {usage.usage.monthly_avatar_minutes_used || 0} / {
                        tiers[user.tier]?.limits?.avatar_minutes === -1 
                          ? '∞' 
                          : tiers[user.tier]?.limits?.avatar_minutes || 0
                      } min
                    </span>
                  </div>
                  {tiers[user.tier]?.limits?.avatar_minutes !== -1 && (
                    <>
                      <div className="usage-bar">
                        <div 
                          className="usage-fill" 
                          style={{ 
                            width: `${Math.min((usage.usage.monthly_avatar_minutes_used || 0) / tiers[user.tier]?.limits?.avatar_minutes * 100, 100)}%`,
                            backgroundColor: usage.usage.avatar_usage_percentage > 80 ? '#f56565' : '#48bb78'
                          }}
                        ></div>
                      </div>
                      <div className="usage-remaining">
                        {Math.max(0, tiers[user.tier]?.limits?.avatar_minutes - (usage.usage.monthly_avatar_minutes_used || 0))} minutes remaining
                      </div>
                    </>
                  )}
                  {tiers[user.tier]?.limits?.avatar_minutes === -1 && (
                    <div className="unlimited-badge">✨ Unlimited</div>
                  )}
                </div>
              )}

              {/* PDF reports usage */}
              {tiers[user.tier]?.limits?.pdf_report !== undefined && tiers[user.tier]?.limits?.pdf_report !== 0 && (
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">📄 PDF Reports</span>
                    <span className="usage-stats">
                      {usage.usage.monthly_reports_used || 0} / {
                        tiers[user.tier]?.limits?.pdf_report === -1 
                          ? '∞' 
                          : tiers[user.tier]?.limits?.pdf_report || 0
                      }
                    </span>
                  </div>
                  {tiers[user.tier]?.limits?.pdf_report !== -1 && (
                    <>
                      <div className="usage-bar">
                        <div 
                          className="usage-fill" 
                          style={{ 
                            width: `${Math.min((usage.usage.monthly_reports_used || 0) / tiers[user.tier]?.limits?.pdf_report * 100, 100)}%`,
                            backgroundColor: usage.usage.pdf_usage_percentage > 80 ? '#f56565' : '#48bb78'
                          }}
                        ></div>
                      </div>
                      <div className="usage-remaining">
                        {Math.max(0, tiers[user.tier]?.limits?.pdf_report - (usage.usage.monthly_reports_used || 0))} {translations.REPORTS_REMAINING || "reports remaining"}
                      </div>
                    </>
                  )}
                  {tiers[user.tier]?.limits?.pdf_report === -1 && (
                    <div className="unlimited-badge">✨ Unlimited</div>
                  )}
                </div>
              )}

              {/* AI chat usage */}
              {tiers[user.tier]?.limits?.ai_chat !== undefined && tiers[user.tier]?.limits?.ai_chat !== 0 && (
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">💬 AI Chat (Today)</span>
                    <span className="usage-stats">
                      {usage.usage.daily_questions_used || 0} / {
                        tiers[user.tier]?.limits?.ai_chat === -1 
                          ? '∞' 
                          : tiers[user.tier]?.limits?.ai_chat || 5
                      }
                    </span>
                  </div>
                  {tiers[user.tier]?.limits?.ai_chat !== -1 && (
                    <>
                      <div className="usage-bar">
                        <div 
                          className="usage-fill" 
                          style={{ 
                            width: `${Math.min((usage.usage.daily_questions_used || 0) / tiers[user.tier]?.limits?.ai_chat * 100, 100)}%`,
                            backgroundColor: usage.usage.daily_questions_remaining <= 1 ? '#f56565' : '#48bb78'
                          }}
                        ></div>
                      </div>
                      <div className="usage-remaining">
                        {Math.max(0, tiers[user.tier]?.limits?.ai_chat - (usage.usage.daily_questions_used || 0))} {translations.QUESTIONS_REMAINING_TODAY || "questions remaining today"}
                      </div>
                    </>
                  )}
                  {tiers[user.tier]?.limits?.ai_chat === -1 && (
                    <div className="unlimited-badge">✨ Unlimited</div>
                  )}
                </div>
              )}

              {/* Fallback message when no usage data */}
              {(!usage.usage || Object.keys(usage.usage).length === 0) && (
                <div className="no-usage-data">
                  <p>📊 Usage data will appear here after your first interactions</p>
                </div>
              )}

              {/* Overage charges */}
              {usage.usage?.monthly_overage_charges > 0 && (
                <div className="overage-alert">
                  <span className="overage-icon">⚠️</span>
                  <div>
                    <strong>Overage Charges This Month</strong>
                    <div className="overage-amount">
                      ${usage.usage.monthly_overage_charges.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade prompt for limited users */}
              {user.tier === 'free' && (
                <div className="upgrade-prompt">
                  <p>{translations.UPGRADE_FOR_MORE_FEATURES || "⚡ Upgrade for more features!"}</p>
                  <button 
                    className="upgrade-btn" 
                    onClick={() => setShowSubscriptionManager(true)}
                    disabled={upgradeLoading}
                  >
                    {upgradeLoading ? '⏳ Loading...' : (translations.VIEW_PLANS || 'View Plans')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Premium tier benefits */}
          {(user.tier === 'pro' || user.tier === 'elite' || user.tier === 'premium') && (
            <div className="premium-status">
              <div className="premium-benefits">
                <h5>✨ Premium Benefits Active</h5>
                <ul>
                  {tiers[user.tier]?.limits?.ai_chat === -1 && <li>✅ Unlimited AI questions</li>}
                  {tiers[user.tier]?.limits?.pdf_report === -1 && <li>✅ Unlimited PDF reports</li>}
                  {tiers[user.tier]?.features?.includes('priority_email_support') && <li>✅ Priority email support</li>}
                  {tiers[user.tier]?.features?.includes('visa_agent_connections') && <li>✅ Visa agent connections</li>}
                  {tiers[user.tier]?.features?.includes('multi_country_planning') && <li>✅ Multi-country planning</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="account-actions">
            <div className="user-details">
              <div className="detail-item">
                <span className="detail-label">{translations.EMAIL_LABEL || "Email:"}</span>
                <span className="detail-value">{user.email}</span>
              </div>
              {user.origin_country && (
                <div className="detail-item">
                  <span className="detail-label">{translations.FROM_LABEL || "From:"}</span>
                  <span className="detail-value">{user.origin_country}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">{translations.MEMBER_SINCE || "Member since"}:</span>
                <span className="detail-value">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : (translations.RECENTLY || 'Recently')}
                </span>
              </div>
            </div>

            <button className="logout-btn" onClick={handleLogout}>
              {translations.LOGOUT || "🚪 Logout"}
            </button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="dropdown-overlay" onClick={() => setShowDropdown(false)}></div>
      )}

      {showSubscriptionManager && (
        <SubscriptionManager 
          user={user}
          onClose={() => setShowSubscriptionManager(false)}
          onUpgrade={(tier) => {
            // Handle upgrade logic here
            console.log('Upgrading to:', tier);
            setShowSubscriptionManager(false);
          }}
        />
      )}
    </div>
  );
};

export default UserProfile; 