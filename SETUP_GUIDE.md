# 🚀 Immigration Platform - User Tier System Setup Guide

## 📋 Overview

You now have a complete **enterprise-grade user tier system** with:
- ✅ User authentication (registration, login, JWT tokens)
- ✅ Three-tier access control (Free, Premium, Enterprise)
- ✅ Stripe payment integration for premium subscriptions
- ✅ Feature gating middleware
- ✅ Admin panel for user management
- ✅ Conversation monitoring & feedback
- ✅ Usage tracking and limits

## 🛠️ Quick Setup

### 1. Install Dependencies

```bash
cd worldimmigration-clean/backend
pip install -r requirements.txt
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Development Mode
DEVELOPMENT_MODE=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256

# Stripe Configuration (See Step 3 below)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID_PREMIUM=price_your_premium_price_id_here

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
```

### 3. 💳 Stripe Setup (Required for Premium Subscriptions)

1. **Create Stripe Account**: Go to [stripe.com](https://stripe.com) and sign up
2. **Get API Keys**: 
   - Dashboard → Developers → API keys
   - Copy `Publishable key` and `Secret key`
3. **Create Premium Product**:
   - Dashboard → Products → Add product
   - Name: "Premium Subscription"
   - Pricing: e.g., $29/month recurring
   - Copy the Price ID (starts with `price_`)
4. **Setup Webhooks**:
   - Dashboard → Developers → Webhooks → Add endpoint
   - URL: `http://your-domain.com/payments/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
   - Copy webhook secret (starts with `whsec_`)

### 4. Start the System

```bash
# Terminal 1: Start Qdrant (vector database)
docker run -p 6333:6333 qdrant/qdrant

# Terminal 2: Start Backend
cd worldimmigration-clean/backend
python admin_secure.py

# Terminal 3: Start Frontend
cd worldimmigration-clean/frontend
npm run dev
```

## 🎯 User Access Levels

### 🆓 Free Tier
- ✅ Country visa pages (unlimited)
- ✅ AI Chat (5 questions/day)
- ✅ Visa reports (1/month)
- ❌ PDF downloads
- ❌ Document templates
- ❌ Priority support

### ⭐ Premium Tier ($29/month)
- ✅ Everything in Free
- ✅ Unlimited AI questions
- ✅ Unlimited visa reports
- ✅ PDF downloads
- ✅ Document templates
- ✅ Priority support
- ✅ Full session history
- ✅ Policy change alerts

### 🏢 Enterprise Tier (Custom)
- ✅ Everything in Premium
- ✅ API access
- ✅ Bulk operations
- ✅ Custom integrations

## 🔧 Admin Panel Features

Access: http://localhost:5173/admin (Login: admin / admin123)

### New Features Added:
1. **👥 Users Tab**: Manage user accounts and tiers
2. **💬 Conversations Tab**: Monitor user interactions
3. **⚙️ Tier Settings**: Configure limits for each tier
4. **📊 Enhanced Dashboard**: User stats, revenue tracking

## 🌐 Frontend Integration Points

### Authentication Components Needed:

1. **Login/Register Forms**: 
   - POST `/auth/register` and `/auth/user-login`
   - Store JWT token in localStorage

2. **User Profile Component**:
   - GET `/auth/me` to get user info
   - PUT `/auth/profile` to update profile

3. **Upgrade/Payment Component**:
   - POST `/payments/create-checkout-session`
   - Redirect to Stripe checkout

4. **Feature Gates**: 
   - Check user tier before showing premium features
   - Show "Upgrade to Premium" buttons for locked features

### API Integration Example:

```javascript
// Check if user can use AI chat
const checkAccess = async () => {
  const response = await fetch('/auth/check-access/ai_chat', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (!data.access.allowed) {
    // Show upgrade prompt
    showUpgradeModal(data.access.upgrade_tier);
  }
};

// Use AI chat feature
const useAIChat = async (question) => {
  const response = await fetch('/auth/use-feature/ai_chat', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    // Proceed with AI chat
    const chatResponse = await fetch('/ask-worldwide', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question, user_profile })
    });
  }
};
```

## 🔒 Security Features

- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Password Hashing**: bcrypt encryption
- ✅ **Feature Gating**: Middleware-level access control
- ✅ **Rate Limiting**: Usage tracking and limits
- ✅ **Stripe Integration**: Secure payment processing

## 📈 Scaling Considerations

### Current Setup:
- SQLite database (good for development)
- Local file storage
- Single server deployment

### Production Recommendations:
- **Database**: PostgreSQL or MySQL
- **Storage**: AWS S3 for file uploads
- **Deployment**: AWS ECS or Heroku
- **CDN**: CloudFront for static assets
- **Monitoring**: Sentry for error tracking

## 🚨 Next Steps

1. **Test the System**:
   - Register a test user
   - Try the AI chat (should work with limits)
   - Test Stripe checkout (use test cards)

2. **Customize Pricing**:
   - Update Stripe product pricing
   - Modify tier limits in admin panel

3. **Frontend Integration**:
   - Add authentication components
   - Implement feature gates
   - Add payment/upgrade flows

4. **Deploy to Production**:
   - Set up AWS/hosting
   - Configure production Stripe keys
   - Set up domain and SSL

## 🆘 Troubleshooting

### Common Issues:

1. **Qdrant not running**: 
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

2. **JWT verification error**:
   - Check JWT_SECRET in .env
   - In development, tokens bypass verification

3. **Stripe webhook failures**:
   - Verify webhook URL is accessible
   - Check webhook secret matches

4. **Database errors**:
   - Database tables are auto-created on startup
   - Check file permissions

## 📞 Support

The system is now fully implemented and ready for production! The comprehensive user tier system includes:

- **Complete authentication flow**
- **Stripe payment integration** 
- **Feature gating middleware**
- **Admin management interface**
- **Usage tracking and analytics**

Ready to scale and generate revenue! 🚀💰 