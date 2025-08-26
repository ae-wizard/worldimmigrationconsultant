# 🇺🇸 AI Immigration Consultant MVP

An AI-powered immigration consultant web application with **Interactive Avatar Technology** that provides expert guidance using official USCIS information. Built with FastAPI, React, LLaMA 3, Qdrant vector database, and **HeyGen Streaming Avatars**.

## 🚀 Features

- **🎬 Interactive Avatar**: Real-time AI avatar "Sarah" powered by HeyGen's Streaming API
- **AI-Powered Responses**: Uses LLaMA 3 8B model for intelligent immigration guidance
- **Official Information**: Retrieval-Augmented Generation (RAG) using scraped USCIS and State Department content
- **Real-time Chat**: Streaming responses with avatar speech synthesis
- **Lead Capture**: Collects user information for potential client conversion
- **Modern UI**: Responsive React frontend with professional design
- **Multi-Modal Fallback**: Avatar, embed, or text-only modes for universal compatibility
- **Containerized**: Docker Compose setup for easy deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │   LLaMA 3 8B    │
│   (Port 5173)   │◄──►│   (Port 8000)   │◄──►│   (Port 8080)   │
│                 │    │                 │    └─────────────────┘
│ ┌─────────────┐ │    │ ┌─────────────┐ │    ┌─────────────────┐
│ │ Avatar Sarah│ │◄──►│ │ HeyGen API  │ │◄──►│  HeyGen Servers │
│ │ (LiveKit)   │ │    │ │ Integration │ │    │  Streaming API  │
│ └─────────────┘ │    │ └─────────────┘ │    └─────────────────┘
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Qdrant Vector DB │
                       │   (Port 6333)   │
                       └─────────────────┘
```

## 📋 Prerequisites

- Docker Desktop
- Python 3.11+ (for local development)
- Node.js 18+ (for frontend development)
- Hugging Face Account (for LLaMA model access)
- **HeyGen Account** (for interactive avatar - requires paid plan)

## ⚡ Quick Start

### 1. Clone and Setup

```bash
cd ai-immigration-mvp
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file and add your tokens:

```bash
HF_TOKEN=your_huggingface_token_here
HEYGEN_API_KEY=your_heygen_api_key_here  # For interactive avatar
OPENAI_API_KEY=your_openai_api_key_here  # For AI responses
```

**Get your tokens from:**
- Hugging Face: https://huggingface.co/settings/tokens
- HeyGen: https://app.heygen.com/settings?nav=API
- OpenAI: https://platform.openai.com/api-keys

### 3. Start Services

```bash
# Start all services with Docker Compose
docker compose up --build

# Or start in background
docker compose up -d --build
```

### 4. Access the Application

- **Frontend**: http://localhost:5173 (Sarah avatar will appear automatically)
- **API Docs**: http://localhost:8000/docs
- **Qdrant UI**: http://localhost:6333/dashboard

## 🎬 Interactive Avatar Features

### Sarah - Your AI Immigration Consultant

- **Real-time Avatar**: Professional AI avatar that speaks responses
- **Automatic Integration**: Sarah appears when users start chatting
- **Natural Speech**: Text-to-speech synthesis of AI responses
- **Visual Feedback**: Speaking animations and status indicators
- **Fallback Modes**: Graceful degradation if avatar unavailable

### Avatar Technology Stack

- **HeyGen Streaming API**: Professional avatar generation
- **LiveKit**: Real-time video streaming
- **Text-to-Speech**: AI response vocalization
- **WebRTC**: Low-latency communication

For detailed setup instructions, see: [HEYGEN_INTEGRATION.md](HEYGEN_INTEGRATION.md)

## 🔧 Development Setup

### Backend Development

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run scraper to populate knowledge base
cd backend
python scraper.py

# Index content into vector database
python embeddings.py

# Start FastAPI server
uvicorn api:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📊 Data Pipeline

### 1. Content Scraping

The application scrapes official immigration content from:

- USCIS Policy Manual
- USCIS FAQ pages
- State Department visa information
- Immigration form guidelines

