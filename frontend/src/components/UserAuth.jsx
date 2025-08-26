import React, { useState, useEffect } from 'react';
import './UserAuth.css';

const UserAuth = ({ onClose, initialMode = 'login', onAuthSuccess }) => {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    originCountry: '',
    tier: 'free' // 'free' or 'premium'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originCountries, setOriginCountries] = useState([
    // Fallback countries that will show immediately
    { name: "India", flag: "🇮🇳" },
    { name: "China", flag: "🇨🇳" },
    { name: "Mexico", flag: "🇲🇽" },
    { name: "Brazil", flag: "🇧🇷" },
    { name: "Nigeria", flag: "🇳🇬" },
    { name: "Philippines", flag: "🇵🇭" },
    { name: "Pakistan", flag: "🇵🇰" },
    { name: "Bangladesh", flag: "🇧🇩" },
    { name: "Other", flag: "🌍" }
  ]);

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
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Italy': '🇮🇹',
      'Spain': '🇪🇸',
      'Netherlands': '🇳🇱',
      'Sweden': '🇸🇪',
      'Norway': '🇳🇴',
      'Denmark': '🇩🇰',
      'Finland': '🇫🇮',
      'Poland': '🇵🇱',
      'Czech Republic': '🇨🇿',
      'Hungary': '🇭🇺',
      'Romania': '🇷🇴',
      'Bulgaria': '🇧🇬',
      'Greece': '🇬🇷',
      'Portugal': '🇵🇹',
      'Austria': '🇦🇹',
      'Switzerland': '🇨🇭',
      'Belgium': '🇧🇪',
      'Ireland': '🇮🇪',
      'Japan': '🇯🇵',
      'Singapore': '🇸🇬',
      'New Zealand': '🇳🇿',
      'Israel': '🇮🇱',
      'Saudi Arabia': '🇸🇦',
      'UAE': '🇦🇪',
      'Qatar': '🇶🇦',
      'Kuwait': '🇰🇼',
      'Jordan': '🇯🇴',
      'Lebanon': '🇱🇧',
      'Chile': '🇨🇱',
      'Argentina': '🇦🇷',
      'Uruguay': '🇺🇾',
      'Paraguay': '🇵🇾',
      'Bolivia': '🇧🇴',
      'Ecuador': '🇪🇨',
      'Other': '🌍'
    };
    return flagMap[countryName] || '🌍';
  };

  // Load origin countries when component mounts
  useEffect(() => {
    console.log('🔍 UserAuth component mounted, loading origin countries...');
    const loadOriginCountries = async () => {
      try {
        console.log('🌐 Fetching origin countries from API...');
        const response = await fetch('http://localhost:8001/origin-countries');
        console.log('📡 API Response status:', response.status);
        const data = await response.json();
        console.log('📊 API Response data:', data);
        
        // Fix: Use the correct property name from backend response
        if (data.origin_countries) {
          // Convert array to objects with flags
          const countryObjects = data.origin_countries.map(countryName => ({
            name: countryName,
            flag: getCountryFlag(countryName)
          }));
          setOriginCountries(countryObjects);
          console.log(`✅ UserAuth loaded ${data.origin_countries.length} origin countries`);
          console.log('🗂️ Sample countries:', countryObjects.slice(0, 5));
        } else {
          console.error('❌ Invalid origin countries response structure:', data);
          // Fallback to basic countries
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
      } catch (error) {
        console.error('💥 Error loading origin countries:', error);
        // Fallback to basic countries
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

    loadOriginCountries();
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (mode === 'register') {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const endpoint = mode === 'login' ? '/auth/user-login' : '/auth/register';
      const payload = mode === 'login' 
        ? { email: formData.email, password: formData.password }
        : {
            email: formData.email,
            password: formData.password,
            first_name: formData.firstName,
            last_name: formData.lastName,
            origin_country: formData.originCountry,
            tier: formData.tier
          };

      const response = await fetch(`http://localhost:8001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setSuccess(mode === 'login' ? 'Login successful!' : 'Registration successful!');
        
        // Call the success callback with user data and token
        if (onAuthSuccess) {
          handleSuccess(data.user, data.token);
        }
        
        // Close modal after a brief delay
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(data.message || data.detail || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccess('');
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      originCountry: '',
      tier: 'free'
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSuccess = async (userData, token) => {
    try {
      // Store the token and basic user info
      localStorage.setItem('authToken', token);
      localStorage.setItem('userInfo', JSON.stringify(userData));
      
      // Fetch fresh user data from backend to ensure we have latest tier/subscription info
      const response = await fetch('http://localhost:8001/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const freshUserData = await response.json();
        const user = freshUserData.user || freshUserData;
        
        // Update localStorage with fresh data
        localStorage.setItem('userInfo', JSON.stringify(user));
        
        console.log('🔄 [Auth] Fresh user data fetched:', user.email, 'tier:', user.tier);
        onAuthSuccess(user, token);
      } else {
        // Fallback to original user data
        onAuthSuccess(userData, token);
      }
    } catch (error) {
      console.error('Error fetching fresh user data:', error);
      // Fallback to original user data
      onAuthSuccess(userData, token);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <h2>{mode === 'login' ? '🔐 Login' : '👋 Create Account'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="auth-content">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <>
                <div className="form-row name-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Origin Country</label>
                  <select
                    name="originCountry"
                    value={formData.originCountry}
                    onChange={handleInputChange}
                    required
                    className="country-select"
                  >
                    <option value="">Select your country</option>
                    {console.log('🎯 Rendering dropdown with originCountries:', originCountries.length, 'countries') || 
                     originCountries.map((country, index) => (
                      <option key={index} value={country.name}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plan Selection */}
                <div className="form-group">
                  <label>Choose Your Starting Plan</label>
                  <div className="plan-selection">
                    <div className={`plan-option ${formData.tier === 'free' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="tier"
                        value="free"
                        checked={formData.tier === 'free'}
                        onChange={handleInputChange}
                        id="free-plan"
                      />
                      <label htmlFor="free-plan" className="plan-label">
                        <div className="plan-header">
                          <span className="plan-icon">🆓</span>
                          <span className="plan-name">Free Plan</span>
                        </div>
                        <ul className="plan-features">
                          <li>✅ 5 AI questions per day</li>
                          <li>✅ 1 basic PDF report per month</li>
                          <li>✅ Basic immigration guidance</li>
                        </ul>
                      </label>
                    </div>

                    <div className={`plan-option ${formData.tier === 'starter' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="tier"
                        value="starter"
                        checked={formData.tier === 'starter'}
                        onChange={handleInputChange}
                        id="starter-plan"
                      />
                      <label htmlFor="starter-plan" className="plan-label">
                        <div className="plan-header">
                          <span className="plan-icon">🌟</span>
                          <span className="plan-name">Starter - $19.99/month</span>
                        </div>
                        <ul className="plan-features">
                          <li>✅ 30 min Sarah avatar time</li>
                          <li>✅ Unlimited AI chat</li>
                          <li>✅ 3 PDF reports per month</li>
                          <li>✅ Email support</li>
                        </ul>
                      </label>
                    </div>
                  </div>
                  <div className="plan-note">
                    <p>💡 <strong>Pro tip:</strong> Start with Free and upgrade anytime! You can also upgrade to Pro ($39.99) or Elite ($79.99) plans later.</p>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your password"
                  minLength="6"
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label>Confirm Password</label>
                <div className="password-container">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Confirm your password"
                    minLength="6"
                    className="password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? '⏳ Processing...' : (mode === 'login' ? '🔐 Login' : `🚀 Create ${formData.tier === 'starter' ? 'Starter' : 'Free'} Account`)}
            </button>
          </form>

          {/* Only show auth-switch for login mode, not signup */}
          {mode === 'login' && (
            <div className="auth-switch">
              <div>
                <div className="auth-text">Don't have an account?</div>
                <div className="auth-button-wrapper">
                  <button type="button" onClick={switchMode} className="switch-btn">
                    Create one here
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'register' && formData.tier === 'starter' && (
            <div className="premium-notice">
              <p>🌟 <strong>Starter Plan Selected!</strong></p>
              <p>You'll be able to manage your subscription after account creation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserAuth; 