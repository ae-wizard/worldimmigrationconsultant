import React, { useState } from 'react';
import './UpgradeModal.css';

const UpgradeModal = ({ onClose, user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Please log in to upgrade your account');
        return;
      }

      // Development mode - show demo message instead of real Stripe integration
      if (window.location.hostname === 'localhost') {
        setLoading(false);
        alert('🚀 Demo Mode\n\nThis is a demonstration of the upgrade flow.\n\nIn production, this would:\n✅ Redirect to Stripe checkout\n✅ Process payment securely\n✅ Upgrade your account instantly\n\nFor now, your account has been simulated as Premium!');
        
        // Simulate upgrade success in demo mode
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        userInfo.tier = 'premium';
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        
        // Close modal and refresh page to show premium status
        onClose();
        window.location.reload();
        return;
      }

      // Production mode - use actual Stripe integration
      const PREMIUM_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_ID || 'price_demo';
      
      const response = await fetch('http://localhost:8001/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price_id: PREMIUM_PRICE_ID,
          success_url: `${window.location.origin}/upgrade/success`,
          cancel_url: `${window.location.origin}/upgrade/cancel`
        })
      });

      const data = await response.json();

      if (response.ok && data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = data.checkout_url;
      } else {
        console.error('Checkout error:', data);
        setError(data.detail || 'Failed to create checkout session. Please contact support.');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      setError('An error occurred while processing your upgrade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upgrade-modal-overlay">
      <div className="upgrade-modal">
        <div className="upgrade-modal-header">
          <h2>🚀 Upgrade to Premium</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="upgrade-modal-content">
          <div className="current-plan">
            <h3>Current Plan: {user?.tier?.toUpperCase() || 'FREE'} 🆓</h3>
            <ul>
              <li>5 AI questions per day</li>
              <li>1 basic report per month</li>
              <li>Limited features</li>
            </ul>
          </div>

          <div className="upgrade-arrow">⬇️</div>

          <div className="premium-plan">
            <h3>Premium Plan 💎</h3>
            <div className="price">$29/month</div>
            <ul>
              <li>✅ Unlimited AI questions</li>
              <li>✅ Unlimited detailed reports</li>
              <li>✅ PDF downloads</li>
              <li>✅ Priority support</li>
              <li>✅ Advanced immigration guides</li>
              <li>✅ Sarah (AI Avatar) responses</li>
            </ul>
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <div className="upgrade-actions">
            <button 
              className="upgrade-btn-modal" 
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? '⏳ Processing...' : '🚀 Upgrade to Premium'}
            </button>
            <button className="cancel-btn-modal" onClick={onClose}>
              Cancel
            </button>
          </div>

          <div className="security-note">
            🔒 Secure payment processed by Stripe
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal; 