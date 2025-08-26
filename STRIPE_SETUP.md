# 💳 Complete Stripe Setup Guide

## 🎯 What We're Building

Your immigration platform will have:
- **Free Tier**: 5 AI questions/day, 1 report/month
- **Premium Tier**: $29/month - unlimited access
- **Automatic billing** via Stripe
- **Instant upgrades** with payment processing

## 📋 Step-by-Step Setup

### 1. Create Stripe Account (5 minutes)

1. Go to [stripe.com](https://stripe.com)
2. Click "Start now" and sign up
3. Complete business verification (can start in test mode)

### 2. Get API Keys (2 minutes)

1. **Login to Stripe Dashboard**
2. **Go to**: Developers → API keys
3. **Copy these values**:

```bash
# TEST KEYS (for development)
Publishable key: pk_test_51ABC123...
Secret key: sk_test_51ABC123...

# LIVE KEYS (for production later)
Publishable key: pk_live_51ABC123...
Secret key: sk_live_51ABC123...
```

**🔑 What I need from you**: Your `sk_test_...` and `pk_test_...` keys

### 3. Create Premium Product (3 minutes)

1. **Go to**: Products → "Add product"
2. **Product Info**:
   ```
   Name: Immigration Premium Subscription
   Description: Unlimited AI questions, visa reports, PDF downloads, and priority support
   ```
3. **Pricing**:
   ```
   Price: $29.00 USD
   Billing: Recurring
   Interval: Monthly
   Payment link: ✅ Enabled
   ```
4. **Save** and copy the **Price ID**: `price_1ABC123...`

**💰 What I need from you**: Your `price_...` ID

### 4. Set Up Webhooks (5 minutes)

This enables automatic subscription management.

#### A. Create Webhook Endpoint

1. **Go to**: Developers → Webhooks → "Add endpoint"
2. **Endpoint URL**: 
   ```
   # For development (using ngrok):
   https://your-ngrok-url.ngrok.io/payments/stripe-webhook
   
   # For production:
   https://your-domain.com/payments/stripe-webhook
   ```

#### B. Select Events

Check these events:
```
✅ checkout.session.completed
✅ customer.subscription.deleted  
✅ customer.subscription.updated
✅ invoice.payment_succeeded
✅ invoice.payment_failed
```

#### C. Copy Webhook Secret

After saving: `whsec_1ABC123...`

**🔗 What I need from you**: Your `whsec_...` webhook secret

## 🌐 Development Setup with ngrok

Since Stripe needs to send webhooks to your local server, we'll use ngrok:

### Start ngrok (run this when developing):

```bash
# Terminal 1: Start ngrok
ngrok http 8001

# You'll get a URL like: https://abc123.ngrok.io
# Use this URL in your Stripe webhook configuration
```

### Update Webhook URL in Stripe:
```
https://abc123.ngrok.io/payments/stripe-webhook
```

## 🔧 Environment Configuration

Create a `.env` file in your backend directory:

```bash
# Development Mode
DEVELOPMENT_MODE=true

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Qdrant (Vector Database)
QDRANT_URL=http://localhost:6333

# ================================
# 💳 STRIPE CONFIGURATION
# ================================

# API Keys (from Step 2)
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY

# Product Pricing (from Step 3)  
STRIPE_PRICE_ID_PREMIUM=price_YOUR_ACTUAL_PRICE_ID

# Webhook Secret (from Step 4)
STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_WEBHOOK_SECRET
```

## 🚀 Quick Start Commands

```bash
# Terminal 1: Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Terminal 2: Start ngrok (for webhooks)
ngrok http 8001

# Terminal 3: Start backend  
cd worldimmigration-clean/backend
export DEVELOPMENT_MODE=true
python admin_secure.py

# Terminal 4: Start frontend
cd worldimmigration-clean/frontend  
npm run dev
```

## 🧪 Testing the Payment Flow

1. **Register a test user** at http://localhost:5173
2. **Try AI chat** (should work with free limits)
3. **Click "Upgrade to Premium"** 
4. **Use Stripe test cards**:
   ```
   Success: 4242 4242 4242 4242
   Declined: 4000 0000 0000 0002
   ```

## 📝 What I Need From You

Please provide these 4 values:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...  
STRIPE_PRICE_ID_PREMIUM=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 🛡️ Security Notes

- **Test vs Live**: Start with test keys, switch to live when ready
- **Webhook Secrets**: Always verify webhook signatures in production
- **Environment Variables**: Never commit real keys to version control
- **HTTPS**: Production webhooks require HTTPS endpoints

## 🚨 Troubleshooting

### Common Issues:

1. **Webhook 404**: Make sure ngrok URL includes `/payments/stripe-webhook`
2. **Invalid Price ID**: Double-check the `price_...` ID from Stripe dashboard
3. **Token Issues**: Set `DEVELOPMENT_MODE=true` for testing
4. **CORS Errors**: Frontend and backend on different ports is normal

## 📈 Revenue Tracking

Once set up, you'll have:
- **Real-time subscription tracking**
- **Automatic tier upgrades/downgrades**  
- **Revenue analytics in admin panel**
- **Customer management via Stripe dashboard**

Ready to start generating revenue! 💰 