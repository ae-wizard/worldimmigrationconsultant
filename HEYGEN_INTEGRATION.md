# HeyGen Interactive Avatar Integration

## Overview

This system now includes full integration with HeyGen's Streaming Avatar API, allowing Sarah (our AI immigration consultant) to appear as an interactive video avatar that can speak our AI-generated responses in real-time.

## Architecture

```
User Chat → AI Response → HeyGen Streaming API → Sarah Speaks → LiveKit Video Stream
```

### Integration Flow:
1. **Session Creation**: Backend creates HeyGen streaming session
2. **Authentication**: Generate session tokens for secure API access  
3. **Video Stream**: LiveKit connects to display Sarah's video
4. **Speaking Tasks**: Chat responses sent to HeyGen API for Sarah to speak
5. **Real-time Control**: Sarah speaks our AI responses programmatically

## Setup Instructions

### 1. Get HeyGen API Key

1. Sign up for HeyGen at [app.heygen.com](https://app.heygen.com)
2. Navigate to Settings → API
3. Generate an API key (requires paid plan for Streaming API)
4. Copy your API key

### 2. Configure Backend Environment

Add your HeyGen API key to `backend/.env`:

```bash
# HeyGen Configuration
HEYGEN_API_KEY=your_actual_heygen_api_key_here

# Required for AI responses
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Verify Installation

The following dependencies are already installed:
- **Backend**: `requests` (for HeyGen API calls)
- **Frontend**: `livekit-client` (for video streaming)

### 4. Test the Integration

1. Start backend: `cd backend && python admin_secure.py`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser to `http://localhost:5173`
4. Sarah should initialize automatically and appear as interactive avatar

## How It Works

### Avatar Modes

The system supports three modes with automatic fallback:

1. **🎬 Streaming API** (Preferred) - Full programmatic control
   - Creates real HeyGen session via `/v1/streaming.new`
   - Sarah speaks AI responses automatically
   - Real-time video stream via LiveKit
   - Full integration with chat system

2. **📺 Interactive Mode** (Fallback) - Embed widget
   - Uses HeyGen's embed iframe
   - Manual "Chat Now" button interaction
   - Visual feedback only for responses

3. **🤖 Text Mode** (Final Fallback) - No avatar
   - Text-based responses only
   - Still functional chat system

### API Endpoints

**Backend endpoints for HeyGen integration:**

```bash
POST /heygen/create-session      # Create new streaming session
POST /heygen/create-session-token # Generate authentication token  
POST /heygen/start-session       # Start video streaming
POST /heygen/send-task           # Send text for Sarah to speak
```

### Frontend Integration

**AvatarSarah Component:**
- Automatically attempts streaming API first
- Connects to LiveKit for video display
- Sends chat responses to Sarah for speaking
- Provides comprehensive debug logging
- Graceful fallback to embed or text mode

## Troubleshooting

### Common Issues

**❌ "No API key found"**
- Solution: Add `HEYGEN_API_KEY` to `backend/.env`

**❌ "Session creation failed"**  
- Check API key is valid and account has streaming access
- Verify network connectivity to HeyGen API
- Check backend logs for detailed error messages

**❌ "Video not loading"**
- LiveKit connection issue - check browser console
- Try refreshing the page
- System will auto-fallback to embed mode

**❌ "Sarah not speaking responses"**
- Verify session is in Streaming API mode (check status indicator)
- Check backend logs for task sending errors  
- Ensure proper session token creation

### Debug Information

**Development mode shows debug panel with:**
- Current mode (Streaming API / Embed / Text)
- Session status and ID
- Real-time logging of all operations
- Test speech button for manual testing
- Retry controls for failed connections

**Backend logging includes:**
- 🎬 Session creation details
- 🎟️ Token generation status
- ▶️ Streaming start confirmation
- 💬 Speaking task transmission
- ❌ Detailed error messages

### Session Limits

**Free/Trial accounts:**
- Limited to 3 concurrent sessions
- Auto-timeout after 2 minutes of inactivity
- Always close unused sessions properly

**Production usage:**
- Monitor session usage in HeyGen dashboard
- Implement proper session cleanup
- Consider session pooling for high traffic

## Avatar Customization

### Using Different Avatars

To use a different HeyGen avatar, modify `backend/admin_secure.py`:

```python
session_data = {
    "avatar_id": "your_custom_avatar_id",  # Change this
    "quality": "high",
    "voice": {
        "voice_id": "your_preferred_voice_id",  # And this
        "emotion": "Friendly"
    }
}
```

**Available options:**
- Public avatars: Get IDs from [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar)
- Custom avatars: Create your own Interactive Avatar in HeyGen Labs
- Voice options: Use [List Voices API](https://docs.heygen.com/reference/list-voices-v2)

### Voice Settings

Customize Sarah's voice in the session creation:

```python
"voice": {
    "voice_id": "1bd001e7e50f421d891986aad5158bc8",  # Professional female
    "rate": 1.0,        # Speech rate (0.5 - 1.5)
    "emotion": "Friendly"  # Excited, Serious, Friendly, Soothing, Broadcaster
}
```

## Production Considerations

### Security
- Never expose HeyGen API keys in frontend code
- All HeyGen API calls go through backend proxy
- Session tokens are single-use and time-limited
- Proper JWT authentication for backend endpoints

### Performance
- LiveKit provides optimized video streaming
- Automatic quality adjustment based on connection
- Efficient session management and cleanup
- Real-time speaking task transmission

### Monitoring
- Backend logs all HeyGen API interactions
- Frontend provides comprehensive debug information
- Session status monitoring and health checks
- Automatic fallback mechanisms

## API Reference

### HeyGen Streaming API Documentation
- [Streaming API Overview](https://docs.heygen.com/docs/streaming-api)
- [LiveKit Integration Guide](https://docs.heygen.com/docs/streaming-api-integration-with-livekit-v2)
- [API Reference](https://docs.heygen.com/reference/new-session)

### Integration Benefits
- **Real-time interaction**: Sarah speaks responses as they're generated
- **Professional appearance**: High-quality avatar representation  
- **Seamless experience**: Integrated with existing chat system
- **Reliable fallbacks**: Multiple backup modes ensure system always works
- **Easy customization**: Simple avatar and voice modifications

---

## Success! 🎉

When properly configured, users will see Sarah as an interactive video avatar who:
- Appears automatically when they start chatting
- Speaks AI-generated immigration advice in real-time
- Provides visual feedback (speaking animations, status indicators)
- Offers a professional, engaging consultation experience

The system maintains full compatibility with the existing immigration knowledge base, LangChain memory, and conversation flow while adding the powerful visual element of an interactive avatar consultant. 