```bash
cd backend
python scraper.py
```

### 2. Vector Indexing

Content is chunked and embedded using Sentence Transformers:

```bash
cd backend
python embeddings.py
```

### 3. RAG Pipeline

1. User question → Embedding
2. Vector similarity search in Qdrant
3. Retrieved context + question → LLaMA 3
4. Streamed response to user

## 🐳 Docker Services

### API Service
- **Image**: Custom (built from backend/)
- **Port**: 8000
- **Features**: FastAPI, RAG pipeline, conversation logging

### Qdrant Service
- **Image**: qdrant/qdrant:v1.7.4
- **Port**: 6333
- **Features**: Vector search, persistence

### LLM Service
- **Image**: ghcr.io/huggingface/text-generation-inference:2.4.0
- **Port**: 8080
- **Model**: meta-llama/Meta-Llama-3-8B-Instruct

## 🔍 API Endpoints

### Core Endpoints

- `POST /ask` - Submit question and get streaming AI response
- `POST /lead` - Submit lead information
- `GET /health` - Health check

### Example Usage

```bash
# Ask a question
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I apply for naturalization?"}'

# Submit lead
curl -X POST "http://localhost:8000/lead" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "country": "India",
    "intent": "Apply for green card"
  }'
```

## 📱 Frontend Features

### Chat Interface
- Real-time streaming responses
- Message history
- Loading states and error handling
- Mobile-responsive design

### Lead Capture
- Modal form after 3 conversations
- Country selection
- Intent collection
- Success confirmation

## 🗄️ Database Schema

### Conversations Table
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY,
    user_question TEXT,
    assistant_answer TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Leads Table
```sql
CREATE TABLE leads (
    id INTEGER PRIMARY KEY,
    email TEXT,
    country TEXT,
    intent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Production environment
ENV=production
QDRANT_URL=https://your-qdrant-instance.com
LLM_API_URL=https://your-llm-instance.com
HF_TOKEN=your_production_token
```

### Scaling Considerations

1. **LLM Service**: Consider GPU instances for better performance
2. **Vector Database**: Use Qdrant Cloud for production
3. **API**: Load balancer for multiple FastAPI instances
4. **Frontend**: Serve static files via CDN

## 🔒 Security Notes

- Environment variables are not committed to version control
- API endpoints should have rate limiting in production
- LLM responses should be monitored for quality
- User data collection follows privacy guidelines

## 📈 Monitoring & Analytics

### Conversation Logging
- All Q&A pairs are logged to SQLite
- Retrievable via database queries
- Useful for improving responses

### Lead Analytics
- Track conversion rates
- Monitor user countries and intents
- Identify common use cases

## 🛠️ Troubleshooting

### Common Issues

1. **LLM Service Fails to Start**
   - Check HF_TOKEN is valid
   - Ensure sufficient memory (8GB+)
   - Verify model permissions

2. **Vector Search Errors**
   - Ensure Qdrant is running
   - Check if collection exists
   - Verify content is indexed

3. **Frontend Connection Issues**
   - Check CORS settings in FastAPI
   - Verify API URL in frontend code
   - Ensure all services are running

### Logs

```bash
# View all service logs
docker compose logs -f

# View specific service
docker compose logs -f api
docker compose logs -f qdrant
docker compose logs -f llm
```

## 🎯 Roadmap

- [x] **Interactive Avatar Integration** ✅ - Sarah AI consultant with HeyGen Streaming API
- [ ] Multi-language support
- [ ] Advanced conversation threading
- [ ] Document upload and analysis
- [ ] Integration with immigration forms
- [ ] Enhanced lead scoring
- [ ] Voice chat with avatar (speech-to-text input)
- [ ] Custom avatar creation workflows
- [ ] Mobile app version
- [ ] Avatar emotion and gesture customization

## 📝 License

This project is for educational and demonstration purposes. Always consult qualified immigration attorneys for legal advice.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

---

**Disclaimer**: This AI assistant provides general information only. Always consult with a qualified immigration attorney for legal advice. 