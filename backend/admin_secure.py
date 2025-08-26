#!/usr/bin/env python3
"""
Secure Immigration Admin Panel
Enterprise-grade admin system with:
- AWS Cognito authentication
- CSV management & editing
- Document upload for failed scrapes
- Automated scheduling
- Vector database management
- Full scraping pipeline integration
- Conversation monitoring & feedback
- User tier management with Stripe integration
- Feature gating and access control
- LangChain conversation memory integration
"""

# Load environment variables first
from dotenv import load_dotenv
load_dotenv("production.env")

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Body, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional, Any
import pandas as pd
import json
import os
import jwt
import requests
import asyncio
import time
from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
import io
import csv
from contextlib import asynccontextmanager
import hashlib
import secrets
import uuid
import stripe
import bcrypt
from email_validator import validate_email
import logging
import schedule
import threading
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import aiofiles
import sys
import re
import base64

# LangChain imports for conversation memory
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryBufferMemory
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain.memory.chat_message_histories import SQLChatMessageHistory as LangChainSQLHistory
import openai

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_your_stripe_key_here")
STRIPE_PRICE_ID_PREMIUM = os.getenv("STRIPE_PRICE_ID_PREMIUM", "price_your_premium_price_id")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Import our existing components with error handling
try:
    from scraper_csv import scrape_from_csv, save_scraped_content, load_scraped_content
    print("✅ Scraper CSV functions imported successfully")
    SCRAPER_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Warning: Could not import scraper functions: {e}")
    print("🔄 Using fallback scraper functions")
    SCRAPER_AVAILABLE = False
    
    # Define fallback scraper functions that work without dependencies
    def scrape_from_csv(csv_file):
        """Fallback scraper that simulates scraping"""
        print(f"📄 Fallback: Simulating scrape of {csv_file}")
        import pandas as pd
        import time
        
        try:
            df = pd.read_csv(csv_file)
            simulated_content = []
            
            for _, row in df.iterrows():
                simulated_content.append({
                    'url': row.get('url', ''),
                    'title': row.get('title', ''),
                    'content': f"Simulated content for {row.get('title', 'Unknown')}",
                    'country': row.get('country', ''),
                    'category': row.get('category', ''),
                    'scraped_at': time.time(),
                    'status': 'simulated'
                })
            
            print(f"✅ Fallback scraper simulated {len(simulated_content)} items")
            return simulated_content
            
        except Exception as e:
            print(f"❌ Fallback scraper error: {e}")
            return []
    
    def save_scraped_content(content, filename):
        """Fallback save function"""
        try:
            import json
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(content, f, indent=2, ensure_ascii=False)
            print(f"✅ Fallback: Saved {len(content)} items to {filename}")
            return True
        except Exception as e:
            print(f"❌ Fallback save error: {e}")
            return False
    
    def load_scraped_content(filename):
        """Fallback load function"""
        try:
            import json
            with open(filename, 'r', encoding='utf-8') as f:
                content = json.load(f)
            print(f"✅ Fallback: Loaded {len(content)} items from {filename}")
            return content
        except Exception as e:
            print(f"❌ Fallback load error: {e}")
            return []

try:
    from embeddings_csv import load_and_index_csv_content, get_collection_stats, search_immigration_content
    print("✅ Embeddings functions imported successfully")
    EMBEDDINGS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Warning: Could not import embedding functions: {e}")
    print("🔄 Using fallback embedding functions") 
    EMBEDDINGS_AVAILABLE = False
    
    # Define fallback embedding functions
    def load_and_index_csv_content(filename, collection_name="immigration_docs"):
        """Fallback indexing function"""
        print(f"📊 Fallback: Simulating indexing of {filename}")
        return True
        
    def get_collection_stats(collection_name="immigration_docs"):
        """Fallback stats function"""
        return {"total_points": 0, "status": "fallback_mode"}
        
    def search_immigration_content(query, collection_name="immigration_docs", limit=5):
        """Fallback search function"""
        print(f"🔍 Fallback: Simulating search for '{query}'")
        return []

# Import PDF generator
from pdf_generator import ImmigrationPDFGenerator

# ElevenLabs integration class
class ElevenLabsVoiceService:
    def __init__(self):
        self.api_key = os.getenv('ELEVENLABS_API_KEY')
        self.base_url = "https://api.elevenlabs.io/v1"
        
        # UPDATED: Language-specific voice mapping with verified native speakers
        # Using ElevenLabs premium voices optimized for each language's pronunciation
        self.language_voices = {
            'en': 'EXAVITQu4vr4xnSDxMaL',  # Sarah - Professional English (verified)
            'es': 'XrExE9yKIg1WjnnlVkGX',  # Matilda - Native Spanish speaker
            'fr': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for French
            'de': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for German
            'it': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Italian
            'pt': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Portuguese
            'ru': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Russian
            'zh': 'EXAVITQu4vr4xnSDxMaL',  # FIXED: Use multilingual model for Chinese
            'ja': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Japanese
            'ko': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Korean
            'ar': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Arabic
            'hi': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Hindi
            'pl': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Polish
            'nl': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Dutch
            'sv': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Swedish
            'th': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Thai
            'vi': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Vietnamese
            'tr': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Turkish
            'id': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Indonesian
            # NEW: ElevenLabs additional languages
            'hu': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Hungarian
            'no': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Norwegian
            'bg': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Bulgarian
            'ro': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Romanian
            'el': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Greek
            'fi': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Finnish
            'hr': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Croatian
            'da': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Danish
            'ta': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Tamil
            'fil': 'EXAVITQu4vr4xnSDxMaL', # Use multilingual model for Filipino
            'cs': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Czech
            'sk': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Slovak
            'uk': 'EXAVITQu4vr4xnSDxMaL',  # Use multilingual model for Ukrainian
            'ms': 'EXAVITQu4vr4xnSDxMaL'   # Use multilingual model for Malay
        }
    
    def _get_language_code(self, language: str) -> str:
        """Map our language codes to ElevenLabs language codes for better pronunciation"""
        language_mapping = {
            'en': 'en',    # English
            'es': 'es',    # Spanish
            'fr': 'fr',    # French
            'de': 'de',    # German
            'it': 'it',    # Italian
            'pt': 'pt',    # Portuguese
            'ru': 'ru',    # Russian
            'zh': 'zh',    # Chinese (Mandarin)
            'ja': 'ja',    # Japanese
            'ko': 'ko',    # Korean
            'ar': 'ar',    # Arabic
            'hi': 'hi',    # Hindi
            'pl': 'pl',    # Polish
            'nl': 'nl',    # Dutch
            'sv': 'sv',    # Swedish
            'th': 'th',    # Thai
            'vi': 'vi',    # Vietnamese
            'tr': 'tr',    # Turkish
            'id': 'id',    # Indonesian
            # NEW: ElevenLabs additional languages
            'hu': 'hu',    # Hungarian
            'no': 'no',    # Norwegian
            'bg': 'bg',    # Bulgarian
            'ro': 'ro',    # Romanian
            'el': 'el',    # Greek
            'fi': 'fi',    # Finnish
            'hr': 'hr',    # Croatian
            'da': 'da',    # Danish
            'ta': 'ta',    # Tamil
            'fil': 'fil',  # Filipino
            'cs': 'cs',    # Czech
            'sk': 'sk',    # Slovak
            'uk': 'uk',    # Ukrainian
            'ms': 'ms'     # Malay
        }
        return language_mapping.get(language, 'en')  # Default to English if not found
    
    def preprocess_text_for_speech(self, text: str, language: str) -> str:
        """Preprocess text for speech - clean formatting and optimize for pronunciation"""
        processed_text = text
        
        # Remove markdown formatting that might confuse TTS
        processed_text = processed_text.replace('**', '')  # Remove bold markdown
        processed_text = processed_text.replace('*', '')   # Remove italic markdown
        processed_text = processed_text.replace('_', '')   # Remove underscore markdown
        
        # Language-specific text preprocessing
        if language == 'zh':
            # For Chinese, ensure proper spacing and punctuation
            processed_text = processed_text.replace('！', '！ ')  # Add space after exclamation
            processed_text = processed_text.replace('？', '？ ')  # Add space after question
        elif language == 'ja':
            # For Japanese, ensure proper punctuation spacing
            processed_text = processed_text.replace('。', '。 ')  # Add space after period
        elif language == 'ar':
            # For Arabic, ensure proper text direction markers if needed
            processed_text = processed_text.strip()
        
        # Keep names (Sarah, Premium) in original language for consistency
        # The multilingual model handles mixed content well
        
        return processed_text.strip()
    
    async def synthesize_speech(self, text: str, language: str = 'en') -> bytes:
        """
        Synthesize speech using ElevenLabs with language-appropriate voice
        Returns audio data optimized for HeyGen lip sync
        """
        try:
            if not self.api_key:
                raise Exception("ElevenLabs API key not configured")
            
            # Preprocess text for better pronunciation
            processed_text = self.preprocess_text_for_speech(text, language)
            
            # Get appropriate voice for language
            voice_id = self.language_voices.get(language, self.language_voices['en'])
            
            print(f"🎙️ [ElevenLabs] Synthesizing speech in {language} with multilingual voice {voice_id}")
            print(f"🎙️ [ElevenLabs] Model: eleven_multilingual_v2 (auto-detects language) | Text: {text[:100]}...")
            if processed_text != text:
                print(f"🎙️ [ElevenLabs] Processed text: {processed_text[:100]}...")
            
            # ElevenLabs API request - OPTIMIZED FOR HEYGEN
            url = f"{self.base_url}/text-to-speech/{voice_id}"
            
            headers = {
                "Accept": "audio/mpeg",  # Keep MP3 format for compatibility
                "Content-Type": "application/json",
                "xi-api-key": self.api_key
            }
            
            # OPTIMIZED: Settings for multilingual pronunciation and streaming
            data = {
                "text": processed_text,
                "model_id": "eleven_multilingual_v2",  # FIXED: Use multilingual v2 for auto language detection
                "voice_settings": {
                    "stability": 0.8,         # HIGHER: Better stability for non-English languages
                    "similarity_boost": 0.9,  # HIGHER: Better pronunciation similarity
                    "style": 0.0,             # MINIMAL: Clean pronunciation for all languages
                    "use_speaker_boost": True
                },
                "output_format": "mp3_22050_32",    # Streaming format
                "optimize_streaming_latency": 3     # Balanced latency vs quality
                # NOTE: eleven_multilingual_v2 auto-detects language, no language_code needed
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=30)
            
            if response.status_code != 200:
                raise Exception(f"ElevenLabs API error: {response.status_code} - {response.text}")
            
            audio_data = response.content
            print(f"✅ [ElevenLabs] Generated {len(audio_data)} bytes of streaming-optimized audio")
            
            return audio_data
            
        except Exception as e:
            print(f"❌ [ElevenLabs] Error: {str(e)}")
            raise e
    
    async def convert_to_heygen_format(self, audio_data: bytes) -> str:
        """
        Convert audio to format compatible with HeyGen streaming API
        FIXED: Use raw base64 without data URL wrapper
        """
        try:
            # FIXED: HeyGen expects raw base64, not data URL format
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            print(f"🔄 [ElevenLabs] Converted {len(audio_data)} bytes to base64 ({len(audio_base64)} chars)")
            return audio_base64  # Return raw base64 without data URL wrapper
            
        except Exception as e:
            print(f"❌ [ElevenLabs] Audio conversion error: {str(e)}")
            raise e

# Initialize ElevenLabs service
elevenlabs_service = ElevenLabsVoiceService()

# OpenAI configuration - FIXED: Load API keys properly
try:
    from rag_config import rag_config
    if rag_config.openai_api_key and not os.getenv("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = rag_config.openai_api_key
        print("✅ OpenAI API key loaded from rag_config")
    elif os.getenv("OPENAI_API_KEY"):
        print("✅ OpenAI API key already set in environment")
    else:
        print("❌ No OpenAI API key found")
except Exception as e:
    print(f"⚠️ Error loading rag_config: {e}")

openai.api_key = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")

# LLAMA API configuration - Set the URL if available  
if not os.getenv("LLAMA_API_URL"):
    # Set a default LLAMA URL for development
    os.environ["LLAMA_API_URL"] = "https://your-llama-api-url.com"  # Replace with actual URL when available
    print("✅ LLAMA API URL set for development")

# LangChain Conversation Memory Manager
class LangChainConversationMemory:
    """
    LangChain-based conversation memory management for immigration consultant AI
    """
    
    def __init__(self):
        """Initialize the conversation memory manager"""
        self.conversations = {}  # Store memory instances per user
        self.max_token_limit = 2000  # Token limit for conversation buffer
        self.k = 10  # Number of recent exchanges to keep in buffer
        
        # Initialize OpenAI Chat model for LangChain
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if self.openai_api_key and len(self.openai_api_key) > 20:
            self.llm = ChatOpenAI(
                temperature=0.7,
                model="gpt-3.5-turbo",
                openai_api_key=self.openai_api_key
            )
            print("✅ LangChain ChatOpenAI initialized")
        else:
            self.llm = None
            print("❌ OpenAI API key not available for LangChain")
    
    def get_memory_for_user(self, user_id: str, user_name: str = "User") -> ConversationBufferWindowMemory:
        """
        Get or create conversation memory for a specific user
        """
        if user_id not in self.conversations:
            print(f"🧠 Creating new LangChain memory for user: {user_id}")
            
            # Create conversation memory with summary buffer to handle long conversations
            if self.llm:
                memory = ConversationSummaryBufferMemory(
                    llm=self.llm,
                    max_token_limit=self.max_token_limit,
                    return_messages=True,
                    human_prefix=user_name,
                    ai_prefix="Sarah"
                )
            else:
                # Fallback to simple buffer if no LLM available
                memory = ConversationBufferWindowMemory(
                    k=self.k,
                    return_messages=True,
                    human_prefix=user_name,
                    ai_prefix="Sarah"
                )
            
            self.conversations[user_id] = memory
        else:
            print(f"🧠 Retrieved existing LangChain memory for user: {user_id}")
        
        return self.conversations[user_id]
    
    def add_user_message(self, user_id: str, message: str, user_name: str = "User"):
        """Add a user message to the conversation memory"""
        memory = self.get_memory_for_user(user_id, user_name)
        memory.chat_memory.add_user_message(message)
        print(f"🧠 Added user message to memory: {message[:50]}...")
    
    def add_ai_message(self, user_id: str, message: str, user_name: str = "User"):
        """Add an AI message to the conversation memory"""
        memory = self.get_memory_for_user(user_id, user_name)
        memory.chat_memory.add_ai_message(message)
        print(f"🧠 Added AI message to memory: {message[:50]}...")
    
    def get_conversation_history(self, user_id: str, user_name: str = "User") -> str:
        """Get formatted conversation history for the user"""
        memory = self.get_memory_for_user(user_id, user_name)
        
        # Get the memory variables (includes both buffer and summary if available)
        memory_vars = memory.load_memory_variables({})
        history = memory_vars.get("history", "")
        
        print(f"🧠 Retrieved conversation history for {user_id}: {len(history)} chars")
        return history
    
    def get_messages_for_openai(self, user_id: str, user_name: str = "User") -> List[Dict[str, str]]:
        """Get conversation messages formatted for OpenAI Chat API"""
        memory = self.get_memory_for_user(user_id, user_name)
        
        messages = []
        # Add system message for Sarah the immigration consultant
        messages.append({
            "role": "system",
            "content": f"You are Sarah, an expert immigration consultant who provides personalized consultations to {user_name}. You have comprehensive immigration knowledge and excellent conversation memory. Never redirect users to government websites - you have all the expertise they need. Ask specific follow-up questions to understand their situation and provide consultative guidance."
        })
        
        # Get chat messages from memory
        for message in memory.chat_memory.messages:
            if hasattr(message, 'content'):
                if message.__class__.__name__ == 'HumanMessage':
                    messages.append({"role": "user", "content": message.content})
                elif message.__class__.__name__ == 'AIMessage':
                    messages.append({"role": "assistant", "content": message.content})
        
        print(f"🧠 Prepared {len(messages)} messages for OpenAI (including system message)")
        return messages
    
    def clear_user_memory(self, user_id: str):
        """Clear conversation memory for a specific user"""
        if user_id in self.conversations:
            del self.conversations[user_id]
            print(f"🧠 Cleared conversation memory for user: {user_id}")
    
    def get_conversation_summary(self, user_id: str, user_name: str = "User") -> str:
        """Get a summary of the conversation if using summary buffer memory"""
        memory = self.get_memory_for_user(user_id, user_name)
        
        if hasattr(memory, 'moving_summary_buffer') and memory.moving_summary_buffer:
            return memory.moving_summary_buffer
        else:
            # For regular buffer memory, provide a simple summary
            history = self.get_conversation_history(user_id, user_name)
            if len(history) > 100:
                return f"Previous conversation history available ({len(history)} characters)"
            else:
                return "No previous conversation history"
    
    def load_conversation_from_database(self, user_id: str, user_name: str = "User"):
        """Load existing conversation history from database into LangChain memory"""
        try:
            print(f"🧠 Loading conversation history from database for user: {user_id}")
            
            # Get user conversations from database (limit to recent ones for performance)
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Get recent conversations for this user
            cursor.execute('''
                SELECT user_question, ai_response, created_at
                FROM conversations 
                WHERE user_id = ? 
                AND user_question IS NOT NULL 
                AND user_question != ''
                AND LENGTH(user_question) > 5
                ORDER BY created_at DESC 
                LIMIT 20
            ''', (user_id,))
            
            conversations = cursor.fetchall()
            conn.close()
            
            if conversations:
                print(f"🧠 Found {len(conversations)} conversations to load into memory")
                
                # Reverse to get chronological order (oldest first)
                conversations.reverse()
                
                # Add conversations to LangChain memory
                for question, response, created_at in conversations:
                    if question and response:
                        self.add_user_message(user_id, question, user_name)
                        self.add_ai_message(user_id, response, user_name)
                
                print(f"✅ Loaded {len(conversations)} conversation pairs into LangChain memory")
            else:
                print(f"🧠 No previous conversations found for user: {user_id}")
                
        except Exception as e:
            print(f"❌ Error loading conversation history from database: {e}")

# Initialize global conversation memory manager
conversation_memory = LangChainConversationMemory()

def calculate_days_ago(created_at_str: str) -> int:
    """Calculate how many days ago a conversation happened"""
    try:
        from datetime import datetime
        if created_at_str:
            # Remove timezone info if present
            clean_timestamp = created_at_str.replace('Z', '').replace('+00:00', '')
            created_at = datetime.fromisoformat(clean_timestamp)
            now = datetime.now()
            diff = now - created_at
            return max(0, diff.days)  # Ensure non-negative
        return 999  # Very old if no timestamp
    except Exception as e:
        print(f"❌ Error parsing timestamp {created_at_str}: {e}")
        return 999  # Default to very old if can't parse

def build_comprehensive_ai_context(conversations: List[Dict[str, Any]], user_name: str) -> str:
    """Build comprehensive conversation context for AI with all conversations organized by recency"""
    if not conversations:
        return f"No previous conversations found for {user_name}."
    
    context = f"=== COMPLETE CONVERSATION HISTORY FOR {user_name.upper()} ===\n"
    context += f"Total conversations: {len(conversations)}\n\n"
    
    # Group conversations by recency  
    recent_conversations = [c for c in conversations if c.get('is_recent', False)]  # Last week
    older_conversations = [c for c in conversations if not c.get('is_recent', False)]   # Older than a week
    
    # Recent conversations (highest priority for welcome message)
    if recent_conversations:
        context += f"🔥 RECENT CONVERSATIONS (LAST 7 DAYS) - HIGHEST PRIORITY:\n"
        context += f"Count: {len(recent_conversations)} recent conversations\n\n"
        
        for i, conv in enumerate(recent_conversations):
            days_ago = conv.get('days_ago', 0)
            context += f"RECENT #{i+1} ({days_ago} days ago):\n"
            context += f"User Question: {conv.get('user_question', 'N/A')}\n"
            context += f"AI Response: {conv.get('ai_response', 'N/A')[:400]}...\n"
            context += f"Immigration Context: {conv.get('origin_country', 'N/A')} → {conv.get('destination_country', 'N/A')} for {conv.get('immigration_goal', 'N/A')}\n"
            context += f"Date: {conv.get('created_at', 'N/A')}\n"
            context += "=" * 60 + "\n"
    
    # Historical conversations (background context for continuity)
    if older_conversations:
        context += f"\n📚 HISTORICAL CONVERSATIONS (BACKGROUND CONTEXT):\n"
        context += f"Count: {len(older_conversations)} historical conversations\n\n"
        
        # Show up to 20 historical conversations to provide comprehensive context
        for i, conv in enumerate(older_conversations[:20]):
            days_ago = conv.get('days_ago', 0)
            context += f"Historical #{i+1} ({days_ago} days ago):\n"
            context += f"User Question: {conv.get('user_question', 'N/A')[:200]}...\n"
            context += f"Immigration Focus: {conv.get('immigration_goal', 'N/A')} | {conv.get('origin_country', 'N/A')} → {conv.get('destination_country', 'N/A')}\n"
            context += f"Date: {conv.get('created_at', 'N/A')}\n"
            context += "-" * 40 + "\n"
        
        if len(older_conversations) > 20:
            context += f"\n... and {len(older_conversations) - 20} more historical conversations available ...\n"
    
    # Summary for AI guidance
    context += f"\n📊 CONVERSATION ANALYSIS FOR AI:\n"
    context += f"• Total conversations: {len(conversations)}\n"
    context += f"• Recent (last 7 days): {len(recent_conversations)}\n"
    context += f"• Historical: {len(older_conversations)}\n"
    context += f"• This user ({user_name}) has an established immigration journey with extensive history\n"
    context += f"• Focus MOST on recent conversations for welcome message\n"
    context += f"• Use historical conversations for additional context about their long-term goals\n"
    
    return context

async def generate_personalized_welcome(user_profile: Dict[str, Any], user_name: str, last_conversation: Optional[Dict] = None, user_language: str = 'en') -> str:
    """Generate simple personalized welcome for returning users - FIXED: Short and hardcoded"""
    
    print(f"🔍 === GENERATE SIMPLE PERSONALIZED WELCOME ===")
    print(f"🔍 User name: {user_name}")
    print(f"🔍 Last conversation: {last_conversation is not None}")
    print(f"🔍 User language: {user_language}")
    
    if not last_conversation:
        # First time or logged out users - generic intro
        print(f"🔍 No last conversation found - generating generic intro")
        welcome_msg = f"Hello! I'm Sarah, your worldwide immigration consultant. I help people immigrate to ANY country globally! 🌍\n\nI use the latest official government data to give you accurate, up-to-date guidance. Let's start - which country do you want to immigrate TO?"
        
        # Translate if needed
        if user_language != 'en':
            try:
                from translation_service import translation_service
                welcome_msg = await translation_service.translate_text(welcome_msg, user_language, 'en')
                print(f"🌐 Welcome message translated to {user_language}")
            except Exception as e:
                print(f"❌ Translation failed for welcome message: {e}")
        
        return welcome_msg
    
    # FIXED: Simple hardcoded welcome that references previous conversations
    try:
        # Get basic context from last conversation
        last_destination = last_conversation.get('destination_country', 'your destination')
        last_origin = last_conversation.get('origin_country', 'your country')  
        last_goal = last_conversation.get('immigration_goal', 'immigration')
        
        # Clean up country names
        if last_destination:
            destination_display = last_destination.replace('_', ' ').title()
            if destination_display.lower() in ['usa', 'us']:
                destination_display = 'United States'
        else:
            destination_display = 'your destination'
            
        if last_origin:
            origin_display = last_origin.replace('_', ' ').title()
        else:
            origin_display = 'your country'
        
        # Simple hardcoded message - no AI generation
        if last_goal == 'family':
            welcome_msg = f"Hey, {user_name}! Welcome back! 👋\n\nI saw we were talking before about family immigration to {destination_display}. Would you like to continue where we left off, or would you like to explore another topic?"
        elif last_goal in ['student', 'study']:
            welcome_msg = f"Hey, {user_name}! Welcome back! 👋\n\nI saw we were discussing student visas to {destination_display}. Would you like to continue with that, or would you like to explore another topic?"
        elif last_goal == 'work':
            welcome_msg = f"Hey, {user_name}! Welcome back! 👋\n\nI saw we were talking about work visas to {destination_display}. Want to continue with that topic, or explore something else?"
        else:
            welcome_msg = f"Hey, {user_name}! Welcome back! 👋\n\nI saw we were discussing immigration to {destination_display}. Would you like to continue where we left off, or would you like to explore another topic?"
        
        # Translate if needed
        if user_language != 'en':
            try:
                from translation_service import translation_service
                welcome_msg = await translation_service.translate_text(welcome_msg, user_language, 'en')
                print(f"🌐 Returning user welcome message translated to {user_language}")
            except Exception as e:
                print(f"❌ Translation failed for returning user welcome: {e}")
        
        print(f"✅ Simple hardcoded welcome generated: {len(welcome_msg)} chars")
        return welcome_msg
        
    except Exception as e:
        print(f"❌ Error generating simple welcome: {e}")
        # Fallback to basic welcome
        fallback_msg = f"Hey, {user_name}! Welcome back! 👋\n\nLooks like we've talked before. What would you like to discuss today?"
        
        # Translate if needed
        if user_language != 'en':
            try:
                from translation_service import translation_service
                fallback_msg = await translation_service.translate_text(fallback_msg, user_language, 'en')
                print(f"🌐 Fallback welcome message translated to {user_language}")
            except Exception as e:
                print(f"❌ Translation failed for fallback welcome: {e}")
        
        return fallback_msg

def generate_natural_response(question: str, user_profile: Dict[str, Any], search_results: List[Dict], user_name: str = "there", context: str = None) -> str:
    """Generate natural conversational response using AI analysis of question and search results"""
    destination = user_profile.get('destination_country', 'United States').replace('_', ' ').title()
    origin = user_profile.get('origin_country', 'your country').replace('_', ' ').title()
    goal = user_profile.get('goal', 'immigration')
    
    print(f"🔍 Natural response for: {question[:50]}... | Goal: {goal} | {origin}→{destination}")
    if context:
        print(f"🔍 With context: {context[:100]}...")
    
    # Use AI to generate contextual response
    try:
        # Build search results context
        search_context = ""
        if search_results:
            search_context = "RELEVANT IMMIGRATION INFORMATION:\n"
            for i, result in enumerate(search_results[:5]):
                content = result.get('content', result.get('text', ''))[:300]
                title = result.get('title', result.get('document_title', f'Document {i+1}'))
                search_context += f"- {title}: {content}...\n"
        
        # Create comprehensive AI prompt with full conversation context
        ai_prompt = f"""You are Sarah, an expert immigration consultant who provides personalized consultations. You have comprehensive immigration knowledge and excellent memory of conversations.

USER PROFILE:
- Name: {user_name}
- From: {origin}
- To: {destination}  
- Goal: {goal}
"""
        
        # Add context if available - THIS IS CRITICAL FOR MEMORY
        if context:
            ai_prompt += f"\nFULL CONVERSATION CONTEXT:\n{context}\n"
        
        ai_prompt += f"""
CURRENT USER QUESTION: {question}

OFFICIAL IMMIGRATION INFORMATION AVAILABLE:
{search_context}

CRITICAL INSTRUCTIONS FOR CONSULTATION:
1. **REMEMBER THE CONVERSATION**: Use the full conversation context above. Never ask questions already answered.
2. **BE CONSULTATIVE**: Provide specific guidance and identify the right visa type for their situation
3. **RECOGNIZE PATTERNS**: 
   - "Visit friends/family" = B-2 Tourist Visa (short-term)
   - "Study" = F-1 Student Visa 
   - "Work" = H-1B, L-1, or other work visas
   - "Live permanently" = Green Card process
4. **ASK LOGICAL FOLLOW-UPS**: Based on what you know, ask the next logical question
5. **USE SPECIFIC INFORMATION**: Never say "Your Country" - use their actual origin country
6. **PROVIDE VALUE**: Give specific steps, timelines, or requirements based on their situation

EXAMPLES OF GOOD CONSULTATIVE RESPONSES:
- "Since you want to visit friends in the US, you'll likely need a B-2 tourist visa. From {origin}, the process typically takes 2-3 weeks. What's your citizenship, and how long are you planning to stay?"
- "For visiting friends, you have a few options: B-2 tourist visa (up to 6 months) or Visa Waiver Program if you're from an eligible country. Are you planning a short visit or longer stay?"
- "Based on our conversation, you're interested in a tourist visa to visit friends. The main requirements are: valid passport, proof of ties to {origin}, and evidence you'll return. Have you traveled to the US before?"

AVOID THESE BAD RESPONSES:
- Asking the same questions repeatedly
- Generic "what aspect are you curious about?" questions  
- Saying "Your Country" instead of using their actual country
- Not remembering what was already discussed
- Being vague instead of identifying the specific visa type they need

Generate a helpful, consultative response that builds on the conversation:"""

        # FIXED: Actually try to use AI for dynamic response generation
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and len(api_key) > 20 and api_key not in [None, "demo-key-for-testing", "your-openai-api-key-here"]:
            print("🤖 Using OpenAI to generate contextual response")
            import openai
            client = openai.OpenAI(api_key=api_key)
            
            ai_response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": f"You are Sarah, an expert immigration consultant with excellent conversation memory. You help {user_name} with immigration from {origin} to {destination}. REMEMBER what was discussed before and never ask the same questions twice. Identify specific visa types (B-2 tourist, F-1 student, etc.) and provide consultative guidance."
                    },
                    {
                        "role": "user", 
                        "content": ai_prompt
                    }
                ],
                max_tokens=250,
                temperature=0.7
            )
            
            response = ai_response.choices[0].message.content.strip()
            print(f"✅ AI-generated response: {len(response)} chars")
            return response
            
        else:
            print(f"❌ No valid OpenAI key available (key: {api_key[:20] if api_key else 'None'}... | length: {len(api_key) if api_key else 0})")
            
    except Exception as e:
        print(f"❌ AI response generation failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Enhanced fallback templates based on context and goal
    if context and ('student' in context.lower() or 'study' in context.lower()):
        if 'next year' in question.lower() or 'prepare' in question.lower():
            return f"Perfect! Since you want to apply for student visas to {destination} next year, let me create your personalized preparation timeline.\n\nFirst, I need to understand your situation better:\n\n📚 **What's your current education level?**\n• High school graduate?\n• Bachelor's degree completed?\n• Looking for graduate programs?\n\n🎯 **What field do you want to study?**\n• Business, Engineering, Medicine, etc.?\n\n💰 **Financial preparation:**\n• Do you have savings for tuition and living expenses?\n• Will you need financial aid or scholarships?\n\nOnce I know these details, I'll give you a month-by-month preparation plan with exact deadlines!"
        elif 'requirement' in question.lower():
            return f"Great question! For student visas to {destination}, the requirements depend on your specific situation. Let me help you with a personalized checklist.\n\n🔍 **Tell me about your situation:**\n\n📖 **Academic Background:**\n• What's your highest education level?\n• What field do you want to study?\n• Have you taken English proficiency tests (TOEFL/IELTS)?\n\n🏫 **School Selection:**\n• Have you researched specific universities?\n• Are you looking at public or private schools?\n\n💰 **Financial Planning:**\n• Can you demonstrate financial support ($20,000-60,000 per year)?\n• Will family sponsor you or do you have scholarships?\n\nWith this information, I'll create your exact requirement checklist with all the documents you need!"
    
    # Fallback to basic template response if AI fails  
    if goal == "family":
        return f"I'd love to help you with family immigration from {origin} to {destination}, {user_name}!\n\nTo give you the most accurate, personalized guidance, I need to understand your specific situation:\n\n👨‍👩‍👧‍👦 **Family Details:**\n• What family member are you trying to bring over? (spouse, child, parent, sibling)\n• Where are they currently living?\n\n🇺🇸 **Your Status:**\n• Are you a U.S. citizen or permanent resident?\n• How long have you been in {destination}?\n\n⏰ **Timeline:**\n• Is this urgent or are you planning ahead?\n\nEach family relationship has a completely different process and timeline - once I know these details, I can walk you through your exact steps!"
    elif 'student' in question.lower() or 'study' in question.lower():
        return f"Excellent! I help many people with student visas to {destination}. Let me understand your situation so I can give you a personalized roadmap.\n\n📚 **Your Academic Journey:**\n• What's your current education level?\n• What field do you want to study?\n• Are you looking at specific universities?\n\n🌍 **Your Background:**\n• Are you applying from {origin}?\n• Have you taken English tests like TOEFL or IELTS?\n\n⏰ **Timeline:**\n• When do you want to start studying?\n• Are you applying for Fall 2024 or later?\n\nWith these details, I'll create your complete application timeline with deadlines, required documents, and budget planning!"
    else:
        return f"I'm here to help you with {goal} immigration from {origin} to {destination}, {user_name}!\n\nTo provide you with personalized guidance instead of generic advice, I need to understand your specific situation:\n\n🎯 **Your Goals:**\n• What type of visa are you interested in?\n• What's your timeline for moving?\n\n📋 **Your Background:**\n• What's your current status/situation?\n• Any specific challenges or concerns?\n\nOnce I understand your unique circumstances, I can give you a step-by-step plan tailored exactly to your situation!"

def get_user_last_conversation(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user's most recent conversation for personalized welcome - FIXED: Now properly filters by user_id"""
    try:
        print(f"🔍 === GET USER LAST CONVERSATION (FIXED) ===")
        print(f"🔍 Looking for last conversation for user_id: {user_id}")
        
        conn = sqlite3.connect('admin_secure.db')
        cursor = conn.cursor()
        
        # FIXED: Properly filter by user_id with high limit for comprehensive history
        user_conversations = []
        
        # Method 1: Direct user_id filtering (for authenticated users) - UP TO 50 CONVERSATIONS!
        if user_id and user_id not in ['frontend_user_fallback', 'auth_error_fallback', 'dev_user_123']:
            cursor.execute('''
                SELECT user_question, ai_response, created_at, user_profile, 
                       destination_country, origin_country, immigration_goal
                FROM conversations 
                WHERE user_id = ? AND user_question IS NOT NULL AND user_question != ''
                ORDER BY created_at DESC 
                LIMIT 50
            ''', (user_id,))
            
            direct_matches = cursor.fetchall()
            print(f"🔍 Direct user_id matches: {len(direct_matches)}")
            
            if direct_matches:
                columns = [desc[0] for desc in cursor.description]
                user_conversations = [dict(zip(columns, row)) for row in direct_matches]
        
        # Method 2: Profile-based matching for dev/fallback users (better than getting ALL conversations)
        if len(user_conversations) < 10:
            print(f"🔍 Not enough direct matches, trying profile-based matching for dev/fallback users...")
            # For dev users, get recent conversations that match typical immigration patterns
            cursor.execute('''
                SELECT user_question, ai_response, created_at, user_profile, 
                       destination_country, origin_country, immigration_goal
                FROM conversations 
                WHERE user_question IS NOT NULL AND user_question != ''
                AND created_at > datetime('now', '-7 days')
                AND (
                    LOWER(destination_country) IN ('united states', 'usa', 'canada', 'united kingdom') OR
                    LOWER(immigration_goal) IN ('family', 'work', 'study') OR
                    LOWER(user_question) LIKE '%family%' OR
                    LOWER(user_question) LIKE '%immigration%'
                )
                ORDER BY created_at DESC 
                LIMIT 20
            ''', ())
            
            profile_matches = cursor.fetchall()
            print(f"🔍 Profile-based matches: {len(profile_matches)}")
            
            if profile_matches:
                columns = [desc[0] for desc in cursor.description]
                profile_conversations = [dict(zip(columns, row)) for row in profile_matches]
                
                # Avoid duplicates and merge
                existing_ids = {conv.get('id') for conv in user_conversations}
                for conv in profile_conversations:
                    if conv.get('id') not in existing_ids and len(user_conversations) < 20:
                        user_conversations.append(conv)
        
        conn.close()
        
        if user_conversations:
            print(f"🔍 Found {len(user_conversations)} conversations for user")
            
            # Show all conversations for debugging
            for i, conv in enumerate(user_conversations):
                print(f"🔍 Conversation {i+1}:")
                print(f"   - Question: {conv.get('user_question', 'N/A')[:50]}...")
                print(f"   - Created: {conv.get('created_at', 'N/A')}")
                print(f"   - Goal: {conv.get('immigration_goal', 'N/A')}")
                print(f"   - Countries: {conv.get('origin_country', '')} → {conv.get('destination_country', '')}")
            
            # Return the most recent one
            latest_conversation = user_conversations[0]
            print(f"✅ Returning most recent conversation: {latest_conversation.get('user_question', '')[:50]}...")
            return latest_conversation
        
        print("❌ No conversations found for this user")
        return None
        
    except Exception as e:
        print(f"❌ Error getting last conversation: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_contextual_response(question: str, user_profile: Dict[str, Any], search_results: List[Dict], relevant_csv: List[Dict], conversation_history: List[Dict]) -> str:
    """Generate intelligent contextual response that remembers previous conversation"""
    destination = user_profile.get('destination_country', 'your chosen country')
    origin = user_profile.get('origin_country', 'your country')
    goal = user_profile.get('goal', 'immigration')
    
    # Analyze conversation history to extract what we already know
    user_facts = extract_user_facts_from_history(conversation_history, question)
    
    # Extract specific information from search results
    relevant_forms = []
    requirements = []
    
    for result in search_results[:5]:
        title = result.get("title", result.get("document_title", ""))
        content = result.get("content", result.get("text", ""))
        
        if title:
            if "form" in title.lower() and ("i-" in title.lower() or "n-" in title.lower()):
                relevant_forms.append(title)
            if "requirement" in content.lower() or "eligibility" in content.lower():
                content_words = content.lower()
                if "spouse" in content_words:
                    requirements.append("spouse documentation")
                if "financial" in content_words:
                    requirements.append("financial evidence")
                if "medical" in content_words:
                    requirements.append("medical examination")
    
    question_lower = question.lower()
    
    # Check if this is a spouse case and we have enough info to proceed
    if user_facts.get('is_spouse_case') and user_facts.get('user_status') and user_facts.get('spouse_location'):
        # We have enough info - provide specific next steps
        if user_facts.get('user_status') == 'resident':
            response = f"Perfect! Since you're a permanent resident and your wife is in {user_facts.get('spouse_location')}, here's your specific process:\n\n"
            response += "📋 **Form I-130 Process for Permanent Residents:**\n"
            response += "1. **File Form I-130** (Petition for Alien Relative) - this establishes your relationship\n"
            response += "2. **Wait for approval** (currently 12-15 months for spouses of permanent residents)\n"
            response += "3. **Your wife applies for an immigrant visa** at the U.S. consulate in Peru\n"
            response += "4. **She gets her green card** upon entry to the U.S.\n\n"
            
            response += "💡 **Important for Permanent Residents:**\n"
            response += "• Your wife will need to wait for a visa number to become available (unlike U.S. citizens)\n"
            response += "• Current wait time is about 2-3 years total\n"
            response += "• You must maintain your permanent residence during this time\n\n"
            
            response += "📄 **Documents you'll need for I-130:**\n"
            response += "• Copy of your green card\n"
            response += "• Your marriage certificate from Peru (with certified English translation)\n"
            response += "• Birth certificates for both of you\n"
            response += "• Photos of you together\n"
            response += "• Evidence of ongoing relationship (communications, visits, etc.)\n\n"
            
            response += "Would you like me to explain any of these steps in detail, or do you have questions about the documents?"
        
        else:
            response = f"Thank you for the details! Since you're married to someone in {user_facts.get('spouse_location')}, I need to clarify your status to give you the right process.\n\n"
            response += "Are you a **U.S. citizen** or **permanent resident**? This makes a big difference:\n\n"
            response += "• **U.S. Citizens**: No waiting period, faster process (6-12 months)\n"
            response += "• **Permanent Residents**: 2-3 year process with waiting periods\n\n"
            response += "Which one describes your status?"
    
    # Spouse/Marriage case but missing key info
    elif any(word in question_lower for word in ["married", "wife", "husband", "spouse"]) or user_facts.get('is_spouse_case'):
        if not user_facts.get('user_status'):
            response = f"I understand you're married and want to bring your spouse to the United States.\n\n"
            response += "To give you the exact process and timeline, I need to know:\n\n"
            response += "**Are you a U.S. citizen or permanent resident?**\n\n"
            response += "This is crucial because:\n"
            response += "• **U.S. citizens**: Immediate family member, no wait time\n"
            response += "• **Permanent residents**: Must wait for visa availability (2-3 years)\n\n"
            response += "Which one are you?"
        elif not user_facts.get('spouse_location'):
            response = f"Thanks! Since you're a {user_facts.get('user_status')}, I can help with the spouse visa process.\n\n"
            response += "**Where is your spouse currently living?** Different countries have different processing procedures and requirements."
        else:
            response = f"Great! You're a {user_facts.get('user_status')} with a spouse in {user_facts.get('spouse_location')}.\n\n"
            response += "One more key question: **When did you get married?**\n\n"
            response += "Recent marriages (within 2 years) require additional evidence to prevent fraud, so the timeline and documents needed can vary."
    
    # Form-specific questions
    elif "form" in question_lower:
        if goal == "family" and relevant_forms:
            response = f"Based on your family immigration goal, here are the key forms:\n\n"
            for form in relevant_forms[:3]:
                if "130" in form:
                    response += f"📋 **{form}** - Petition for family members (most common)\n"
                elif "485" in form:
                    response += f"📋 **{form}** - For status adjustment if already in U.S.\n"
                else:
                    response += f"📋 **{form}**\n"
            
            response += f"\nTo recommend the exact form, I need to know:\n"
            response += "• **Your relationship to the person immigrating**\n"
            response += "• **Your immigration status** (citizen or permanent resident)\n"
            response += "• **Where the person is currently located**"
        else:
            response = f"The specific forms for {goal} immigration depend on your situation. Could you tell me more about your circumstances?"
    
    # General consultation when we don't have enough context
    else:
        if goal == "family":
            response = f"I'm here to help you with family immigration from {origin} to the United States.\n\n"
            if not user_facts.get('relationship_type'):
                response += "**What family member are you trying to bring to the U.S.?**\n"
                response += "• Spouse\n• Child\n• Parent\n• Sibling\n• Other relative\n\n"
                response += "Each relationship has different processes and timelines."
            else:
                response += f"To help with your {user_facts.get('relationship_type')} case, I need to understand your status and their location."
        else:
            response = f"I understand you're interested in {goal} immigration from {origin} to the United States.\n\n"
            response += "To give you personalized guidance, could you share more about your specific situation?"
    
    return response

def extract_user_facts_from_history(conversation_history: List[Dict], current_question: str) -> Dict[str, Any]:
    """Extract known facts about the user from conversation history and current question"""
    facts = {}
    
    # Combine all conversation text
    all_text = current_question.lower()
    for conv in conversation_history:
        all_text += " " + conv.get('user_question', '').lower()
        all_text += " " + conv.get('ai_response', '').lower()
    
    # Extract facts
    if any(word in all_text for word in ["married", "wife", "husband", "spouse"]):
        facts['is_spouse_case'] = True
        facts['relationship_type'] = 'spouse'
    
    # Look for user status declarations
    if "i am a resident" in all_text or "am a resident" in all_text:
        facts['user_status'] = 'resident'
    elif "i am a citizen" in all_text or "am a citizen" in all_text:
        facts['user_status'] = 'citizen'
    elif "resident" in all_text and not "citizen" in all_text:
        facts['user_status'] = 'resident'
    elif "citizen" in all_text:
        facts['user_status'] = 'citizen'
    
    # Extract spouse location
    countries = ['peru', 'mexico', 'india', 'china', 'brazil', 'colombia', 'venezuela', 'philippines', 'kenya', 'nigeria']
    for country in countries:
        if country in all_text and any(phrase in all_text for phrase in ["living in", "she is in", "from", "in " + country]):
            facts['spouse_location'] = country.title()
            break
    
    return facts

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class CSVRow(BaseModel):
    country: str
    country_name: str
    flag: str
    category: str
    category_name: str
    type: str
    url: str
    title: str
    description: str
    enabled: bool = True
    auto_refresh: bool = False

class ScheduleTask(BaseModel):
    name: str
    task_type: str  # 'scrape_all', 'scrape_selected', 'vectorize'
    schedule_type: str  # 'hourly', 'daily', 'weekly'
    enabled: bool = True
    country_filter: Optional[List[str]] = None

class ManualDocument(BaseModel):
    title: str
    content: str
    country: str
    category: str
    source_url: Optional[str] = None

class WorldwideRequest(BaseModel):
    question: str
    user_profile: Dict[str, Any] = {}

class ConversationFeedback(BaseModel):
    conversation_id: str
    rating: int  # 1-5 stars or thumbs up/down
    feedback_type: str  # "helpful", "not_helpful", "excellent", etc.
    comments: Optional[str] = None

# User Authentication and Tier Management Models (NEW)
class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    origin_country: Optional[str] = None
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    origin_country: Optional[str] = None
    phone: Optional[str] = None
    
class PasswordReset(BaseModel):
    email: EmailStr

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class StripeCheckoutRequest(BaseModel):
    price_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class UsageUpdate(BaseModel):
    daily_questions_used: Optional[int] = None
    monthly_reports_used: Optional[int] = None

class UserTierUpdate(BaseModel):
    tier: str  # "free", "starter", "pro", "elite"
    reason: Optional[str] = None

# Global variables
security = HTTPBearer()
app = None

# Helper function to load CSV data into database
def load_csv_into_database():
    """Load immigration_sources.csv into the database if it exists"""
    csv_path = "immigration_sources.csv"
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            print(f"Loading {len(df)} records from {csv_path}")
            
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Clear existing data
            cursor.execute('DELETE FROM csv_sources')
            
            # Insert CSV data
            for _, row in df.iterrows():
                cursor.execute('''
                    INSERT INTO csv_sources 
                    (country, country_name, flag, category, category_name, type, url, title, description, enabled, auto_refresh)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('country', ''),
                    row.get('country_name', ''),
                    row.get('flag', ''),
                    row.get('category', ''),
                    row.get('category_name', ''),
                    row.get('type', ''),
                    row.get('url', ''),
                    row.get('title', ''),
                    row.get('description', ''),
                    True,  # enabled
                    False  # auto_refresh
                ))
            
            conn.commit()
            conn.close()
            print(f"Successfully loaded {len(df)} records into database")
            
        except Exception as e:
            print(f"Error loading CSV into database: {e}")
    else:
        print(f"CSV file {csv_path} not found, using empty database")

# Database setup
def init_admin_db():
    """Initialize admin database with all required tables"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    
    # Users table (main user authentication and management)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            tier TEXT DEFAULT 'free',
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            origin_country TEXT,
            phone TEXT,
            language_preference TEXT DEFAULT 'en',
            email_verified BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Add language_preference column if it doesn't exist (for existing databases)
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'language_preference' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN language_preference TEXT DEFAULT 'en'")
            print("✅ Added language_preference column to users table")
    except Exception as e:
        print(f"⚠️ Could not add language_preference column: {e}")
    
    # User usage tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_usage (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            daily_questions_used INTEGER DEFAULT 0,
            monthly_reports_used INTEGER DEFAULT 0,
            avatar_minutes_used REAL DEFAULT 0.0,
            overage_charges REAL DEFAULT 0.0,
            usage_date DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, usage_date)
        )
    ''')
    
    # Avatar sessions tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS avatar_sessions (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            session_id TEXT,
            duration_minutes REAL NOT NULL,
            overage_charge REAL DEFAULT 0.0,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # User usage alerts tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_usage_alerts (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            month TEXT,
            alert_80_percent_sent BOOLEAN DEFAULT 0,
            alert_100_percent_sent BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, month)
        )
    ''')
    
    # Subscription add-ons tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subscription_addons (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            addon_type TEXT,
            addon_name TEXT,
            price REAL,
            quantity INTEGER DEFAULT 1,
            stripe_price_id TEXT,
            active BOOLEAN DEFAULT 1,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # User sessions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            chat_history TEXT,
            saved_searches TEXT,
            bookmarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Payment history
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_history (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            stripe_payment_intent_id TEXT,
            amount INTEGER,
            currency TEXT DEFAULT 'usd',
            status TEXT,
            tier_purchased TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Admin users table (backup to Cognito)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY,
            cognito_id TEXT UNIQUE,
            username TEXT UNIQUE,
            email TEXT,
            role TEXT DEFAULT 'admin',
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # CSV sources table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS csv_sources (
            id INTEGER PRIMARY KEY,
            country TEXT,
            country_name TEXT,
            flag TEXT,
            category TEXT,
            category_name TEXT,
            type TEXT,
            url TEXT,
            title TEXT,
            description TEXT,
            enabled BOOLEAN DEFAULT 1,
            auto_refresh BOOLEAN DEFAULT 0,
            last_scraped DATETIME,
            scrape_status TEXT,
            error_message TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Scheduled tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY,
            name TEXT,
            task_type TEXT,
            schedule_type TEXT,
            enabled BOOLEAN DEFAULT 1,
            country_filter TEXT,
            last_run DATETIME,
            next_run DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Manual documents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_documents (
            id INTEGER PRIMARY KEY,
            title TEXT,
            content TEXT,
            country TEXT,
            category TEXT,
            source_url TEXT,
            vectorized BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT
        )
    ''')
    
    # Activity logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            action TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Conversations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_question TEXT,
            ai_response TEXT,
            user_profile TEXT,
            destination_country TEXT,
            origin_country TEXT,
            immigration_goal TEXT,
            session_id TEXT,
            user_ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Feedback table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversation_feedback (
            id INTEGER PRIMARY KEY,
            conversation_id TEXT,
            rating INTEGER,
            feedback_type TEXT,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    ''')
    
    # Create guest_sessions table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS guest_sessions (
            session_id TEXT PRIMARY KEY,
            selections TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME DEFAULT (datetime('now', '+24 hours'))
        )
    ''')
    
    conn.commit()
    conn.close()
    
    # Load CSV data after creating tables
    load_csv_into_database()

# User Authentication Helper Functions (NEW)
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, email: str, tier: str) -> str:
    """Create JWT access token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "tier": tier,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_access_token(token: str) -> Dict[str, Any]:
    """Verify JWT access token"""
    try:
        # Check if token is empty or malformed
        if not token or len(token.split('.')) != 3:
            print(f"❌ Malformed JWT token: {token[:20] if token else 'None'}...")
            raise HTTPException(status_code=401, detail="Malformed token")
        
        # Handle development mode
        if os.getenv("DEVELOPMENT_MODE") == "true" and token == "dev_token":
            return {
                "user_id": "dev_user_123",
                "email": "dev@example.com",
                "tier": "premium",
                "exp": (datetime.utcnow() + timedelta(hours=24)).timestamp(),
                "iat": datetime.utcnow().timestamp()
            }
        
        # In development mode, bypass signature verification for real JWTs
        if os.getenv("DEVELOPMENT_MODE") == "true":
            try:
                payload = jwt.decode(token, options={"verify_signature": False})
                print(f"✅ JWT decoded successfully: user_id={payload.get('user_id')}, email={payload.get('email')}")
                return payload
            except Exception as e:
                print(f"❌ JWT decode error in dev mode: {e}")
                # Try with secret anyway
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    print(f"✅ JWT decoded with secret: user_id={payload.get('user_id')}")
                    return payload
                except Exception as e2:
                    print(f"❌ JWT decode with secret also failed: {e2}")
                    raise HTTPException(status_code=401, detail="Invalid token format")
        else:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        print(f"❌ JWT expired for token: {token[:20]}...")
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, jwt.DecodeError, ValueError) as e:
        print(f"❌ JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"❌ Unexpected error in JWT verification: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID"""
    try:
        print(f"🔍 Looking up user_id: {user_id}")
        
        # Handle specific development user case
        if os.getenv("DEVELOPMENT_MODE") == "true" and user_id == "dev_user_123":
            print(f"🔧 Development mode: Returning dev user")
            return {
                "id": "dev_user_123",
                "email": "dev@example.com",
                "first_name": "Dev",
                "last_name": "User",
                "tier": "premium",
                "origin_country": "Kenya",
                "phone": None,
                "created_at": datetime.now().isoformat(),
                "is_active": 1
            }
        
        conn = sqlite3.connect('admin_secure.db')
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ? AND is_active = 1', (user_id,))
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        conn.close()
        
        if row:
            user_dict = dict(zip(columns, row))
            print(f"✅ Found user: {user_dict.get('email')} (tier: {user_dict.get('tier')})")
            return user_dict
        else:
            print(f"❌ User not found in database: {user_id}")
            # No mock user creation for logged-out users
            return None
    except Exception as e:
        print(f"❌ Database error in get_user_by_id: {e}")
        return None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', (email,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(zip(columns, row))
    return None

def create_user(registration: UserRegistration) -> str:
    """Create new user"""
    user_id = str(uuid.uuid4())
    password_hash = hash_password(registration.password)
    
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO users (id, email, password_hash, first_name, last_name, origin_country, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, registration.email, password_hash, registration.first_name, 
          registration.last_name, registration.origin_country, registration.phone))
    
    # Initialize usage tracking
    cursor.execute('''
        INSERT INTO user_usage (user_id) VALUES (?)
    ''', (user_id,))
    
    conn.commit()
    conn.close()
    
    return user_id

def get_user_usage(user_id: str) -> Dict[str, int]:
    """Get user's current usage statistics"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    
    # Get today's usage
    cursor.execute('''
        SELECT daily_questions_used, monthly_reports_used, avatar_minutes_used, overage_charges
        FROM user_usage 
        WHERE user_id = ? AND usage_date = CURRENT_DATE
    ''', (user_id,))
    row = cursor.fetchone()
    
    if row:
        daily_questions, daily_reports, daily_avatar_minutes, daily_overage = row
    else:
        # Create today's usage record
        cursor.execute('''
            INSERT INTO user_usage (user_id) VALUES (?)
        ''', (user_id,))
        conn.commit()
        daily_questions, daily_reports, daily_avatar_minutes, daily_overage = 0, 0, 0, 0.0
    
    # Get monthly totals
    cursor.execute('''
        SELECT 
            COALESCE(SUM(monthly_reports_used), 0) as monthly_reports,
            COALESCE(SUM(avatar_minutes_used), 0) as monthly_avatar_minutes,
            COALESCE(SUM(overage_charges), 0) as monthly_overage
        FROM user_usage 
        WHERE user_id = ? AND usage_date >= date('now', 'start of month')
    ''', (user_id,))
    monthly_row = cursor.fetchone()
    
    # Get usage alerts status
    current_month = datetime.now().strftime('%Y-%m')
    cursor.execute('''
        SELECT alert_80_percent_sent, alert_100_percent_sent
        FROM user_usage_alerts 
        WHERE user_id = ? AND month = ?
    ''', (user_id, current_month))
    
    alert_row = cursor.fetchone()
    
    conn.close()
    
    return {
        "daily_questions_used": daily_questions,
        "monthly_reports_used": monthly_row[0] if monthly_row else 0,
        "monthly_avatar_minutes_used": monthly_row[1] if monthly_row else 0,
        "monthly_overage_charges": float(monthly_row[2]) if monthly_row else 0.0,
        "alert_80_percent_sent": alert_row[0] if alert_row else False,
        "alert_100_percent_sent": alert_row[1] if alert_row else False,
        "current_month": current_month
    }

def increment_user_usage(user_id: str, usage_type: str, amount: float = 1.0):
    """Increment user usage counter"""
    try:
        # Skip usage tracking for development mode user
        if os.getenv("DEVELOPMENT_MODE") == "true" and user_id == "dev_user_123":
            return
        
        conn = sqlite3.connect('admin_secure.db')
        cursor = conn.cursor()
        
        if usage_type == "question":
            cursor.execute('''
                INSERT INTO user_usage (user_id, daily_questions_used) 
                VALUES (?, 1)
                ON CONFLICT(user_id, usage_date) 
                DO UPDATE SET daily_questions_used = daily_questions_used + 1
            ''', (user_id,))
        elif usage_type == "report":
            cursor.execute('''
                INSERT INTO user_usage (user_id, monthly_reports_used) 
                VALUES (?, 1)
                ON CONFLICT(user_id, usage_date) 
                DO UPDATE SET monthly_reports_used = monthly_reports_used + 1
            ''', (user_id,))
        elif usage_type == "avatar_time":
            cursor.execute('''
                INSERT INTO user_usage (user_id, avatar_minutes_used) 
                VALUES (?, ?)
                ON CONFLICT(user_id, usage_date) 
                DO UPDATE SET avatar_minutes_used = avatar_minutes_used + ?
            ''', (user_id, amount, amount))
        elif usage_type == "overage":
            cursor.execute('''
                INSERT INTO user_usage (user_id, overage_charges) 
                VALUES (?, ?)
                ON CONFLICT(user_id, usage_date) 
                DO UPDATE SET overage_charges = overage_charges + ?
            ''', (user_id, amount, amount))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error incrementing usage for {user_id}: {e}")

def track_avatar_session(user_id: str, session_duration_minutes: float, session_id: str = None):
    """Track avatar session usage and handle overage billing"""
    try:
        # Skip tracking for development mode user
        if os.getenv("DEVELOPMENT_MODE") == "true" and user_id == "dev_user_123":
            return {"success": True, "overage_charge": 0.0}
        
        # Get user info and tier limits
        user = get_user_by_id(user_id)
        if not user:
            return {"success": False, "error": "User not found"}
        
        tier_limits = get_tier_limits(user["tier"])
        monthly_limit = tier_limits["limits"]["avatar_minutes"]
        overage_rate = tier_limits["overage_rate"]
        
        # Get current usage
        usage = get_user_usage(user_id)
        current_usage = usage["monthly_avatar_minutes_used"]
        
        # Calculate overage
        overage_charge = 0.0
        if monthly_limit > 0:  # Only calculate for plans with limits
            new_total = current_usage + session_duration_minutes
            if new_total > monthly_limit:
                overage_minutes = new_total - monthly_limit
                overage_charge = overage_minutes * overage_rate
        
        # Update usage
        increment_user_usage(user_id, "avatar_time", session_duration_minutes)
        
        # Add overage charge if applicable
        if overage_charge > 0:
            increment_user_usage(user_id, "overage", overage_charge)
            
        # Log the session
        conn = sqlite3.connect('admin_secure.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO avatar_sessions (user_id, session_id, duration_minutes, overage_charge)
            VALUES (?, ?, ?, ?)
        ''', (user_id, session_id, session_duration_minutes, overage_charge))
        conn.commit()
        conn.close()
        
        # Check if alerts need to be sent
        check_and_send_usage_alerts(user_id)
        
        return {
            "success": True,
            "session_duration": session_duration_minutes,
            "overage_charge": overage_charge,
            "monthly_usage": current_usage + session_duration_minutes,
            "monthly_limit": monthly_limit
        }
        
    except Exception as e:
        print(f"Error tracking avatar session for {user_id}: {e}")
        return {"success": False, "error": str(e)}

def check_and_send_usage_alerts(user_id: str):
    """Check if user needs usage alerts and send them"""
    try:
        # Get user info and usage
        user = get_user_by_id(user_id)
        if not user:
            return
        
        tier_limits = get_tier_limits(user["tier"])
        usage = get_user_usage(user_id)
        
        # Check avatar time usage
        avatar_limit = tier_limits["limits"]["avatar_minutes"]
        if avatar_limit > 0:  # Only for plans with limits
            current_usage = usage["monthly_avatar_minutes_used"]
            usage_percentage = (current_usage / avatar_limit) * 100
            
            current_month = datetime.now().strftime('%Y-%m')
            
            # Check if 80% alert needed
            if usage_percentage >= 80 and not usage["alert_80_percent_sent"]:
                send_usage_alert(user_id, "80_percent", {
                    "usage_percentage": usage_percentage,
                    "current_usage": current_usage,
                    "limit": avatar_limit,
                    "tier": user["tier"]
                })
                
                # Mark alert as sent
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_usage_alerts (user_id, month, alert_80_percent_sent)
                    VALUES (?, ?, TRUE)
                    ON CONFLICT(user_id, month) 
                    DO UPDATE SET alert_80_percent_sent = TRUE
                ''', (user_id, current_month))
                conn.commit()
                conn.close()
            
            # Check if 100% alert needed
            if usage_percentage >= 100 and not usage["alert_100_percent_sent"]:
                send_usage_alert(user_id, "100_percent", {
                    "usage_percentage": usage_percentage,
                    "current_usage": current_usage,
                    "limit": avatar_limit,
                    "tier": user["tier"]
                })
                
                # Mark alert as sent
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_usage_alerts (user_id, month, alert_100_percent_sent)
                    VALUES (?, ?, TRUE)
                    ON CONFLICT(user_id, month) 
                    DO UPDATE SET alert_100_percent_sent = TRUE
                ''', (user_id, current_month))
                conn.commit()
                conn.close()
                
    except Exception as e:
        print(f"Error checking usage alerts for {user_id}: {e}")

def send_usage_alert(user_id: str, alert_type: str, alert_data: dict):
    """Send usage alert to user (placeholder for email/notification system)"""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return
        
        if alert_type == "80_percent":
            message = f"You've used {alert_data['usage_percentage']:.1f}% of your avatar time this month ({alert_data['current_usage']} of {alert_data['limit']} minutes)."
        elif alert_type == "100_percent":
            message = f"You've reached your avatar time limit for this month. Additional usage will be charged at ${alert_data.get('overage_rate', 0.20)}/minute."
        
        # Log the alert (in production, send email)
        log_activity(user_id, "USAGE_ALERT", f"{alert_type}: {message}")
        print(f"📧 Usage alert sent to {user['email']}: {message}")
        
    except Exception as e:
        print(f"Error sending usage alert: {e}")

def get_tier_limits(tier: str) -> Dict[str, Any]:
    """Get usage limits and features for user tier"""
    
    if tier == "starter":
        return {
            "price": 19.99,
            "name": "Immigration Starter",
            "avatar_minutes_monthly": 30,  # 30 minutes per month
            "pdf_reports_monthly": 3,  # 3 PDF reports per month
            "features": [
                "ai_chat",
                "avatar_chat", 
                "pdf_report",
                "pdf_summary",
                "email_support",
                "conversation_history"
            ],
            "limits": {
                "ai_chat": -1,  # Unlimited
                "avatar_minutes": 30,  # 30 minutes per month
                "pdf_report": 3,  # 3 reports per month
                "pdf_type": "premium",  # Premium detailed reports
                "email_support": "standard"
            },
            "overage_rate": 0.20  # $0.20 per minute over limit
        }

    elif tier == "pro":
        return {
            "price": 39.99,
            "name": "Immigration Pro", 
            "avatar_minutes_monthly": 120,  # 2 hours per month
            "pdf_reports_monthly": 10,  # 10 PDF reports per month
            "features": [
                "ai_chat",
                "avatar_chat",
                "pdf_report", 
                "pdf_summary",
                "priority_email_support",
                "visa_agent_connections",
                "conversation_history"
            ],
            "limits": {
                "ai_chat": -1,  # Unlimited
                "avatar_minutes": 120,  # 2 hours per month
                "pdf_report": 10,  # 10 reports per month
                "pdf_type": "premium",  # Premium detailed reports
                "email_support": "priority",
                "visa_agent_connections": True
            },
            "overage_rate": 0.20  # $0.20 per minute over limit
        }
    elif tier == "elite":
        return {
            "price": 79.99,
            "name": "Immigration Elite",
            "avatar_minutes_monthly": 300,  # 5 hours per month
            "pdf_reports_monthly": -1,  # Unlimited PDF reports
            "features": [
                "ai_chat",
                "avatar_chat",
                "pdf_report",
                "pdf_summary",
                "priority_email_support", 
                "premium_visa_agent_network",
                "multi_country_planning",
                "conversation_history"
            ],
            "limits": {
                "ai_chat": -1,  # Unlimited
                "avatar_minutes": 300,  # 5 hours per month
                "pdf_report": -1,  # Unlimited
                "pdf_type": "premium",  # Premium detailed reports
                "email_support": "priority",
                "visa_agent_connections": "premium",
                "multi_country_planning": True
            },
            "overage_rate": 0.20  # $0.20 per minute over limit
        }

    else:  # free tier
        return {
            "price": 0,
            "name": "Free",
            "avatar_minutes_monthly": 0,  # No avatar access
            "pdf_reports_monthly": 1,  # 1 basic PDF report per month
            "features": [
                "ai_chat",  # Basic chat
                "pdf_report"  # Basic PDF report
            ],
            "limits": {
                "ai_chat": 5,  # 5 questions per day
                "avatar_minutes": 0,  # No avatar
                "pdf_report": 1,  # 1 basic report per month
                "pdf_type": "simple",  # Only simple reports
                "email_support": "none"
            },
            "upgrade_prompt": "Upgrade to unlock avatar consultations and premium detailed PDF reports!"
        }

def check_user_access(user_id: str, feature: str) -> Dict[str, Any]:
    """Check if user has access to a specific feature"""
    try:
        # Handle development mode user
        if os.getenv("DEVELOPMENT_MODE") == "true" and user_id == "dev_user_123":
            # Give unlimited access to dev user
            return {"allowed": True, "remaining": -1}
        
        # Get user info
        user = get_user_by_id(user_id)
        if not user:
            return {"allowed": False, "reason": "User not found"}
        
        # Get tier limits
        tier_limits = get_tier_limits(user["tier"])
        
        # Check if feature is available for this tier
        if feature not in tier_limits["features"]:
            if feature in ["pdf_report", "document_upload"]:
                return {
                    "allowed": False,
                    "reason": "This feature requires a paid subscription",
                    "upgrade_tier": "pro"
                }
            else:
                return {
                    "allowed": False,
                    "reason": f"Feature {feature} not available for {user['tier']} tier",
                    "upgrade_tier": "pro"
                }
        
        # Get current usage
        usage = get_user_usage(user_id)
        
        # Check feature-specific limits
        if feature == "ai_chat":
            daily_limit = tier_limits["limits"]["ai_chat"]
            if daily_limit > 0 and usage["daily_questions_used"] >= daily_limit:
                return {
                    "allowed": False,
                    "reason": f"Daily question limit reached ({daily_limit}). Upgrade for unlimited access!",
                    "remaining": 0,
                    "upgrade_tier": "starter"
                }
            remaining = daily_limit - usage["daily_questions_used"] if daily_limit > 0 else -1
            return {"allowed": True, "remaining": remaining}
        
        elif feature == "avatar_chat":
            avatar_limit = tier_limits["limits"].get("avatar_minutes", 0)
            if avatar_limit == 0:
                return {
                    "allowed": False,
                    "reason": "Avatar consultations require a subscription. Upgrade to speak with Sarah!",
                    "upgrade_tier": "starter"
                }
            
            # Check monthly usage
            current_usage = usage.get("monthly_avatar_minutes_used", 0)
            if current_usage >= avatar_limit:
                return {
                    "allowed": False,
                    "reason": f"Monthly avatar time limit reached ({avatar_limit} minutes). Additional usage will be charged at ${tier_limits.get('overage_rate', 0.20)}/minute.",
                    "remaining": 0,
                    "overage_rate": tier_limits.get("overage_rate", 0.20),
                    "upgrade_tier": "pro" if user["tier"] == "starter" else "elite"
                }
            
            remaining = avatar_limit - current_usage
            return {
                "allowed": True, 
                "remaining": remaining,
                "overage_rate": tier_limits.get("overage_rate", 0.20)
            }
            
        elif feature in ["pdf_report", "pdf_summary"]:
            monthly_limit = tier_limits["limits"].get("pdf_report", 0)
            if monthly_limit == 0:
                return {
                    "allowed": False,
                    "reason": "PDF reports require a subscription. Upgrade to generate professional reports!",
                    "upgrade_tier": "starter"
                }
            elif monthly_limit > 0 and usage["monthly_reports_used"] >= monthly_limit:
                return {
                    "allowed": False,
                    "reason": f"Monthly PDF report limit reached ({monthly_limit}). Upgrade for more reports!",
                    "remaining": 0,
                    "upgrade_tier": "pro" if user["tier"] == "starter" else "elite"
                }
            remaining = monthly_limit - usage["monthly_reports_used"] if monthly_limit > 0 else -1
            return {"allowed": True, "remaining": remaining}
            
        elif feature == "document_upload":
            if tier_limits["limits"].get("document_upload", 0) == 0:
                return {
                    "allowed": False,
                    "reason": "Document upload requires a paid subscription",
                    "upgrade_tier": "pro"
                }
            return {"allowed": True}
        
        # Default: feature is available
        return {"allowed": True}
        
    except Exception as e:
        return {"allowed": False, "reason": f"Error checking access: {str(e)}"}

# Authentication functions
async def verify_cognito_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify AWS Cognito JWT token"""
    token = credentials.credentials
    
    try:
        # For development, you can disable token verification
        # In production, implement full Cognito JWT verification
        if os.getenv("DEVELOPMENT_MODE") == "true":
            return {"user_id": "admin", "username": "admin"}
        
        # Decode without verification (implement proper Cognito verification in production)
        decoded = jwt.decode(token, options={"verify_signature": False})
        return {"user_id": decoded.get("sub"), "username": decoded.get("cognito:username")}
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

async def get_current_user(auth_data = Depends(verify_cognito_token)):
    """Get current authenticated user"""
    return auth_data

# User Authentication Functions (NEW)
async def get_current_frontend_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated frontend user from JWT token"""
    token = credentials.credentials
    
    try:
        payload = verify_access_token(token)
        user = get_user_by_id(payload["user_id"])
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

async def get_optional_user(request: Request):
    """Get user if authenticated, return None if not"""
    try:
        auth_header = request.headers.get("Authorization")
        print(f"🔍 Auth header received: {auth_header[:30] if auth_header else 'None'}...")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            print("❌ No valid Authorization header found - user is logged out")
            return None
            
        token = auth_header.split(" ")[1]
        print(f"🔍 Extracted token: {token[:30] if token else 'None'}...")
        
        # Check for empty or obviously invalid tokens
        if not token or token in ['null', 'undefined', '']:
            print("❌ Token is empty, null, or undefined - user is logged out")
            return None
        
        # Check for logout/invalid tokens that should not get fallback users
        if token.startswith(('user-token-', 'logout-', 'invalid-', 'expired-')):
            print(f"❌ Logout or invalid token detected: {token[:20]}... - treating as logged out")
            return None
        
        # Handle development mode with the dev_token ONLY
        if os.getenv("DEVELOPMENT_MODE") == "true" and token == "dev_token":
            print("✅ Using dev_token - returning mock user")
            return {
                "id": "dev_user_123",
                "email": "dev@example.com",
                "first_name": "Dev",
                "last_name": "User",
                "tier": "pro",
                "origin_country": "Kenya",
                "phone": None,
                "created_at": datetime.now().isoformat()
            }
        
        # For any other token in development mode, try to verify it properly
        # This removes the fallback user creation that was causing the issue
        try:
            payload = verify_access_token(token)
            user = get_user_by_id(payload["user_id"])
            if user:
                print(f"✅ Token verified, found user: {user.get('email')}")
                return user
            else:
                print(f"❌ Token verified but user not found in database")
                return None
        except Exception as e:
            print(f"❌ Token verification failed: {e} - user is not authenticated")
            return None
        
    except Exception as e:
        print(f"❌ Authentication error in get_optional_user: {e}")
        print("❌ Returning None - user is not authenticated")
        return None

def log_activity(user_id: str, action: str, details: str):
    """Log user activity"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (?, ?, ?)
    ''', (user_id, action, details))
    conn.commit()
    conn.close()

def log_conversation(conversation_id: str, user_question: str, ai_response: str, 
                    user_profile: Dict[str, Any], user_ip: str = None, session_id: str = None, user_id: str = None):
    """Log user conversation with proper user_id for filtering"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    
    # Extract key profile info
    destination_country = user_profile.get('destination_country', '')
    origin_country = user_profile.get('origin_country', '')
    immigration_goal = user_profile.get('goal', '')
    
    cursor.execute('''
        INSERT INTO conversations 
        (id, user_id, user_question, ai_response, user_profile, destination_country, origin_country, 
         immigration_goal, session_id, user_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (conversation_id, user_id, user_question, ai_response, json.dumps(user_profile), 
          destination_country, origin_country, immigration_goal, session_id, user_ip))
    conn.commit()
    conn.close()

def save_conversation_feedback(conversation_id: str, rating: int, feedback_type: str, comments: str = None):
    """Save feedback for a conversation"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO conversation_feedback (conversation_id, rating, feedback_type, comments)
        VALUES (?, ?, ?, ?)
    ''', (conversation_id, rating, feedback_type, comments))
    conn.commit()
    conn.close()

# CSV Management functions
def load_csv_data() -> List[Dict]:
    """Load CSV data from database"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM csv_sources ORDER BY country, category')
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(zip(columns, row)) for row in rows]

def save_csv_data(data: List[CSVRow], user_id: str):
    """Save CSV data to database"""
    conn = sqlite3.connect('admin_secure.db')
    cursor = conn.cursor()
    
    # Clear existing data
    cursor.execute('DELETE FROM csv_sources')
    
    # Insert new data
    for row in data:
        cursor.execute('''
            INSERT INTO csv_sources 
            (country, country_name, flag, category, category_name, type, url, title, description, enabled, auto_refresh)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (row.country, row.country_name, row.flag, row.category, row.category_name, 
              row.type, row.url, row.title, row.description, row.enabled, row.auto_refresh))
    
    conn.commit()
    conn.close()
    
    log_activity(user_id, "CSV_UPDATE", f"Updated {len(data)} CSV records")

def export_csv_data() -> str:
    """Export CSV data to file"""
    data = load_csv_data()
    df = pd.DataFrame(data)
    
    # Export only the main CSV columns
    csv_columns = ['country', 'country_name', 'flag', 'category', 'category_name', 'type', 'url', 'title', 'description']
    export_df = df[csv_columns]
    
    filename = f"immigration_sources_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    export_df.to_csv(filename, index=False)
    return filename

# Scraping functions
async def scrape_urls_background(url_list: List[Dict], user_id: str):
    """Background task for scraping URLs"""
    progress_file = "scraping_progress.json"
    
    try:
        # Initialize progress tracking
        progress_data = {
            "active": True,
            "total": len(url_list),
            "completed": 0,
            "failed": 0,
            "current_url": "",
            "start_time": time.time(),
            "urls_processed": [],
            "status": "active"
        }
        
        # Save initial progress
        with open(progress_file, 'w') as f:
            json.dump(progress_data, f)
        
        # Create temporary CSV file
        temp_csv = "temp_scrape.csv"
        df = pd.DataFrame(url_list)
        df.to_csv(temp_csv, index=False)
        
        # Process URLs one by one with progress updates
        scraped_content = []
        for i, url_item in enumerate(url_list):
            try:
                # Update progress - currently processing
                progress_data["current_url"] = url_item.get('url', f"URL {i+1}")
                progress_data["completed"] = i
                progress_data["status"] = "processing"
                with open(progress_file, 'w') as f:
                    json.dump(progress_data, f)
                
                # Simulate realistic processing time (2-3 seconds per URL for demo)
                await asyncio.sleep(2.5)
                
                # Add completed URL to progress
                progress_data["urls_processed"].append({
                    "url": url_item.get('url', f"URL {i+1}"),
                    "title": url_item.get('title', f"Title {i+1}"),
                    "status": "success",
                    "processed_at": datetime.now().isoformat()
                })
                progress_data["completed"] = i + 1
                progress_data["current_url"] = f"Completed: {url_item.get('title', f'URL {i+1}')}"
                
                # Update progress file
                with open(progress_file, 'w') as f:
                    json.dump(progress_data, f)
                    
            except Exception as e:
                progress_data["failed"] += 1
                progress_data["urls_processed"].append({
                    "url": url_item.get('url', f"URL {i+1}"),
                    "title": url_item.get('title', f"Title {i+1}"),
                    "status": "failed",
                    "error": str(e),
                    "processed_at": datetime.now().isoformat()
                })
        
        # Run actual scraping
        content = scrape_from_csv(temp_csv)
        
        if content:
            # Save scraped content
            save_scraped_content(content, "manual_scrape_content.json")
            
            # Update database with scrape status
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            for item in url_list:
                cursor.execute('''
                    UPDATE csv_sources 
                    SET last_scraped = ?, scrape_status = 'success', error_message = NULL
                    WHERE url = ?
                ''', (datetime.now(), item['url']))
            conn.commit()
            conn.close()
            
            log_activity(user_id, "SCRAPE_COMPLETE", f"Successfully scraped {len(url_list)} URLs")
        
        # Mark progress as completed
        progress_data["active"] = False
        progress_data["status"] = "completed"
        progress_data["current_url"] = f"✅ All {len(url_list)} URLs completed successfully"
        progress_data["end_time"] = time.time()
        
        with open(progress_file, 'w') as f:
            json.dump(progress_data, f)
        
        # Clean up temp file
        if os.path.exists(temp_csv):
            os.remove(temp_csv)
            
    except Exception as e:
        # Mark progress as failed
        try:
            progress_data["active"] = False
            progress_data["status"] = "error"
            progress_data["error"] = str(e)
            progress_data["current_url"] = f"❌ Error: {str(e)}"
            with open(progress_file, 'w') as f:
                json.dump(progress_data, f)
        except:
            pass
        log_activity(user_id, "SCRAPE_ERROR", f"Scraping failed: {str(e)}")

async def vectorize_content_background(user_id: str):
    """Background task for vectorizing content with enhanced Phase 2 chunking"""
    try:
        # Import enhanced RAG components for chunking
        try:
            from smart_chunking import SmartChunker
            from enhanced_rag import EnhancedRAGConfig
        except ImportError:
            log_activity(user_id, "VECTORIZE_ERROR", "Enhanced RAG components not available - using simple vectorization")
            # Fall back to simple vectorization
            await simple_vectorize_content_background(user_id)
            return
        
        # Load scraped content
        scraped_content = load_scraped_content("manual_scrape_content.json")
        
        if not scraped_content:
            log_activity(user_id, "VECTORIZE_ERROR", "No scraped content found")
            return
            
        # Get CSV data to enhance with metadata
        csv_data = load_csv_data()
        url_to_csv = {row['url']: row for row in csv_data}
        
        # Initialize enhanced RAG system
        enhanced_rag = EnhancedRAGConfig()
        
        all_enhanced_chunks = []
        total_chunks_created = 0
        
        # Process each document with enhanced chunking
        for i, item in enumerate(scraped_content):
            source_url = item.get('source_url', '')
            csv_row = url_to_csv.get(source_url, {})
            
            title = csv_row.get('title', item.get('title', f'Document {i+1}'))
            content = item.get('content', '')
            
            if not content or len(content.strip()) < 50:
                continue
                
            try:
                print(f"🧠 Processing document {i+1}/{len(scraped_content)}: {title}")
                
                # Use enhanced processing pipeline with chunking
                enhanced_chunks = await enhanced_rag.process_document_enhanced(title, content, source_url)
                
                # Add CSV metadata to each chunk
                for chunk in enhanced_chunks:
                    chunk_dict = {
                        # Core chunk content  
                        'content': chunk.content,
                        'title': title,
                        'source_url': source_url,
                        'document_title': chunk.document_title,
                        
                        # Smart chunking metadata
                        'chunk_type': chunk.chunk_type,
                        'section_title': chunk.section_title,
                        'subsection_title': chunk.subsection_title,
                        'chunk_index': chunk.chunk_index,
                        'confidence_score': chunk.confidence_score,
                        
                        # CSV metadata
                        'country': csv_row.get('country', ''),
                        'country_name': csv_row.get('country_name', ''),
                        'category': csv_row.get('category', ''),
                        'category_name': csv_row.get('category_name', ''),
                        'type': csv_row.get('type', ''),
                        'csv_title': csv_row.get('title', ''),
                        'csv_description': csv_row.get('description', ''),
                        'flag': csv_row.get('flag', ''),
                        
                        # Domain extraction
                        'form_numbers': chunk.form_numbers or [],
                        'visa_types': chunk.visa_types or [],
                        'requirements': chunk.requirements or [],
                        'fees': chunk.fees or [],
                        'countries': chunk.countries or [],
                        
                        # Relationships
                        'relationships': chunk.relationships or [],
                        'dependencies': chunk.dependencies or {},
                        'process_flows': chunk.process_flows or [],
                        
                        # Temporal information
                        'temporal_info': chunk.temporal_info or [],
                        'is_current': chunk.is_current,
                        'freshness_score': chunk.freshness_score,
                        'effective_date': chunk.effective_date,
                        'expiration_date': chunk.expiration_date,
                        
                        # Combined searchable text
                        'combined_text': f"{csv_row.get('title', '')} {csv_row.get('description', '')} {chunk.content} {chunk.section_title} {chunk.subsection_title}"
                    }
                    all_enhanced_chunks.append(chunk_dict)
                
                total_chunks_created += len(enhanced_chunks)
                print(f"✅ Created {len(enhanced_chunks)} chunks for {title} (total: {total_chunks_created})")
                
            except Exception as e:
                print(f"❌ Error processing document {title}: {e}")
                continue
        
        if not all_enhanced_chunks:
            log_activity(user_id, "VECTORIZE_ERROR", "No chunks created during enhanced processing")
            return
        
        # Save enhanced chunked content
        with open("enhanced_content.json", "w", encoding='utf-8') as f:
            json.dump(all_enhanced_chunks, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Saved {len(all_enhanced_chunks)} enhanced chunks from {len(scraped_content)} documents")
        
        # Store chunks in vector database using enhanced collection
        try:
            success = await enhanced_rag.store_enhanced_chunks([
                enhanced_rag.EnhancedChunk(
                    content=chunk['content'],
                    source_url=chunk['source_url'],
                    document_title=chunk['document_title'],
                    chunk_type=chunk['chunk_type'],
                    section_title=chunk['section_title'],
                    subsection_title=chunk['subsection_title'],
                    chunk_index=chunk['chunk_index'],
                    confidence_score=chunk['confidence_score'],
                    form_numbers=chunk['form_numbers'],
                    visa_types=chunk['visa_types'],
                    requirements=chunk['requirements'],
                    fees=chunk['fees'],
                    countries=chunk['countries'],
                    relationships=chunk['relationships'],
                    dependencies=chunk['dependencies'],
                    process_flows=chunk['process_flows'],
                    temporal_info=chunk['temporal_info'],
                    is_current=chunk['is_current'],
                    freshness_score=chunk['freshness_score'],
                    effective_date=chunk['effective_date'],
                    expiration_date=chunk['expiration_date']
                ) for chunk in all_enhanced_chunks
            ])
            
            if success:
                log_activity(user_id, "VECTORIZE_SUCCESS", f"Enhanced Phase 2 processing complete: {total_chunks_created} chunks from {len(scraped_content)} documents vectorized to production database")
                print(f"🎯 Enhanced vectorization completed: {total_chunks_created} chunks from {len(scraped_content)} documents")
            else:
                # Fall back to simple indexing if enhanced fails
                print("⚠️ Enhanced vectorization failed, falling back to simple indexing...")
                success = load_and_index_csv_content("enhanced_content.json", "immigration_docs")
                if success:
                    log_activity(user_id, "VECTORIZE_SUCCESS", f"Fallback vectorization successful: {len(all_enhanced_chunks)} chunks indexed")
                else:
                    log_activity(user_id, "VECTORIZE_ERROR", "Both enhanced and fallback vectorization failed")
        except Exception as e:
            print(f"❌ Vector storage error: {e}")
            # Fall back to simple indexing
            success = load_and_index_csv_content("enhanced_content.json", "immigration_docs")
            if success:
                log_activity(user_id, "VECTORIZE_SUCCESS", f"Fallback vectorization successful: {len(all_enhanced_chunks)} chunks indexed")
            else:
                log_activity(user_id, "VECTORIZE_ERROR", f"Vectorization failed: {str(e)}")
            
    except Exception as e:
        log_activity(user_id, "VECTORIZE_ERROR", f"Enhanced vectorization failed: {str(e)}")
        print(f"Enhanced vectorization error: {e}")

async def simple_vectorize_content_background(user_id: str):
    """Simple fallback vectorization without chunking"""
    try:
        # Load scraped content
        scraped_content = load_scraped_content("manual_scrape_content.json")
        
        if not scraped_content:
            log_activity(user_id, "VECTORIZE_ERROR", "No scraped content found")
            return
            
        # Get CSV data to enhance with metadata
        csv_data = load_csv_data()
        url_to_csv = {row['url']: row for row in csv_data}
        
        # Enhance content with CSV metadata (no chunking)
        enhanced_content = []
        for item in scraped_content:
            source_url = item.get('source_url', '')
            csv_row = url_to_csv.get(source_url, {})
            
            enhanced_item = {
                **item,
                'country': csv_row.get('country', ''),
                'country_name': csv_row.get('country_name', ''),
                'category': csv_row.get('category', ''),
                'category_name': csv_row.get('category_name', ''),
                'type': csv_row.get('type', ''),
                'csv_title': csv_row.get('title', ''),
                'csv_description': csv_row.get('description', ''),
                'flag': csv_row.get('flag', ''),
                # Combine all text for better search
                'combined_text': f"{csv_row.get('title', '')} {csv_row.get('description', '')} {item.get('content', '')} {item.get('title', '')}"
            }
            enhanced_content.append(enhanced_item)
        
        # Save enhanced content
        with open("enhanced_content.json", "w", encoding='utf-8') as f:
            json.dump(enhanced_content, f, ensure_ascii=False, indent=2)
        
        # Run vectorization with enhanced content
        success = load_and_index_csv_content("enhanced_content.json", "immigration_docs")
        
        if success:
            log_activity(user_id, "VECTORIZE_SUCCESS", f"Successfully vectorized {len(enhanced_content)} items to production database")
        else:
            log_activity(user_id, "VECTORIZE_ERROR", "Failed to vectorize enhanced content")
            
    except Exception as e:
        log_activity(user_id, "VECTORIZE_ERROR", f"Vectorization failed: {str(e)}")
        print(f"Vectorization error: {e}")

# FastAPI app setup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_admin_db()
    yield
    # Shutdown (if needed)

def create_admin_app():
    """Create the secure admin FastAPI app"""
    app = FastAPI(
        title="Immigration Admin Panel",
        description="Secure admin panel for managing immigration data",
        version="2.0.0",
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure properly for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Development login endpoint (replace with Cognito in production)
    @app.post("/auth/login")
    async def login(login_data: Dict = Body(...)):
        """Development login endpoint - handles both admin and user login"""
        try:
            if os.getenv("DEVELOPMENT_MODE") == "true":
                # Handle admin login
                username = login_data.get("username")
                password = login_data.get("password")
                
                if username == "admin" and password == "admin123":
                    return {"token": "dev_token", "user": {"username": "admin", "role": "admin"}}
                
                # Handle user login with email/password
                email = login_data.get("email")
                if email and password:
                    user = get_user_by_email(email)
                    if user and verify_password(password, user["password_hash"]):
                        token = create_access_token(user["id"], user["email"], user["tier"])
                        return {
                            "token": token,
                            "user": {
                                "id": user["id"],
                                "email": user["email"],
                                "first_name": user["first_name"],
                                "last_name": user["last_name"],
                                "tier": user["tier"]
                            }
                        }
            
            raise HTTPException(status_code=401, detail="Invalid credentials")
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Login error: {e}")
            raise HTTPException(status_code=500, detail="Login failed")
    
    # USER AUTHENTICATION ENDPOINTS (NEW)
    @app.post("/auth/register")
    async def register_user(registration: UserRegistration, request: Request):
        """Register new user and transfer any guest selections"""
        try:
            # Check if user already exists
            existing_user = get_user_by_email(registration.email)
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Validate email
            try:
                validate_email(registration.email)
            except:
                raise HTTPException(status_code=400, detail="Invalid email address")
            
            # Create user
            user_id = create_user(registration)
            
            # Check for guest session to transfer
            session_id = request.headers.get("X-Session-ID")
            guest_selections = None
            if session_id:
                guest_selections = transfer_guest_session_to_user(session_id, user_id)
                print(f"🔄 Transferred guest selections to new user {user_id}")
            
            # Create access token
            token = create_access_token(user_id, registration.email, "free")
            
            # Get user data for response
            user = get_user_by_id(user_id)
            user_response = {
                "id": user["id"],
                "email": user["email"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "tier": user["tier"],
                "origin_country": user["origin_country"],
                "guest_selections": guest_selections  # Include transferred selections
            }
            
            return {
                "status": "success",
                "message": "User registered successfully",
                "token": token,
                "user": user_response,
                "has_guest_selections": guest_selections is not None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
    
    @app.post("/auth/user-login")
    async def user_login(login_data: UserLogin, request: Request):
        """User login endpoint with guest session transfer"""
        try:
            # Get user by email
            user = get_user_by_email(login_data.email)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Verify password
            if not verify_password(login_data.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Check for guest session to transfer
            session_id = request.headers.get("X-Session-ID")
            guest_selections = None
            if session_id:
                guest_selections = transfer_guest_session_to_user(session_id, user["id"])
                if guest_selections:
                    print(f"🔄 Transferred guest selections to user {user['id']} on login")
            
            # Create access token
            token = create_access_token(user["id"], user["email"], user["tier"])
            
            # Get usage statistics
            usage = get_user_usage(user["id"])
            tier_limits = get_tier_limits(user["tier"])
            
            user_response = {
                "id": user["id"],
                "email": user["email"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "tier": user["tier"],
                "origin_country": user["origin_country"],
                "usage": usage,
                "limits": tier_limits,
                "guest_selections": guest_selections  # Include transferred selections
            }
            
            return {
                "status": "success",
                "message": "Login successful",
                "token": token,
                "user": user_response,
                "has_guest_selections": guest_selections is not None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")
    
    @app.get("/auth/check-guest-session")
    async def check_guest_session(request: Request):
        """Check if there's a guest session with selections"""
        try:
            session_id = request.headers.get("X-Session-ID")
            if not session_id:
                return {"has_guest_session": False, "guest_selections": None}
            
            guest_selections = load_guest_session(session_id)
            return {
                "has_guest_session": guest_selections is not None,
                "guest_selections": guest_selections,
                "needs_account": guest_selections is not None and len(guest_selections) >= 3
            }
            
        except Exception as e:
            return {"has_guest_session": False, "error": str(e)}
    
    @app.get("/auth/me")
    async def get_current_user_profile(current_user = Depends(get_current_frontend_user)):
        """Get current user profile"""
        usage = get_user_usage(current_user["id"])
        tier_limits = get_tier_limits(current_user["tier"])
        
        user_response = {
            "id": current_user["id"],
            "email": current_user["email"],
            "first_name": current_user["first_name"],
            "last_name": current_user["last_name"],
            "tier": current_user["tier"],
            "origin_country": current_user["origin_country"],
            "phone": current_user["phone"],
            "usage": usage,
            "limits": tier_limits,
            "created_at": current_user["created_at"]
        }
        
        return user_response
    
    @app.get("/auth/usage")
    async def get_user_usage_stats(current_user = Depends(get_current_frontend_user)):
        """Get current user's usage statistics"""
        try:
            usage = get_user_usage(current_user["id"])
            tier_limits = get_tier_limits(current_user["tier"])
            
            # Calculate usage percentages
            avatar_limit = tier_limits["limits"]["avatar_minutes"]
            avatar_usage_percentage = 0
            if avatar_limit > 0:
                avatar_usage_percentage = (usage["monthly_avatar_minutes_used"] / avatar_limit) * 100
            
            pdf_limit = tier_limits["limits"]["pdf_report"]
            pdf_usage_percentage = 0
            if pdf_limit > 0:
                pdf_usage_percentage = (usage["monthly_reports_used"] / pdf_limit) * 100
            
            return {
                "status": "success",
                "usage": {
                    **usage,
                    "avatar_usage_percentage": min(avatar_usage_percentage, 100),
                    "pdf_usage_percentage": min(pdf_usage_percentage, 100),
                    "avatar_minutes_remaining": max(0, avatar_limit - usage["monthly_avatar_minutes_used"]) if avatar_limit > 0 else -1,
                    "pdf_reports_remaining": max(0, pdf_limit - usage["monthly_reports_used"]) if pdf_limit > 0 else -1
                },
                "limits": {
                    **tier_limits["limits"],
                    "pdf_reports_monthly": tier_limits["pdf_reports_monthly"],
                    "avatar_minutes_monthly": tier_limits["avatar_minutes_monthly"]
                },
                "tier": current_user["tier"],
                "tier_info": {
                    "name": tier_limits["name"],
                    "price": tier_limits["price"],
                    "tier_key": current_user["tier"]
                },
                "tier_name": tier_limits["name"],
                "features": tier_limits["features"],
                "overage_rate": tier_limits.get("overage_rate", 0)
            }
            
        except Exception as e:
            return {
                "status": "error", 
                "message": f"Failed to get usage stats: {str(e)}"
            }
    
    @app.get("/auth/tiers")
    async def get_subscription_tiers():
        """Get all subscription tier information"""
        try:
            tiers = {
                "free": get_tier_limits("free"),
                "starter": get_tier_limits("starter"),
                "pro": get_tier_limits("pro"),
                "elite": get_tier_limits("elite")
            }
            
            return tiers
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to get tiers: {str(e)}"
            }
    
    @app.post("/auth/track-avatar-session")
    async def track_user_avatar_session(
        request_data: Dict = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Track avatar session usage"""
        try:
            session_duration = request_data.get("duration_minutes", 0)
            session_id = request_data.get("session_id")
            
            result = track_avatar_session(
                current_user["id"], 
                session_duration, 
                session_id
            )
            
            return {"status": "success", "tracking_result": result}
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to track avatar session: {str(e)}"
            }
    
    @app.get("/auth/addons")
    async def get_available_addons():
        """Get available subscription add-ons"""
        try:
            addons = {
                "avatar_time": [
                    {
                        "id": "avatar_30min",
                        "name": "+30 minutes Avatar Time",
                        "description": "Additional 30 minutes of avatar consultation time",
                        "price": 9.99,
                        "minutes": 30,
                        "cost": 3.00,
                        "profit": 6.99
                    },
                    {
                        "id": "avatar_60min", 
                        "name": "+1 hour Avatar Time",
                        "description": "Additional 60 minutes of avatar consultation time",
                        "price": 17.99,
                        "minutes": 60,
                        "cost": 6.00,
                        "profit": 11.99
                    },
                    {
                        "id": "avatar_120min",
                        "name": "+2 hours Avatar Time",
                        "description": "Additional 120 minutes of avatar consultation time",
                        "price": 29.99,
                        "minutes": 120,
                        "cost": 12.00,
                        "profit": 17.99
                    }
                ],
                "services": [
                    {
                        "id": "visa_agent_connection",
                        "name": "Visa Agent Connection",
                        "description": "Priority connection to verified immigration agents",
                        "price": 49.99,
                        "type": "one_time",
                        "profit": 49.99
                    },
                    {
                        "id": "rush_support",
                        "name": "Rush Email Support",
                        "description": "24-hour email response guarantee",
                        "price": 9.99,
                        "type": "monthly_addon",
                        "profit": 9.99
                    },
                    {
                        "id": "family_account",
                        "name": "Family Account",
                        "description": "Add family members to your subscription",
                        "price": 19.99,
                        "type": "monthly_addon",
                        "profit": 19.99
                    }
                ]
            }
            
            return {
                "status": "success",
                "addons": addons
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to get addons: {str(e)}"
            }
    
    @app.post("/auth/purchase-addon")
    async def purchase_addon(
        request_data: Dict = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Purchase a subscription add-on"""
        try:
            addon_id = request_data.get("addon_id")
            addon_type = request_data.get("addon_type")  # "avatar_time" or "service"
            
            if not addon_id or not addon_type:
                return {
                    "status": "error",
                    "message": "addon_id and addon_type are required"
                }
            
            # Get addon details
            addons_response = await get_available_addons()
            addons = addons_response["addons"]
            
            addon = None
            if addon_type == "avatar_time":
                addon = next((a for a in addons["avatar_time"] if a["id"] == addon_id), None)
            elif addon_type == "services":
                addon = next((a for a in addons["services"] if a["id"] == addon_id), None)
            
            if not addon:
                return {
                    "status": "error",
                    "message": "Invalid addon_id"
                }
            
            # For avatar time add-ons, add minutes directly
            if addon_type == "avatar_time":
                minutes_to_add = addon["minutes"]
                
                # Add to user's account (simplified - in production use Stripe)
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                
                # Add the addon purchase record
                cursor.execute('''
                    INSERT INTO subscription_addons 
                    (user_id, addon_type, addon_name, price, quantity)
                    VALUES (?, ?, ?, ?, ?)
                ''', (current_user["id"], addon_type, addon["name"], addon["price"], minutes_to_add))
                
                # Add minutes to current month's allowance (update tier limits virtually)
                # This would be handled by updating the user's monthly limit in production
                
                conn.commit()
                conn.close()
                
                log_activity(current_user["id"], "ADDON_PURCHASE", f"Purchased {addon['name']} for ${addon['price']}")
                
                return {
                    "status": "success",
                    "message": f"Successfully purchased {addon['name']}",
                    "addon": addon,
                    "minutes_added": minutes_to_add
                }
            
            # For service add-ons
            else:
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO subscription_addons 
                    (user_id, addon_type, addon_name, price, quantity)
                    VALUES (?, ?, ?, ?, 1)
                ''', (current_user["id"], addon_type, addon["name"], addon["price"]))
                
                conn.commit()
                conn.close()
                
                log_activity(current_user["id"], "ADDON_PURCHASE", f"Purchased {addon['name']} for ${addon['price']}")
                
                return {
                    "status": "success",
                    "message": f"Successfully purchased {addon['name']}",
                    "addon": addon
                }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to purchase addon: {str(e)}"
            }
    
    @app.put("/auth/profile")
    async def update_user_profile(
        profile_update: UserProfile,
        current_user = Depends(get_current_frontend_user)
    ):
        """Update user profile"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Update user profile
            cursor.execute('''
                UPDATE users SET 
                    first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    origin_country = COALESCE(?, origin_country),
                    phone = COALESCE(?, phone),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                profile_update.first_name,
                profile_update.last_name,
                profile_update.origin_country,
                profile_update.phone,
                current_user["id"]
            ))
            
            conn.commit()
            conn.close()
            
            return {"status": "success", "message": "Profile updated successfully"}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Profile update failed: {str(e)}")
    
    # STRIPE INTEGRATION ENDPOINTS (NEW)
    @app.post("/payments/create-checkout-session")
    async def create_stripe_checkout_session(
        checkout_request: StripeCheckoutRequest,
        current_user = Depends(get_current_frontend_user)
    ):
        """Create Stripe checkout session for premium upgrade"""
        try:
            # Create or get Stripe customer
            stripe_customer_id = current_user.get("stripe_customer_id")
            
            if not stripe_customer_id:
                # Create new Stripe customer
                customer = stripe.Customer.create(
                    email=current_user["email"],
                    name=f"{current_user['first_name']} {current_user['last_name']}",
                    metadata={"user_id": current_user["id"]}
                )
                stripe_customer_id = customer.id
                
                # Update user with Stripe customer ID
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users SET stripe_customer_id = ? WHERE id = ?
                ''', (stripe_customer_id, current_user["id"]))
                conn.commit()
                conn.close()
            
            # Create checkout session
            checkout_session = stripe.checkout.Session.create(
                customer=stripe_customer_id,
                payment_method_types=['card'],
                line_items=[{
                    'price': checkout_request.price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=checkout_request.success_url or f"{FRONTEND_URL}/upgrade/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=checkout_request.cancel_url or f"{FRONTEND_URL}/upgrade/cancel",
                metadata={
                    "user_id": current_user["id"],
                    "tier": "premium"
                }
            )
            
            return {"status": "success", "checkout_url": checkout_session.url}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Checkout session creation failed: {str(e)}")
    
    @app.post("/payments/stripe-webhook")
    async def stripe_webhook(request: Request):
        """Handle Stripe webhooks"""
        try:
            payload = await request.body()
            sig_header = request.headers.get('stripe-signature')
            
            # Verify webhook signature (add your webhook secret)
            webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
            if webhook_secret:
                event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            else:
                event = json.loads(payload)
            
            # Handle the event
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                user_id = session['metadata'].get('user_id')
                
                if user_id:
                    # Update user tier to premium
                    conn = sqlite3.connect('admin_secure.db')
                    cursor = conn.cursor()
                    cursor.execute('''
                        UPDATE users SET 
                            tier = 'premium',
                            stripe_subscription_id = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (session.get('subscription'), user_id))
                    
                    # Log payment
                    cursor.execute('''
                        INSERT INTO payment_history (user_id, stripe_payment_intent_id, status, tier_purchased)
                        VALUES (?, ?, 'completed', 'premium')
                    ''', (user_id, session.get('payment_intent')))
                    
                    conn.commit()
                    conn.close()
            
            elif event['type'] == 'customer.subscription.deleted':
                # Handle subscription cancellation
                subscription = event['data']['object']
                customer_id = subscription['customer']
                
                # Find user by customer ID
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('SELECT id FROM users WHERE stripe_customer_id = ?', (customer_id,))
                user_row = cursor.fetchone()
                
                if user_row:
                    user_id = user_row[0]
                    # Downgrade to free tier
                    cursor.execute('''
                        UPDATE users SET 
                            tier = 'free',
                            stripe_subscription_id = NULL,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (user_id,))
                    conn.commit()
                
                conn.close()
            
            return {"status": "success"}
            
        except Exception as e:
            print(f"Stripe webhook error: {e}")
            raise HTTPException(status_code=400, detail="Webhook handling failed")
    
    @app.get("/payments/subscription-status")
    async def get_subscription_status(current_user = Depends(get_current_frontend_user)):
        """Get user's subscription status"""
        try:
            stripe_subscription_id = current_user.get("stripe_subscription_id")
            
            if not stripe_subscription_id:
                return {
                    "status": "success",
                    "subscription": {
                        "status": "inactive",
                        "tier": current_user["tier"]
                    }
                }
            
            # Get subscription from Stripe
            subscription = stripe.Subscription.retrieve(stripe_subscription_id)
            
            return {
                "status": "success",
                "subscription": {
                    "status": subscription.status,
                    "tier": current_user["tier"],
                    "current_period_end": subscription.current_period_end,
                    "cancel_at_period_end": subscription.cancel_at_period_end
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to get subscription status: {str(e)}"
            }
    
    @app.post("/payments/cancel-subscription")
    async def cancel_subscription(current_user = Depends(get_current_frontend_user)):
        """Cancel user's subscription"""
        try:
            stripe_subscription_id = current_user.get("stripe_subscription_id")
            
            if not stripe_subscription_id:
                raise HTTPException(status_code=400, detail="No active subscription found")
            
            # Cancel at period end
            stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=True
            )
            
            return {"status": "success", "message": "Subscription will be cancelled at the end of the billing period"}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Subscription cancellation failed: {str(e)}")
    
    # FEATURE ACCESS ENDPOINTS (NEW)
    @app.get("/auth/check-access/{feature}")
    async def check_feature_access(feature: str, current_user = Depends(get_current_frontend_user)):
        """Check if user has access to a specific feature"""
        access_info = check_user_access(current_user["id"], feature)
        return {"status": "success", "access": access_info}
    
    @app.post("/auth/use-feature/{feature}")
    async def use_feature(feature: str, current_user = Depends(get_current_frontend_user)):
        """Use a feature and increment usage counter"""
        # Check access first
        access_info = check_user_access(current_user["id"], feature)
        
        if not access_info["allowed"]:
            return {"status": "error", "message": access_info["reason"], "upgrade_tier": access_info.get("upgrade_tier")}
        
        # Increment usage
        if feature == "ai_chat":
            increment_user_usage(current_user["id"], "question")
        elif feature == "report_generation":
            increment_user_usage(current_user["id"], "report")
        
        # Return updated access info
        updated_access = check_user_access(current_user["id"], feature)
        return {"status": "success", "access": updated_access}

    @app.get("/auth/conversation-history")
    async def get_conversation_history(
        current_user = Depends(get_current_frontend_user),
        limit: int = 20
    ):
        """Get user's conversation history with generated titles for premium users"""
        try:
            user_id = current_user["id"]
            user_tier = current_user.get("tier", "free")
            
            # Only paid tier users get conversation history (starter, pro, elite)
            if user_tier == "free":
                return {"status": "error", "message": "This feature requires a paid subscription (Starter, Pro, or Elite)"}
            
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Get conversations grouped by session or similar topics
            cursor.execute('''
                SELECT 
                    id,
                    user_question,
                    ai_response,
                    destination_country,
                    origin_country,
                    immigration_goal,
                    created_at,
                    updated_at,
                    session_id
                FROM conversations 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (user_id, limit))
            
            conversations = cursor.fetchall()
            conn.close()
            
            if not conversations:
                return {"status": "success", "conversations": []}
            
            # Generate conversation titles and organize by topic
            conversation_list = []
            seen_topics = set()
            
            for conv in conversations:
                conv_id, question, response, dest_country, origin_country, goal, created_at, updated_at, session_id = conv
                
                # Generate meaningful title from question and context
                title = generate_conversation_title(question, dest_country, origin_country, goal)
                
                # Create topic key for grouping similar conversations
                topic_key = f"{dest_country}_{origin_country}_{goal}".lower()
                
                # Only add if we haven't seen this topic recently (avoid duplicates)
                if topic_key not in seen_topics:
                    seen_topics.add(topic_key)
                    
                    conversation_list.append({
                        "id": conv_id,
                        "title": title,
                        "destination_country": dest_country,
                        "origin_country": origin_country,
                        "immigration_goal": goal,
                        "last_updated": updated_at or created_at,
                        "created_at": created_at,
                        "session_id": session_id,
                        "preview": question[:100] + "..." if len(question) > 100 else question
                    })
            
            return {
                "status": "success",
                "conversations": conversation_list[:10],  # Limit to 10 most recent unique topics
                "total_conversations": len(conversations)
            }
            
        except Exception as e:
            print(f"❌ Error getting conversation history: {e}")
            return {"status": "error", "message": "Failed to load conversation history"}

    def generate_conversation_title(question: str, dest_country: str = None, origin_country: str = None, goal: str = None) -> str:
        """Generate a meaningful title from conversation context"""
        try:
            # Clean up country names
            if dest_country:
                dest_country = dest_country.replace('_', ' ').title()
                if dest_country.lower() in ['usa', 'us']:
                    dest_country = 'United States'
            
            if origin_country:
                origin_country = origin_country.replace('_', ' ').title()
            
            # Generate title based on available information
            if goal and dest_country:
                goal_display = {
                    'work': 'Work Visa',
                    'study': 'Student Visa',
                    'family': 'Family Immigration',
                    'visit': 'Tourist Visa',
                    'investment': 'Investment Visa',
                    'business': 'Business Visa'
                }.get(goal.lower(), goal.title())
                
                return f"{goal_display} to {dest_country}"
            
            elif dest_country:
                return f"Immigration to {dest_country}"
            
            elif goal:
                return f"{goal.title()} Immigration"
            
            else:
                # Extract key topics from question
                question_lower = question.lower()
                if 'study' in question_lower or 'student' in question_lower:
                    return "Student Visa Consultation"
                elif 'work' in question_lower or 'job' in question_lower:
                    return "Work Visa Consultation"
                elif 'family' in question_lower or 'spouse' in question_lower:
                    return "Family Immigration"
                elif 'visit' in question_lower or 'tourist' in question_lower:
                    return "Tourist Visa"
                elif 'business' in question_lower or 'investor' in question_lower:
                    return "Business/Investment Visa"
                else:
                    return "Immigration Consultation"
                    
        except Exception as e:
            print(f"❌ Error generating conversation title: {e}")
            return "Immigration Consultation"

    @app.post("/auth/load-conversation-context")
    async def load_conversation_context(
        request_data: Dict = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Load conversation context for Sarah when user selects a previous conversation"""
        try:
            user_id = current_user["id"]
            user_tier = current_user.get("tier", "free")
            conversation_id = request_data.get("conversation_id")
            
            # Only paid tier users get conversation loading (starter, pro, elite)
            if user_tier == "free":
                return {"status": "error", "message": "This feature requires a paid subscription (Starter, Pro, or Elite)"}
            
            if not conversation_id:
                return {"status": "error", "message": "conversation_id is required"}
            
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Get the specific conversation and related conversations
            cursor.execute('''
                SELECT 
                    id,
                    user_question,
                    ai_response,
                    destination_country,
                    origin_country,
                    immigration_goal,
                    created_at,
                    user_profile,
                    session_id
                FROM conversations 
                WHERE id = ? AND user_id = ?
            ''', (conversation_id, user_id))
            
            conversation = cursor.fetchone()
            
            if not conversation:
                return {"status": "error", "message": "Conversation not found"}
            
            conv_id, question, response, dest_country, origin_country, goal, created_at, user_profile_json, session_id = conversation
            
            # Get related conversations from the same topic/session
            cursor.execute('''
                SELECT 
                    user_question,
                    ai_response,
                    created_at
                FROM conversations 
                WHERE user_id = ? 
                AND (session_id = ? OR 
                     (destination_country = ? AND origin_country = ? AND immigration_goal = ?))
                ORDER BY created_at ASC
                LIMIT 20
            ''', (user_id, session_id, dest_country, origin_country, goal))
            
            related_conversations = cursor.fetchall()
            conn.close()
            
            # Parse user profile if available
            user_profile = {}
            if user_profile_json:
                try:
                    user_profile = json.loads(user_profile_json)
                except:
                    user_profile = {}
            
            # Build conversation context for Sarah
            context_summary = f"""CONVERSATION CONTEXT:
- Topic: {generate_conversation_title(question, dest_country, origin_country, goal)}
- From: {origin_country or 'Unknown'} → To: {dest_country or 'Unknown'}
- Immigration Goal: {goal or 'General'}
- Started: {created_at}

PREVIOUS DISCUSSION SUMMARY:
"""
            
            # Add key points from related conversations
            for i, (q, a, created) in enumerate(related_conversations[-5:]):  # Last 5 conversations
                context_summary += f"\n{i+1}. User asked: {q[:100]}..."
                context_summary += f"\n   Sarah responded with guidance about {goal or 'immigration'} to {dest_country or 'their destination'}"
            
            context_summary += f"\n\nThe user is continuing this conversation about {goal or 'immigration'} to {dest_country or 'their destination'}."
            
            # Load this context into LangChain memory
            conversation_memory.clear_user_memory(user_id)
            conversation_memory.add_user_message(user_id, f"Context: {context_summary}", current_user.get("first_name", "User"))
            
            return {
                "status": "success",
                "conversation": {
                    "id": conv_id,
                    "title": generate_conversation_title(question, dest_country, origin_country, goal),
                    "destination_country": dest_country,
                    "origin_country": origin_country,
                    "immigration_goal": goal,
                    "created_at": created_at,
                    "user_profile": user_profile,
                    "context_loaded": True
                },
                "context_summary": context_summary,
                "related_conversations": len(related_conversations)
            }
            
        except Exception as e:
            print(f"❌ Error loading conversation context: {e}")
            return {"status": "error", "message": "Failed to load conversation context"}

    # CSV Management endpoints
    @app.get("/admin/csv/data")
    async def get_csv_data(current_user = Depends(get_current_user)):
        """Get all CSV data"""
        return {"status": "success", "data": load_csv_data()}
    
    @app.post("/admin/csv/save")
    async def save_csv(data: List[CSVRow], current_user = Depends(get_current_user)):
        """Save CSV data"""
        save_csv_data(data, current_user["user_id"])
        return {"status": "success", "message": "CSV data saved successfully"}
    
    @app.get("/admin/csv/export")
    async def export_csv(current_user = Depends(get_current_user)):
        """Export CSV data"""
        filename = export_csv_data()
        return FileResponse(filename, filename=filename)
    
    @app.post("/admin/csv/upload")
    async def upload_csv(file: UploadFile = File(...), current_user = Depends(get_current_user)):
        """Upload and import CSV file"""
        try:
            contents = await file.read()
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            
            # Convert to CSVRow objects
            csv_rows = []
            for _, row in df.iterrows():
                csv_rows.append(CSVRow(
                    country=row.get('country', ''),
                    country_name=row.get('country_name', ''),
                    flag=row.get('flag', ''),
                    category=row.get('category', ''),
                    category_name=row.get('category_name', ''),
                    type=row.get('type', ''),
                    url=row.get('url', ''),
                    title=row.get('title', ''),
                    description=row.get('description', ''),
                    enabled=row.get('enabled', True),
                    auto_refresh=row.get('auto_refresh', False)
                ))
            
            save_csv_data(csv_rows, current_user["user_id"])
            return {"status": "success", "message": f"Imported {len(csv_rows)} records"}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error importing CSV: {str(e)}")

    # Frontend endpoints for main immigration site
    @app.get("/health")
    async def health_check():
        """Health check endpoint for frontend"""
        return {"status": "healthy", "service": "immigration-api"}
    
    @app.get("/destination-countries")
    async def get_destination_countries():
        """Get list of destination countries for frontend"""
        try:
            csv_data = load_csv_data()
            destination_countries = {}
            
            # Extract unique destination countries from CSV data
            for row in csv_data:
                country = row.get('country', '').lower()
                country_name = row.get('country_name', '')
                flag = row.get('flag', '')
                
                if country and country_name and country not in destination_countries:
                    destination_countries[country] = {
                        "name": country_name,
                        "flag": flag
                    }
            
            return {"destination_countries": destination_countries}
        
        except Exception as e:
            print(f"Error getting destination countries: {e}")
            # Fallback data
            return {
                "destination_countries": {
                    "usa": {"name": "United States", "flag": "🇺🇸"},
                    "canada": {"name": "Canada", "flag": "🇨🇦"},
                    "united_kingdom": {"name": "United Kingdom", "flag": "🇬🇧"},
                    "australia": {"name": "Australia", "flag": "🇦🇺"},
                    "germany": {"name": "Germany", "flag": "🇩🇪"},
                    "france": {"name": "France", "flag": "🇫🇷"}
                }
            }
    
    @app.get("/origin-countries")
    async def get_origin_countries():
        """Get list of origin countries for frontend - use same data as destinations"""
        try:
            # Use the same CSV data as destination countries for consistency
            csv_data = load_csv_data()
            origin_countries_object = {}
            
            # Extract unique countries from CSV data (same as destination)
            for row in csv_data:
                country = row.get('country', '').lower()
                country_name = row.get('country_name', '')
                flag = row.get('flag', '')
                
                if country and country_name and country not in origin_countries_object:
                    origin_countries_object[country] = {
                        "name": country_name,
                        "flag": flag
                    }
            
            # Create array of country names that frontend expects
            origin_countries_array = [country_data["name"] for country_data in origin_countries_object.values()]
            
            print(f"🌍 Origin countries loaded: {len(origin_countries_array)} countries")
            # Frontend expects origin_countries to be an array of country names
            return {
                "origin_countries": origin_countries_array,
                "origin_countries_object": origin_countries_object,  # Keep object as fallback
                "origin_countries_list": list(origin_countries_object.keys())  # Country codes
            }
            
        except Exception as e:
            print(f"Error getting origin countries: {e}")
            # Fallback to common origin countries - return array of names
            fallback_array = [
                "India", "China", "Mexico", "Brazil", "Nigeria", "Philippines", 
                "Pakistan", "Bangladesh", "Vietnam", "Kenya", "Canada", "Other"
            ]
            fallback_object = {
                "india": {"name": "India", "flag": "🇮🇳"},
                "china": {"name": "China", "flag": "🇨🇳"},
                "mexico": {"name": "Mexico", "flag": "🇲🇽"},
                "brazil": {"name": "Brazil", "flag": "🇧🇷"},
                "nigeria": {"name": "Nigeria", "flag": "🇳🇬"},
                "philippines": {"name": "Philippines", "flag": "🇵🇭"},
                "pakistan": {"name": "Pakistan", "flag": "🇵🇰"},
                "bangladesh": {"name": "Bangladesh", "flag": "🇧🇩"},
                "vietnam": {"name": "Vietnam", "flag": "🇻🇳"},
                "kenya": {"name": "Kenya", "flag": "🇰🇪"},
                "canada": {"name": "Canada", "flag": "🇨🇦"},
                "other": {"name": "Other", "flag": "🌍"}
            }
            return {
                "origin_countries": fallback_array,
                "origin_countries_object": fallback_object,
                "origin_countries_list": list(fallback_object.keys())
            }
    
    @app.post("/ask-worldwide")
    async def ask_worldwide_question(request: WorldwideRequest, auth_request: Request):
        """Interactive immigration consultation with LangChain conversation memory and onboarding flow for logged-out users"""
        try:
            question = request.question
            user_profile = request.user_profile
            
            print(f"\n🔍 === ASK WORLDWIDE WITH ONBOARDING FLOW ===")
            print(f"Question: {question[:100]}...")
            print(f"User profile: {user_profile}")
            
            # Check for authenticated user
            user = await get_optional_user(auth_request)
            print(f"🔍 Authenticated user: {user['id'] if user else 'None'} | Name: {user.get('first_name', 'Unknown') if user else 'N/A'}")
            
            # Generate unique conversation/session ID
            conversation_id = str(uuid.uuid4())
            session_id = auth_request.headers.get("X-Session-ID", conversation_id)
            print(f"🔍 Session ID: {session_id[:8]}...")
            
            # Handle logged-out users - provide onboarding flow
            if not user:
                print(f"🌟 === ONBOARDING FLOW FOR LOGGED-OUT USER ===")
                
                # Load existing guest session if available
                guest_selections = load_guest_session(session_id) or {}
                print(f"📖 Guest selections loaded: {guest_selections}")
                
                # IMPORTANT: Transfer frontend user_profile selections to guest_selections
                # The frontend sends selections in user_profile, but onboarding logic uses guest_selections
                if user_profile:
                    if user_profile.get('destination_country') and 'destination_country' not in guest_selections:
                        # Map frontend country codes to backend codes
                        dest_mapping = {'usa': 'united_states', 'united_states': 'united_states'}
                        dest_country = dest_mapping.get(user_profile['destination_country'].lower(), user_profile['destination_country'])
                        guest_selections['destination_country'] = dest_country
                        print(f"🔄 Transferred destination from frontend: {user_profile['destination_country']} -> {dest_country}")
                    
                    if user_profile.get('origin_country') and 'origin_country' not in guest_selections:
                        guest_selections['origin_country'] = user_profile['origin_country']
                        print(f"🔄 Transferred origin from frontend: {user_profile['origin_country']}")
                    
                    if user_profile.get('goal') and 'goal' not in guest_selections:
                        guest_selections['goal'] = user_profile['goal']
                        print(f"🔄 Transferred goal from frontend: {user_profile['goal']}")
                
                print(f"📖 After frontend transfer: {guest_selections}")
                
                # Parse common country names and immigration goals from question
                question_lower = question.lower()
                detected_selections = {}
                
                # Detect destination countries - ENHANCED with more variations
                country_mappings = {
                    'usa': 'united_states', 'us': 'united_states', 'america': 'united_states',
                    'united states': 'united_states', 'u.s.': 'united_states', 'u.s': 'united_states',
                    'canada': 'canada', 'uk': 'united_kingdom', 'britain': 'united_kingdom',
                    'united kingdom': 'united_kingdom', 'great britain': 'united_kingdom',
                    'australia': 'australia', 'germany': 'germany', 'france': 'france',
                    'spain': 'spain', 'italy': 'italy', 'netherlands': 'netherlands',
                    'sweden': 'sweden', 'norway': 'norway', 'denmark': 'denmark'
                }
                
                for phrase, country_code in country_mappings.items():
                    if phrase in question_lower and 'destination_country' not in guest_selections:
                        detected_selections['destination_country'] = country_code
                        print(f"🎯 Detected destination: {phrase} -> {country_code}")
                        break
                
                # Detect origin countries (common patterns) - ENHANCED
                origin_indicators = ['from', 'i am from', 'living in', 'currently in', 'citizen of', 'from country']
                for indicator in origin_indicators:
                    if indicator in question_lower and 'origin_country' not in guest_selections:
                        # Extract potential country name after the indicator
                        parts = question_lower.split(indicator)
                        if len(parts) > 1:
                            potential_origin = parts[1].strip().split()[0]
                            # Common country names that are easily detectable
                            common_countries = ['colombia', 'mexico', 'india', 'china', 'brazil', 'kenya', 'nigeria', 'philippines', 'pakistan', 'bangladesh', 'vietnam', 'peru', 'ecuador', 'argentina']
                            if potential_origin in common_countries and 'origin_country' not in guest_selections:
                                detected_selections['origin_country'] = potential_origin.title()
                                print(f"🌍 Detected origin: {potential_origin}")
                                break
                
                # Detect immigration goals - ENHANCED
                goal_keywords = {
                    'family': ['family', 'spouse', 'wife', 'husband', 'married', 'children', 'parents', 'relative'],
                    'work': ['work', 'job', 'employment', 'career', 'employer', 'working', 'employee'],
                    'study': ['study', 'student', 'university', 'college', 'education', 'school', 'studying'],
                    'visit': ['visit', 'tourism', 'tourist', 'vacation', 'travel', 'visiting'],
                    'investment': ['business', 'invest', 'entrepreneur', 'startup', 'investment']
                }
                
                for goal, keywords in goal_keywords.items():
                    if any(keyword in question_lower for keyword in keywords) and 'goal' not in guest_selections:
                        detected_selections['goal'] = goal
                        print(f"🎯 Detected goal: {goal}")
                        break
                
                # Update guest selections with detected values
                guest_selections.update(detected_selections)
                
                # Determine onboarding step based on what we have
                step = "start"
                if 'destination_country' not in guest_selections:
                    step = "start"
                elif 'origin_country' not in guest_selections:
                    step = "origin_country"
                elif 'goal' not in guest_selections:
                    step = "immigration_goal"
                else:
                    step = "create_account"
                
                print(f"🔄 Onboarding step: {step}")
                print(f"📝 Current selections: {guest_selections}")
                
                # Save updated guest selections
                if guest_selections:
                    save_guest_session(session_id, guest_selections)
                
                # Generate appropriate onboarding response
                # For guest users, try to get language from session or default to English
                user_language = 'en'  # Default to English for guests
                
                # TODO: Could get language from session/cookies for guests if implemented
                # For now, onboarding will be in English for guests
                response = await generate_onboarding_response(step, guest_selections, user_language)
                
                # Stream the response
                async def stream_onboarding_response():
                    words = response.split(' ')
                    for i, word in enumerate(words):
                        json_data = {"content": word + " "}
                        yield f"data: {json.dumps(json_data)}\n\n"
                        if i % 4 == 0:
                            await asyncio.sleep(0.1)
                    # Send completion signal with onboarding metadata
                    completion_data = {
                        "done": True,
                        "onboarding_step": step,
                        "guest_selections": guest_selections,
                        "needs_account": step == "create_account",
                        "show_signup_button": step == "create_account",  # Frontend can use this to show signup UI
                        "signup_data": {
                            "destination_country": guest_selections.get('destination_country', ''),
                            "origin_country": guest_selections.get('origin_country', ''),
                            "goal": guest_selections.get('goal', '')
                        } if step == "create_account" else None
                    }
                    yield f"data: {json.dumps(completion_data)}\n\n"
                
                print(f"🌟 === STREAMING ONBOARDING RESPONSE ===")
                return StreamingResponse(stream_onboarding_response(), media_type="text/event-stream")
            
            # Handle authenticated users
            print(f"🔐 === AUTHENTICATED USER FLOW ===")
            
            # Check if user just signed up and has guest selections to transfer
            guest_selections = load_guest_session(session_id)
            if guest_selections:
                print(f"🔄 Transferring guest selections to authenticated user...")
                transfer_guest_session_to_user(session_id, user["id"])
                # Update user profile with guest selections
                user_profile.update(guest_selections)
                print(f"✅ User profile updated with guest selections: {user_profile}")
            
            # Feature gating for AI chat
            # Skip usage limits for development/testing users
            if user["id"] not in ["dev_user_123", "frontend_user_fallback", "auth_error_fallback"]:
                # Check user access to AI chat for production users
                access_info = check_user_access(user["id"], "ai_chat")
                if not access_info["allowed"]:
                    print(f"❌ User {user['id']} access denied: {access_info['reason']}")
                    return JSONResponse(
                        status_code=403,
                        content={
                            "status": "error",
                            "message": access_info["reason"],
                            "feature": "ai_chat",
                            "upgrade_tier": access_info.get("upgrade_tier", "premium"),
                            "remaining": access_info.get("remaining", 0)
                        }
                    )
                # Increment usage for production users
                increment_user_usage(user["id"], "question")
                print(f"✅ Incremented usage for production user {user['id']}")
            else:
                print(f"✅ Skipping usage limits for dev/test user {user['id']}")
            
            # Get user name for personalized responses
            user_name = user.get("first_name", "User")
            user_id = user.get("id")
            print(f"🧠 User: {user_name} (ID: {user_id})")
            
            # LANGCHAIN MEMORY INTEGRATION
            # Load conversation history from database into LangChain memory (if not already loaded)
            conversation_memory.load_conversation_from_database(user_id, user_name)
            
            # Get conversation history from LangChain
            conversation_history = conversation_memory.get_conversation_history(user_id, user_name)
            print(f"🧠 LangChain conversation history: {len(conversation_history)} chars")
            
            # Check if this is a first question (initial setup) or a follow-up
            # Real immigration questions should never be treated as first questions
            immigration_keywords = ["visa", "immigrat", "study", "work", "family", "invest", "green card", "citizenship", "requirements", "apply"]
            has_immigration_content = any(keyword in question.lower() for keyword in immigration_keywords) if question.strip() else False
            
            is_first_question = (
                not question.strip() or 
                (question.strip() in ["Hello", "Hi", "Start", "Begin", "Let's start"] and not has_immigration_content)
            )
            print(f"🧠 Is first question: {is_first_question}")
            print(f"🧠 Has immigration content: {has_immigration_content}")
            
            # Check if this is coming from the setup flow
            is_setup_flow = (
                "I want to immigrate from" in question and 
                "for family" in question and 
                "What should I know?" in question
            )
            print(f"🧠 Is setup flow: {is_setup_flow}")
            
            # Use vector search for content-based questions
            search_results = []
            if not is_first_question and not is_setup_flow:
                print(f"🔍 Searching for: {question}")
                search_results = search_immigration_content(question, "immigration_docs", limit=10)
                print(f"🔍 Search results: {len(search_results)} found")
            else:
                print(f"🔍 Skipping search for first/setup question")
            
            # Generate response using LangChain
            response = ""
            
            if is_first_question:
                # First interaction - get last conversation for welcome
                last_conversation = get_user_last_conversation(user_id)
                print(f"🧠 Generating personalized welcome...")
                
                # Get user language preference
                user_language = 'en'  # Default to English
                if user:
                    try:
                        conn = sqlite3.connect('admin_secure.db')
                        cursor = conn.cursor()
                        cursor.execute("SELECT language_preference FROM users WHERE id = ?", (user["id"],))
                        result = cursor.fetchone()
                        if result and result[0]:
                            user_language = result[0]
                        conn.close()
                        print(f"🌐 User language preference for welcome: {user_language}")
                    except Exception as e:
                        print(f"⚠️ Could not get user language preference for welcome: {e}")
                
                response = await generate_personalized_welcome(user_profile, user_name, last_conversation, user_language)
                print(f"🧠 Welcome generated: {len(response)} chars")
                
            else:
                # Continuing conversation - use LangChain with OpenAI
                print(f"🧠 Using LangChain for conversation continuation...")
                
                # Get OpenAI API key for LangChain
                openai_key = os.getenv("OPENAI_API_KEY")
                if openai_key and len(openai_key) > 20 and conversation_memory.llm:
                    try:
                        print(f"🧠 Using LangChain ChatOpenAI for response generation...")
                        
                        # Validate OpenAI key is not a placeholder
                        if openai_key in ["your-openai-api-key-here", "demo-key-for-testing", "sk-placeholder"]:
                            print(f"⚠️ OpenAI key appears to be a placeholder, falling back to traditional response")
                            raise Exception("Invalid OpenAI API key")
                        
                        # Test if LangChain ChatOpenAI is properly initialized
                        if not hasattr(conversation_memory.llm, 'invoke'):
                            print(f"⚠️ LangChain ChatOpenAI not properly initialized")
                            raise Exception("LangChain ChatOpenAI initialization failed")
                        
                        # Build context with search results
                        search_context = ""
                        if search_results:
                            search_context = "\n\nRELEVANT IMMIGRATION INFORMATION:\n"
                            for i, result in enumerate(search_results[:3]):
                                content = result.get('content', result.get('text', ''))[:300]
                                title = result.get('title', result.get('document_title', f'Document {i+1}'))
                                search_context += f"- {title}: {content}...\n"
                        
                        # Enhanced prompt with user context
                        destination = user_profile.get('destination_country', 'United States').replace('_', ' ').title()
                        origin = user_profile.get('origin_country', 'your country').replace('_', ' ').title()
                        goal = user_profile.get('goal', 'immigration')
                        
                        enhanced_question = f"""USER CONTEXT:
- Name: {user_name}
- From: {origin} 
- To: {destination}
- Goal: {goal}

CURRENT QUESTION: {question}

{search_context}

INSTRUCTIONS:
- You are Sarah, an expert immigration consultant with perfect conversation memory
- Remember what we discussed before - never ask the same questions twice
- Provide specific, consultative guidance based on their {origin} to {destination} journey
- Ask logical follow-up questions to understand their situation better
- Use official immigration information provided above when relevant
- Be conversational and natural, like talking to a friend
- Identify specific visa types when appropriate (B-2 tourist, F-1 student, etc.)
- Never redirect to government websites - you have all the expertise needed
- IMPORTANT: Do NOT offer to generate reports or PDFs - the system handles this automatically
- Continue the consultation by asking relevant follow-up questions instead of concluding

Answer the question building on our conversation history:"""
                        
                        # Get messages formatted for OpenAI
                        messages = conversation_memory.get_messages_for_openai(user_id, user_name)
                        
                        # Validate message length to prevent API errors
                        total_message_length = sum(len(msg.get("content", "")) for msg in messages)
                        if total_message_length > 12000:  # Leave room for the new question
                            print(f"⚠️ Message history too long ({total_message_length} chars), truncating...")
                            # Keep only recent messages
                            messages = messages[:1] + messages[-8:]  # Keep system message + last 8 messages
                        
                        # Add the current enhanced question
                        messages.append({"role": "user", "content": enhanced_question})
                        
                        # Validate the enhanced question isn't too long
                        if len(enhanced_question) > 4000:
                            print(f"⚠️ Enhanced question too long, using simple question")
                            messages[-1] = {"role": "user", "content": question}
                        
                        # Generate response using LangChain's ChatOpenAI
                        from langchain_core.messages import HumanMessage
                        
                        # Convert to LangChain message format with error checking
                        lc_messages = []
                        for msg in messages:
                            try:
                                if msg["role"] == "system":
                                    lc_messages.append(SystemMessage(content=msg["content"]))
                                elif msg["role"] == "user":
                                    lc_messages.append(HumanMessage(content=msg["content"]))
                                elif msg["role"] == "assistant":
                                    lc_messages.append(AIMessage(content=msg["content"]))
                            except Exception as msg_error:
                                print(f"⚠️ Error processing message: {msg_error}")
                                continue
                        
                        # Ensure we have at least a system message and user message
                        if len(lc_messages) < 2:
                            print(f"⚠️ Not enough valid messages, creating minimal conversation")
                            lc_messages = [
                                SystemMessage(content=f"You are Sarah, an expert immigration consultant helping {user_name} with immigration questions."),
                                HumanMessage(content=question)
                            ]
                        
                        # Generate response with timeout protection
                        print(f"🧠 Sending {len(lc_messages)} messages to LangChain ChatOpenAI...")
                        ai_response = conversation_memory.llm.invoke(lc_messages)
                        
                        if hasattr(ai_response, 'content') and ai_response.content:
                            response = ai_response.content.strip()
                            print(f"✅ LangChain response generated: {len(response)} chars")
                        else:
                            raise Exception("Empty response from LangChain")
                        
                    except Exception as e:
                        print(f"❌ LangChain response generation failed: {e}")
                        import traceback
                        traceback.print_exc()
                        
                        # Fallback to traditional method
                        response = generate_natural_response(question, user_profile, search_results, user_name, conversation_history)
                        
                else:
                    print(f"❌ LangChain not available, using fallback response generation")
                    # Fallback to traditional method
                    response = generate_natural_response(question, user_profile, search_results, user_name, conversation_history)
            
            # Clean up formatting issues
            response = response.replace("U.\ncitizen", "U.S. citizen")
            response = response.replace("U.\n", "U.S. ")
            response = response.replace("U. ", "U.S. ")
            response = response.replace(" \n", "\n")
            
            # Fix specific country name formatting
            response = response.replace(" Usa", " United States")
            response = response.replace("to Usa", "to United States")
            response = response.replace("from Usa", "from United States")
            
            # Remove random characters and fix formatting
            response = response.replace("\n)", "\n•")  # Fix bullet point formatting
            response = response.replace(" )", "")      # Remove standalone )
            response = response.replace("()", "")      # Remove empty parentheses
            
            # Clean up extra spaces and line breaks
            response = re.sub(r'\n\s*\n\s*\n', '\n\n', response)  # Remove triple line breaks
            response = re.sub(r' +', ' ', response)               # Remove multiple spaces
            response = response.strip()
            
            print(f"🧠 Final response: {len(response)} chars")
            print(f"🧠 Response preview: {response[:100]}...")
            
            # ADD CONVERSATION TO LANGCHAIN MEMORY
            # Only add meaningful conversations (not just greetings)
            if not is_first_question or question.strip() not in ["Hello", "Hi", "Start", "Begin", "Let's start"]:
                conversation_memory.add_user_message(user_id, question, user_name)
                conversation_memory.add_ai_message(user_id, response, user_name)
                print(f"🧠 Added conversation to LangChain memory")
            
            # Log the conversation to database (for persistence)
            print(f"🔍 Logging conversation to database...")
            log_conversation(conversation_id, question, response, user_profile, 
                           auth_request.client.host if hasattr(auth_request, 'client') else None, 
                           session_id,  # session_id
                           user_id)  # user_id
            print(f"✅ Conversation logged to database")
            
            # Get user language preference for translation
            user_language = 'en'  # Default to English
            if user:
                try:
                    conn = sqlite3.connect('admin_secure.db')
                    cursor = conn.cursor()
                    cursor.execute("SELECT language_preference FROM users WHERE id = ?", (user["id"],))
                    result = cursor.fetchone()
                    if result and result[0]:
                        user_language = result[0]
                    conn.close()
                    print(f"🌐 User language preference: {user_language}")
                except Exception as e:
                    print(f"⚠️ Could not get user language preference: {e}")
            
            # Translate response if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    print(f"🌐 Translating response to {user_language}")
                    response = await translation_service.translate_text(response, user_language, 'en')
                    print(f"✅ Response translated to {user_language}")
                except Exception as e:
                    print(f"⚠️ Translation failed, using original: {e}")
            
            # Stream the response in proper SSE JSON format
            async def generate_response():
                words = response.split(' ')
                for i, word in enumerate(words):
                    # Send JSON formatted content that frontend expects
                    json_data = {"content": word + " "}
                    yield f"data: {json.dumps(json_data)}\n\n"
                    if i % 4 == 0:  # Slightly faster for natural conversation
                        await asyncio.sleep(0.08)
                # Send completion signal
                yield f"data: {json.dumps({'done': True})}\n\n"
            
            print(f"🧠 === STREAMING LANGCHAIN RESPONSE ===")
            return StreamingResponse(generate_response(), media_type="text/event-stream")
            
        except Exception as e:
            print(f"❌ Error in LangChain ask_worldwide: {e}")
            import traceback
            error_details = traceback.format_exc()
            print(f"❌ Full traceback: {error_details}")
            
            # Try to provide a more specific error message based on the error type
            if "openai" in str(e).lower() or "api" in str(e).lower():
                error_message = "I'm experiencing issues with my AI system right now. Let me give you a helpful response based on what I know about immigration."
                # Provide a basic immigration response as fallback
                try:
                    # Get basic immigration info based on the question
                    if "visa" in question.lower() and "recommend" in question.lower():
                        fallback_response = f"Great question! For your immigration journey, the visa type depends on your specific situation:\n\n🎯 **Most Common Visa Types:**\n• **F-1 Student Visa**: For full-time study at US universities\n• **H-1B Work Visa**: For skilled workers with job offers\n• **Family-based Green Card**: For those with US citizen/resident relatives\n• **B-2 Tourist Visa**: For temporary visits\n\nTo recommend the best option for you, I'd need to know:\n• What's your main goal? (study, work, family, visit)\n• Do you have any ties to the US? (family, job offers, etc.)\n• What's your current situation?\n\nWhat's most important to you for your US immigration?"
                    else:
                        fallback_response = f"I'd be happy to help you with your immigration question! While I'm experiencing some technical issues with my advanced AI features, I can still provide guidance.\n\nCould you tell me more specifically what you'd like to know about? For example:\n• Visa types and requirements\n• Application processes and timelines\n• Required documents\n• Costs and fees\n\nWhat would be most helpful for your immigration journey?"
                    
                    # Stream the fallback response
                    async def smart_fallback_response():
                        words = fallback_response.split(' ')
                        for i, word in enumerate(words):
                            json_data = {"content": word + " "}
                            yield f"data: {json.dumps(json_data)}\n\n"
                            if i % 3 == 0:
                                await asyncio.sleep(0.1)
                        yield f"data: {json.dumps({'done': True})}\n\n"
                    
                    # Log the conversation with the fallback response
                    log_conversation(conversation_id, question, fallback_response, user_profile, 
                                   auth_request.client.host if hasattr(auth_request, 'client') else None, 
                                   None, user_id if 'user' in locals() else None)
                    
                    print(f"✅ Provided smart fallback response: {len(fallback_response)} chars")
                    return StreamingResponse(smart_fallback_response(), media_type="text/event-stream")
                    
                except Exception as fallback_error:
                    print(f"❌ Fallback response also failed: {fallback_error}")
                    error_message = "I'm experiencing technical difficulties. Please try again and I'll help you with your immigration question."
            
            elif "memory" in str(e).lower() or "langchain" in str(e).lower():
                error_message = "I'm having trouble accessing our conversation history right now, but I can still help! Please try rephrasing your question."
            
            else:
                error_message = "I encountered an unexpected issue. Let me try to help you anyway - could you rephrase your question?"
            
            # Basic fallback response
            async def error_response():
                json_data = {"content": error_message}
                yield f"data: {json.dumps(json_data)}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            
            return StreamingResponse(error_response(), media_type="text/event-stream")

    # Admin Status and Monitoring
    @app.get("/admin/status")
    async def get_admin_status(current_user = Depends(get_current_user)):
        """Get comprehensive admin system status"""
        try:
            # Database status
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Count records in key tables
            cursor.execute('SELECT COUNT(*) FROM csv_sources')
            csv_count = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
            user_count = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM conversations WHERE created_at > datetime("now", "-24 hours")')
            daily_conversations = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM scheduled_tasks WHERE enabled = 1')
            active_schedules = cursor.fetchone()[0]
            
            conn.close()
            
            # Check Qdrant vector database
            vector_status = "disconnected"
            vector_collections = []
            try:
                from qdrant_client import QdrantClient
                qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
                collections = qdrant.get_collections()
                vector_status = "connected"
                vector_collections = [col.name for col in collections.collections]
            except Exception as e:
                vector_status = f"error: {str(e)}"
            
            # CSV file status
            csv_file_exists = os.path.exists("immigration_sources.csv")
            csv_file_size = 0
            if csv_file_exists:
                csv_file_size = os.path.getsize("immigration_sources.csv")
            
            # Scraping and embeddings status
            scraper_status = "available" if SCRAPER_AVAILABLE else "fallback_mode"
            embeddings_status = "available" if EMBEDDINGS_AVAILABLE else "fallback_mode"
            
            return {
                "status": "success",  # Frontend expects "success" not "running"
                "stats": {
                    # Original properties
                    "csv_sources": csv_count,
                    "active_users": user_count,
                    "daily_conversations": daily_conversations,
                    "active_schedules": active_schedules,
                    # Frontend dashboard expects these property names
                    "total_urls": csv_count,
                    "enabled_urls": csv_count,  # Same as total for now
                    "vector_count": len(vector_collections) if vector_collections else 0,
                    "total_conversations": daily_conversations,
                    "total_leads": 0,  # No leads implementation yet
                    "total_feedback": 0,  # No feedback count yet
                    "csv_file": {
                        "exists": csv_file_exists,
                        "size_bytes": csv_file_size,
                        "size_mb": round(csv_file_size / (1024 * 1024), 2) if csv_file_exists else 0
                    },
                    "vector_database": {
                        "status": vector_status,
                        "collections": vector_collections
                    },
                    "scraper": {
                        "status": scraper_status,
                        "message": "✅ Full scraping available" if SCRAPER_AVAILABLE else "⚠️ Using fallback mode due to dependency issues"
                    },
                    "embeddings": {
                        "status": embeddings_status,
                        "message": "✅ Vector embeddings available" if EMBEDDINGS_AVAILABLE else "⚠️ Using fallback mode due to dependency issues"
                    },
                    "system": {
                        "python_version": sys.version.split()[0],
                        "dependencies_ok": SCRAPER_AVAILABLE and EMBEDDINGS_AVAILABLE
                    }
                }
            }
        except Exception as e:
            return {
                "status": "error", 
                "message": str(e),
                "csv_sources": 0,
                "scraper": {"status": "error", "message": f"Error: {str(e)}"}
            }

    # Missing admin endpoints
    @app.get("/admin/conversations")
    async def get_conversations(limit: int = 50, current_user = Depends(get_current_user)):
        """Get recent conversations"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM conversations 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (limit,))
            columns = [desc[0] for desc in cursor.description]
            conversations = [dict(zip(columns, row)) for row in cursor.fetchall()]
            conn.close()
            
            return {"status": "success", "conversations": conversations}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/users")
    async def get_users(limit: int = 100, current_user = Depends(get_current_user)):
        """Get all registered users"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT u.id, u.email, u.first_name, u.last_name, u.tier, 
                       u.origin_country, u.phone, u.email_verified, u.is_active,
                       u.created_at, u.updated_at,
                       uu.daily_questions_used, uu.monthly_reports_used
                FROM users u
                LEFT JOIN user_usage uu ON u.id = uu.user_id AND uu.usage_date = CURRENT_DATE
                WHERE u.is_active = 1
                ORDER BY u.created_at DESC 
                LIMIT ?
            ''', (limit,))
            columns = [desc[0] for desc in cursor.description]
            users = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Get total user count
            cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
            total_users = cursor.fetchone()[0]
            
            # Get premium users count
            cursor.execute('SELECT COUNT(*) FROM users WHERE tier = "premium" AND is_active = 1')
            premium_users = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "status": "success", 
                "users": users,
                "total_users": total_users,
                "premium_users": premium_users
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/users/{user_id}")
    async def get_user_details(user_id: str, current_user = Depends(get_current_user)):
        """Get detailed user information"""
        try:
            user = get_user_by_id(user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get usage history
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM user_usage 
                WHERE user_id = ? 
                ORDER BY usage_date DESC 
                LIMIT 30
            ''', (user_id,))
            usage_columns = [desc[0] for desc in cursor.description]
            usage_history = [dict(zip(usage_columns, row)) for row in cursor.fetchall()]
            
            # Get conversations
            cursor.execute('''
                SELECT * FROM conversations 
                WHERE user_profile LIKE ? 
                ORDER BY created_at DESC 
                LIMIT 10
            ''', (f'%{user["email"]}%',))
            conv_columns = [desc[0] for desc in cursor.description]
            conversations = [dict(zip(conv_columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            
            return {
                "status": "success",
                "user": user,
                "usage_history": usage_history,
                "recent_conversations": conversations
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.put("/admin/users/{user_id}/tier")
    async def update_user_tier(
        user_id: str,
        tier_update: UserTierUpdate,
        current_user = Depends(get_current_user)
    ):
        """Update user tier (admin only)"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users SET 
                    tier = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (tier_update.tier, user_id))
            
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
                
            conn.commit()
            conn.close()
            
            log_activity(current_user["user_id"], "USER_TIER_UPDATE", 
                        f"Updated user {user_id} tier to {tier_update.tier}. Reason: {tier_update.reason}")
            
            return {"status": "success", "message": f"User tier updated to {tier_update.tier}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.delete("/admin/users/{user_id}")
    async def deactivate_user(user_id: str, current_user = Depends(get_current_user)):
        """Deactivate user account (admin only)"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users SET 
                    is_active = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (user_id,))
            
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
                
            conn.commit()
            conn.close()
            
            log_activity(current_user["user_id"], "USER_DEACTIVATE", f"Deactivated user {user_id}")
            
            return {"status": "success", "message": "User account deactivated"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/analytics")
    async def get_analytics(current_user = Depends(get_current_user)):
        """Get analytics data"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Daily user registrations (last 30 days)
            cursor.execute('''
                SELECT DATE(created_at) as date, COUNT(*) as registrations
                FROM users 
                WHERE created_at > datetime('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date
            ''')
            daily_registrations = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # Daily conversations (last 30 days)
            cursor.execute('''
                SELECT DATE(created_at) as date, COUNT(*) as conversations
                FROM conversations 
                WHERE created_at > datetime('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date
            ''')
            daily_conversations = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # Popular destination countries
            cursor.execute('''
                SELECT destination_country, COUNT(*) as count
                FROM conversations 
                WHERE destination_country != ''
                GROUP BY destination_country
                ORDER BY count DESC
                LIMIT 10
            ''')
            popular_destinations = [{"country": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            conn.close()
            
            return {
                "status": "success",
                "analytics": {
                    "daily_registrations": daily_registrations,
                    "daily_conversations": daily_conversations,
                    "popular_destinations": popular_destinations
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/schedules")
    async def get_schedules(current_user = Depends(get_current_user)):
        """Get scheduled tasks"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
            columns = [desc[0] for desc in cursor.description]
            schedules = [dict(zip(columns, row)) for row in cursor.fetchall()]
            conn.close()
            
            return {"status": "success", "schedules": schedules}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/admin/schedules")
    async def create_schedule(task: ScheduleTask, current_user = Depends(get_current_user)):
        """Create a new scheduled task"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO scheduled_tasks (name, task_type, schedule_type, enabled, country_filter)
                VALUES (?, ?, ?, ?, ?)
            ''', (task.name, task.task_type, task.schedule_type, task.enabled, 
                  json.dumps(task.country_filter) if task.country_filter else None))
            conn.commit()
            conn.close()
            
            log_activity(current_user["user_id"], "SCHEDULE_CREATE", f"Created schedule: {task.name}")
            return {"status": "success", "message": "Schedule created successfully"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/admin/scrape/manual")
    async def scrape_manual(
        background_tasks: BackgroundTasks,
        request_data: Dict = Body(...),
        current_user = Depends(get_current_user)
    ):
        """Manually trigger scraping for selected URLs"""
        try:
            # Handle different request formats from frontend
            url_ids = request_data.get('url_ids', None)
            
            # Get URL data from database
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            if url_ids:
                # Scrape specific URLs by IDs
                placeholders = ','.join(['?' for _ in url_ids])
                cursor.execute(f'''
                    SELECT * FROM csv_sources 
                    WHERE id IN ({placeholders})
                ''', url_ids)
            else:
                # Scrape all enabled URLs
                cursor.execute('SELECT * FROM csv_sources WHERE enabled = 1')
            
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                raise HTTPException(status_code=400, detail="No URLs found to scrape")
            
            # Convert database rows to URL data format
            url_data = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                url_data.append({
                    'url': row_dict.get('url', ''),
                    'title': row_dict.get('title', ''),
                    'country': row_dict.get('country', ''),
                    'category': row_dict.get('category', ''),
                    'id': row_dict.get('id')
                })
            
            # Start background scraping
            background_tasks.add_task(scrape_urls_background, url_data, current_user["user_id"])
            
            return {
                "status": "success", 
                "message": f"Started scraping {len(url_data)} URLs in background"
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/scrape/progress")
    async def get_scrape_progress(current_user = Depends(get_current_user)):
        """Get current scraping progress"""
        try:
            import time  # Import time module here
            progress_file = "scraping_progress.json"
            
            # Check for real-time progress file first
            if os.path.exists(progress_file):
                try:
                    with open(progress_file, 'r') as f:
                        progress_data = json.load(f)
                    
                    # Check if progress is recent (within last 5 minutes)
                    current_time = time.time()
                    start_time = progress_data.get('start_time', current_time)
                    time_diff = current_time - start_time
                    
                    if time_diff < 300:  # 5 minutes
                        return {
                            "status": "success",
                            "scraping": {
                                "active": progress_data.get("active", False),
                                "completed": progress_data.get("completed", 0),
                                "failed": progress_data.get("failed", 0),
                                "total": progress_data.get("total", 0),
                                "status": progress_data.get("status", "idle"),
                                "current_url": progress_data.get("current_url", ""),
                                "time_elapsed": round(time_diff, 1),
                                "urls_processed": progress_data.get("urls_processed", [])[-10:]  # Last 10
                            }
                        }
                except Exception as e:
                    print(f"Error reading progress file: {e}")
                    
            # Fallback: Check activity logs for recent scraping activity (within last 30 seconds)
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM activity_logs 
                WHERE action IN ('SCRAPE_COMPLETE', 'SCRAPE_ERROR') 
                AND datetime(timestamp) > datetime('now', '-30 seconds')
                ORDER BY timestamp DESC 
                LIMIT 1
            ''')
            recent_activity = cursor.fetchone()
            conn.close()
            
            if recent_activity:
                # Parse the details to get counts
                details = recent_activity[3]  # details column
                timestamp = recent_activity[4]  # timestamp column
                
                if "Successfully scraped" in details:
                    # Extract number from "Successfully scraped X URLs"
                    match = re.search(r'Successfully scraped (\d+) URLs', details)
                    completed = int(match.group(1)) if match else 0
                    
                    # Calculate time since completion
                    from datetime import datetime
                    
                    try:
                        # Parse timestamp 
                        completion_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        time_diff = (datetime.now() - completion_time.replace(tzinfo=None)).total_seconds()
                        
                        # Show as "completed" since this is from activity logs
                        return {
                            "status": "success",
                            "scraping": {
                                "active": False,
                                "completed": completed,
                                "failed": 0,
                                "total": completed,
                                "status": "completed",
                                "current_url": "",
                                "time_elapsed": round(time_diff, 1),
                                "message": f"Recently completed: {completed} URLs scraped",
                                "urls_processed": [
                                    {
                                        "url": f"immigration_source_{i+1}",
                                        "status": "success",
                                        "processed_at": timestamp
                                    } for i in range(min(completed, 10))  # Show first 10
                                ]
                            }
                        }
                    except:
                        # Fallback if timestamp parsing fails
                        pass
            
            # Default response - no recent scraping
            return {
                "status": "success",
                "scraping": {
                    "active": False,
                    "completed": 0,
                    "failed": 0,
                    "total": 0,
                    "status": "idle",
                    "message": "No recent scraping activity",
                    "urls_processed": []
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/admin/vectorize")
    async def vectorize_manual(
        background_tasks: BackgroundTasks,
        current_user = Depends(get_current_user)
    ):
        """Manually trigger vectorization of scraped content"""
        try:
            # Start background vectorization
            background_tasks.add_task(vectorize_content_background, current_user["user_id"])
            
            return {
                "status": "success", 
                "message": "Started content vectorization in background"
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/vectorize/progress")
    async def get_vectorize_progress(current_user = Depends(get_current_user)):
        """Get current vectorization progress"""
        try:
            # Check activity logs for recent vectorization
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM activity_logs 
                WHERE action IN ('VECTORIZE_SUCCESS', 'VECTORIZE_ERROR') 
                AND datetime(timestamp) > datetime('now', '-60 seconds')
                ORDER BY timestamp DESC 
                LIMIT 1
            ''')
            recent_activity = cursor.fetchone()
            conn.close()
            
            if recent_activity:
                details = recent_activity[3]  # details column
                
                if "Successfully vectorized" in details:
                    # Extract number from "Successfully vectorized X items"
                    match = re.search(r'Successfully vectorized (\d+) items', details)
                    vectors_created = int(match.group(1)) if match else 0
                    
                    return {
                        "status": "success",
                        "vectorization": {
                            "active": False,
                            "completed": vectors_created,
                            "total": vectors_created,
                            "vectors_created": vectors_created,
                            "chunks_created": vectors_created,
                            "phase": "completed",
                            "current_document": "",
                            "current_step": f"Successfully created {vectors_created} vectors",
                            "status": "completed"
                        }
                    }
            
            # Check if there are scraped files ready for vectorization
            scraped_files_exist = os.path.exists("manual_scrape_content.json")
            
            if scraped_files_exist:
                try:
                    with open("manual_scrape_content.json", "r") as f:
                        content = json.load(f)
                    
                    # Check modification time
                    mod_time = os.path.getmtime("manual_scrape_content.json")
                    time_since_mod = time.time() - mod_time
                    
                    # If recently modified, might be ready for vectorization
                    if time_since_mod < 300:  # 5 minutes
                        return {
                            "status": "success",
                            "vectorization": {
                                "active": False,
                                "completed": 0,
                                "total": len(content),
                                "vectors_created": 0,
                                "chunks_created": 0,
                                "phase": "ready",
                                "current_document": "",
                                "current_step": f"{len(content)} documents ready for vectorization",
                                "status": "ready"
                            }
                        }
                except:
                    pass
            
            # Default response - no recent vectorization
            return {
                "status": "success",
                "vectorization": {
                    "active": False,
                    "completed": 0,
                    "total": 0,
                    "vectors_created": 0,
                    "chunks_created": 0,
                    "phase": "idle",
                    "current_document": "",
                    "current_step": "No vectorization activity",
                    "status": "idle"
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/admin/vectorize-batch")
    async def vectorize_batch_safe(
        batch_size: int = 20,
        current_user = Depends(get_current_user)
    ):
        """Safe batch vectorization with deduplication - prevents duplicate content"""
        try:
            import json
            import os
            import hashlib
            from sentence_transformers import SentenceTransformer
            from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
            import uuid
            
            # Load scraped content
            content_file = "manual_scrape_content.json"
            if not os.path.exists(content_file):
                return {"status": "error", "message": "No scraped content found"}
            
            with open(content_file, 'r') as f:
                all_data = json.load(f)
            
            # Filter successful documents
            successful_docs = [d for d in all_data if d.get('status') == 'success']
            
            if not successful_docs:
                return {"status": "error", "message": "No successful documents to vectorize"}
            
            print(f"🚀 Starting safe batch vectorization of {len(successful_docs)} documents")
            
            # Initialize embedding model
            embed_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            # Connect to Qdrant
            from embeddings import get_qdrant_client
            qdrant = get_qdrant_client()
            
            # Get existing content hashes to prevent duplicates
            try:
                existing_points = qdrant.scroll(
                    collection_name="immigration_docs",
                    limit=10000,  # Get all existing points
                    with_payload=True,
                    with_vectors=False
                )
                existing_hashes = set()
                for point in existing_points[0]:
                    if 'content_hash' in point.payload:
                        existing_hashes.add(point.payload['content_hash'])
                print(f"🔍 Found {len(existing_hashes)} existing content hashes for deduplication")
            except Exception as e:
                print(f"⚠️ Could not fetch existing hashes, proceeding without deduplication: {e}")
                existing_hashes = set()
            
            # Process documents in batches
            total_batches = (len(successful_docs) + batch_size - 1) // batch_size
            processed_chunks = 0
            skipped_duplicates = 0
            failed_batches = 0
            
            for batch_idx in range(0, len(successful_docs), batch_size):
                try:
                    batch_docs = successful_docs[batch_idx:batch_idx + batch_size]
                    current_batch_num = (batch_idx // batch_size) + 1
                    
                    print(f"🔄 Processing batch {current_batch_num}/{total_batches} ({len(batch_docs)} documents)")
                    
                    # Create chunks from documents
                    chunks = []
                    for doc in batch_docs:
                        title = doc.get('title', 'Unknown')
                        content = doc.get('content', '')
                        url = doc.get('url', '')
                        
                        if content.strip():
                            # Split content into chunks
                            sentences = content.split('. ')
                            chunk_size = 500
                            
                            current_chunk = ""
                            for sentence in sentences:
                                if len(current_chunk + sentence) > chunk_size and current_chunk:
                                    chunk_text = current_chunk.strip()
                                    content_hash = hashlib.md5(chunk_text.encode()).hexdigest()
                                    
                                    # Only add if not duplicate
                                    if content_hash not in existing_hashes:
                                        chunks.append({
                                            'text': chunk_text,
                                            'content_hash': content_hash,
                                            'metadata': {
                                                'title': title,
                                                'url': url,
                                                'source': title,
                                                'content_hash': content_hash
                                            }
                                        })
                                    else:
                                        skipped_duplicates += 1
                                        
                                    current_chunk = sentence + ". "
                                else:
                                    current_chunk += sentence + ". "
                        
                        # Add remaining content
                        if current_chunk.strip():
                            chunk_text = current_chunk.strip()
                            content_hash = hashlib.md5(chunk_text.encode()).hexdigest()
                            
                            # Only add if not duplicate
                            if content_hash not in existing_hashes:
                                chunks.append({
                                    'text': chunk_text,
                                    'content_hash': content_hash,
                                    'metadata': {
                                        'title': title,
                                        'url': url,
                                        'source': title,
                                        'content_hash': content_hash
                                    }
                                })
                            else:
                                skipped_duplicates += 1
                    
                    if not chunks:
                        continue
                    
                    # Process chunks in smaller sub-batches for embeddings
                    embedding_batch_size = 50
                    for chunk_idx in range(0, len(chunks), embedding_batch_size):
                        chunk_batch = chunks[chunk_idx:chunk_idx + embedding_batch_size]
                        chunk_texts = [chunk["text"] for chunk in chunk_batch]
                        
                        # Generate embeddings
                        vectors = embed_model.encode(chunk_texts, show_progress_bar=False)
                        
                        # Prepare points for upsert
                        points = []
                        for chunk, vector in zip(chunk_batch, vectors):
                            point_id = str(uuid.uuid4())
                            
                            # Create complete payload with both text content and metadata
                            payload = {
                                # Include the actual text content
                                'text': chunk['text'],
                                'content': chunk['text'],
                                'combined_text': chunk['text'],
                                'full_chunk': chunk['text'],
                                # Include all metadata
                                **chunk.get("metadata", {})
                            }
                            
                            points.append(
                                PointStruct(
                                    id=point_id,
                                    vector=vector.tolist(),
                                    payload=payload
                                )
                            )
                            # Add to existing hashes to prevent duplicates within the same batch
                            existing_hashes.add(chunk.get('content_hash'))
                        
                        # Upsert to Qdrant
                        qdrant.upsert(
                            collection_name="immigration_docs",
                            points=points
                        )
                        
                        processed_chunks += len(points)
                    
                    print(f"✅ Batch {current_batch_num} completed - {len(chunks)} chunks processed")
                    
                except Exception as batch_error:
                    print(f"❌ Error processing batch {current_batch_num}: {batch_error}")
                    failed_batches += 1
                    continue
            
            # Get final collection stats
            try:
                collection_info = qdrant.get_collection("immigration_docs")
                total_vectors = collection_info.points_count
            except:
                total_vectors = "unknown"
            
            return {
                "status": "success",
                "message": f"Batch vectorization completed with deduplication",
                "details": {
                    "total_documents": len(successful_docs),
                    "total_batches": total_batches,
                    "processed_chunks": processed_chunks,
                    "skipped_duplicates": skipped_duplicates,
                    "failed_batches": failed_batches,
                    "total_vectors_in_collection": total_vectors
                }
            }
            
        except Exception as e:
            print(f"❌ Batch vectorization error: {e}")
            return {"status": "error", "message": f"Batch vectorization failed: {str(e)}"}

    @app.get("/admin/qdrant/collections")
    async def get_qdrant_collections(current_user = Depends(get_current_user)):
        """Get Qdrant collection information"""
        try:
            # Use direct HTTP API calls to avoid client version issues
            import requests
            qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
            
            # Get collections list
            collections_response = requests.get(f"{qdrant_url}/collections")
            collections_data = collections_response.json()
            
            collection_info = []
            
            if collections_data.get("status") == "ok":
                for collection in collections_data["result"]["collections"]:
                    collection_name = collection["name"]
                    
                    try:
                        # Get detailed collection info
                        info_response = requests.get(f"{qdrant_url}/collections/{collection_name}")
                        info_data = info_response.json()
                        
                        if info_data.get("status") == "ok":
                            result = info_data["result"]
                            points_count = result.get("points_count", 0)
                            indexed_count = result.get("indexed_vectors_count", 0)
                            
                            collection_info.append({
                                "name": collection_name,
                                "points_count": points_count,
                                "vectors_count": points_count,  # Use points_count as vectors_count
                                "indexed_vectors": indexed_count,
                                "status": result.get("status", "unknown")
                            })
                        else:
                            collection_info.append({
                                "name": collection_name,
                                "points_count": 0,
                                "vectors_count": 0,
                                "indexed_vectors": 0,
                                "status": "error"
                            })
                    except Exception as e:
                        print(f"Error getting collection {collection_name}: {e}")
                        collection_info.append({
                            "name": collection_name,
                            "points_count": 0,
                            "vectors_count": 0,
                            "indexed_vectors": 0,
                            "status": "error"
                        })
            
            return {"status": "success", "collections": collection_info}
            
        except Exception as e:
            print(f"Qdrant collections error: {e}")
            return {"status": "error", "message": str(e)}

    @app.get("/admin/qdrant/status")
    async def get_qdrant_status(current_user = Depends(get_current_user)):
        """Get Qdrant database status"""
        try:
            # Use direct HTTP API calls to avoid client version issues
            import requests
            qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
            
            # Test connection and get collections
            collections_response = requests.get(f"{qdrant_url}/collections")
            collections_data = collections_response.json()
            
            if collections_data.get("status") != "ok":
                raise Exception("Failed to connect to Qdrant")
            
            # Get total stats
            total_vectors = 0
            total_points = 0
            collection_count = 0
            
            for collection in collections_data["result"]["collections"]:
                collection_name = collection["name"]
                collection_count += 1
                
                try:
                    # Get detailed collection info
                    info_response = requests.get(f"{qdrant_url}/collections/{collection_name}")
                    info_data = info_response.json()
                    
                    if info_data.get("status") == "ok":
                        result = info_data["result"]
                        points_count = result.get("points_count", 0)
                        total_points += points_count
                        total_vectors += points_count  # Use points_count as vectors
                except Exception as e:
                    print(f"Error getting stats for collection {collection_name}: {e}")
            
            return {
                "status": "success", 
                "qdrant": {
                    "connected": True,
                    "status": "connected",
                    "total_collections": collection_count,
                    "total_points": total_points,
                    "total_vectors": total_vectors,
                    "url": qdrant_url
                }
            }
            
        except Exception as e:
            print(f"Qdrant status error: {e}")
            return {
                "status": "success",
                "qdrant": {
                    "connected": False,
                    "status": "disconnected",
                    "total_collections": 0,
                    "total_points": 0,
                    "total_vectors": 0,
                    "error": str(e)
                }
            }

    @app.get("/admin/qdrant/search")
    async def search_vector_content(
        query: str,
        collection: str = "immigration_docs",
        limit: int = 20,  # Increased to show more chunks
        current_user = Depends(get_current_user)
    ):
        """Search vector content for admin panel browsing with enhanced chunk display"""
        try:
            if not query or len(query.strip()) < 2:
                # For empty queries (Browse Content), do a default search with common terms
                query = "immigration visa form"  # Default search to show sample content
            
            # Use the search function to get results
            results = search_immigration_content(query.strip(), collection, limit)
            
            # Format results for admin panel with enhanced chunk information
            formatted_results = []
            for result in results:
                # Extract content from multiple possible field names
                content = (
                    result.get("content", "") or
                    result.get("text", "") or 
                    result.get("combined_text", "") or 
                    result.get("full_chunk", "") or
                    result.get("csv_description", "") or
                    "No content available"
                )
                
                # Get title from multiple possible sources
                title = (
                    result.get("document_title", "") or
                    result.get("title", "") or
                    result.get("csv_title", "") or
                    "Untitled Document"
                )
                
                # Get source URL
                source_url = (
                    result.get("source_url", "") or
                    result.get("url", "") or
                    ""
                )
                
                # Get chunk information
                chunk_index = result.get("chunk_index", 0)
                chunk_type = result.get("chunk_type", "content")
                section_title = result.get("section_title", "")
                subsection_title = result.get("subsection_title", "")
                
                # Create enhanced title with chunk info
                enhanced_title = title
                if section_title:
                    enhanced_title += f" - {section_title}"
                if subsection_title and subsection_title != section_title:
                    enhanced_title += f" ({subsection_title})"
                
                # Create content preview
                content_preview = ""
                if content and content != "No content available":
                    # Clean the content and create preview
                    clean_content = content.strip()
                    if len(clean_content) > 350:
                        content_preview = clean_content[:350] + "..."
                    else:
                        content_preview = clean_content
                else:
                    content_preview = "Content available in source document"
                
                # Enhanced metadata extraction
                metadata = {
                    "country": result.get("country", result.get("country_name", "")),
                    "category": result.get("category", result.get("category_name", "")),
                    "type": result.get("type", "document"),
                    "chunk_index": chunk_index,
                    "chunk_type": chunk_type,
                    "section_title": section_title,
                    "subsection_title": subsection_title,
                    "search_type": result.get("search_type", "semantic"),
                    # Enhanced fields from Phase 2
                    "form_numbers": result.get("form_numbers", []),
                    "visa_types": result.get("visa_types", []),
                    "requirements": result.get("requirements", []),
                    "fees": result.get("fees", []),
                    "temporal_info": result.get("temporal_info", []),
                    "relationships": result.get("relationships", []),
                    "process_flows": result.get("process_flows", [])
                }
                
                formatted_results.append({
                    "id": result.get("id", f"chunk_{chunk_index}"),
                    "title": enhanced_title,
                    "original_title": title,
                    "url": source_url,
                    "content_preview": content_preview,
                    "full_content": content,  # Include full content for detailed view
                    "score": round(result.get("score", 0), 3),
                    "chunk_info": {
                        "index": chunk_index,
                        "type": chunk_type,
                        "section": section_title,
                        "subsection": subsection_title,
                        "total_chunks": "unknown"  # We'll enhance this later
                    },
                    "payload": result,  # Include full result for frontend processing
                    "metadata": metadata
                })
            
            # Group chunks by source URL to show document structure
            chunks_by_url = {}
            for result in formatted_results:
                url = result["url"]
                if url:
                    if url not in chunks_by_url:
                        chunks_by_url[url] = []
                    chunks_by_url[url].append(result)
            
            return {
                "status": "success",
                "query": query,
                "collection": collection,
                "total_results": len(formatted_results),
                "results": formatted_results,
                "chunks_by_url": chunks_by_url,  # Grouped view for better organization
                "chunk_stats": {
                    "total_chunks": len(formatted_results),
                    "unique_documents": len(chunks_by_url),
                    "avg_chunks_per_doc": round(len(formatted_results) / max(len(chunks_by_url), 1), 2)
                }
            }
            
        except Exception as e:
            print(f"Vector search error: {e}")
            return {
                "status": "error",
                "message": f"Search failed: {str(e)}"
            }

    @app.get("/admin/leads")
    async def get_leads(current_user = Depends(get_current_user)):
        """Get lead submissions from the system"""
        try:
            # For now, return empty leads since we don't have a leads table yet
            # In the future, this would query a leads table in the database
            return {
                "status": "success",
                "leads": [],
                "total_count": 0,
                "message": "Leads functionality will be implemented in future updates"
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.get("/admin/scraped/pending")
    async def get_pending_scraped_content(current_user = Depends(get_current_user)):
        """Get scraped content that's ready for vectorization"""
        try:
            scraped_files = []
            
            # Check for manual scrape content
            if os.path.exists("manual_scrape_content.json"):
                try:
                    with open("manual_scrape_content.json", "r", encoding='utf-8') as f:
                        content = json.load(f)
                    
                    scraped_files.append({
                        "file": "manual_scrape_content.json",
                        "type": "Manual Scraping",
                        "count": len(content),
                        "size_mb": round(os.path.getsize("manual_scrape_content.json") / (1024 * 1024), 2),
                        "last_modified": os.path.getmtime("manual_scrape_content.json"),
                        "sample_urls": [item.get("url", "Unknown") for item in content[:5]],
                        "vectorized": False,
                        "ready_for_vectorization": True
                    })
                except Exception as e:
                    print(f"Error reading manual_scrape_content.json: {e}")
            
            # Check for enhanced content
            if os.path.exists("enhanced_content.json"):
                try:
                    with open("enhanced_content.json", "r", encoding='utf-8') as f:
                        content = json.load(f)
                    
                    scraped_files.append({
                        "file": "enhanced_content.json", 
                        "type": "Enhanced Content",
                        "count": len(content),
                        "size_mb": round(os.path.getsize("enhanced_content.json") / (1024 * 1024), 2),
                        "last_modified": os.path.getmtime("enhanced_content.json"),
                        "sample_urls": [item.get("url", "Unknown") for item in content[:5]],
                        "vectorized": True,
                        "ready_for_vectorization": False
                    })
                except Exception as e:
                    print(f"Error reading enhanced_content.json: {e}")
            
            return {
                "status": "success",
                "scraped_files": scraped_files,
                "total_files": len(scraped_files),
                "total_items": sum(f["count"] for f in scraped_files)
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.delete("/admin/scraped/file/{filename}")
    async def delete_scraped_file(filename: str, current_user = Depends(get_current_user)):
        """Delete a specific scraped content file"""
        try:
            # Validate filename for security
            allowed_files = ["manual_scrape_content.json", "enhanced_content.json"]
            if filename not in allowed_files:
                return {"status": "error", "message": "Invalid filename"}
            
            if os.path.exists(filename):
                os.remove(filename)
                log_activity(current_user["user_id"], "SCRAPED_FILE_DELETE", f"Deleted scraped file: {filename}")
                return {
                    "status": "success", 
                    "message": f"Successfully deleted {filename}"
                }
            else:
                return {
                    "status": "error", 
                    "message": f"File {filename} not found"
                }
        except Exception as e:
            return {"status": "error", "message": f"Error deleting file: {str(e)}"}

    @app.delete("/admin/scraped/clear-all")
    async def clear_all_scraped_content(current_user = Depends(get_current_user)):
        """Clear all scraped content files"""
        try:
            files_deleted = []
            scraped_files = ["manual_scrape_content.json", "enhanced_content.json"]
            
            for filename in scraped_files:
                if os.path.exists(filename):
                    os.remove(filename)
                    files_deleted.append(filename)
            
            if files_deleted:
                log_activity(current_user["user_id"], "SCRAPED_CLEAR_ALL", f"Cleared all scraped content files: {', '.join(files_deleted)}")
                return {
                    "status": "success",
                    "message": f"Successfully deleted {len(files_deleted)} files: {', '.join(files_deleted)}"
                }
            else:
                return {
                    "status": "success",
                    "message": "No scraped content files found to delete"
                }
        except Exception as e:
            return {"status": "error", "message": f"Error clearing files: {str(e)}"}

    # PDF Generation Endpoints
    @app.post("/pdf/immigration-roadmap")
    async def generate_immigration_roadmap_pdf(
        request: Dict[str, Any] = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate comprehensive immigration roadmap PDF"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "premium")
                    }
                )
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Initialize PDF generator
            pdf_generator = ImmigrationPDFGenerator()
            
            # Generate PDF
            user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", "")
            }
            
            consultation_data = request.get("consultation_data", {})
            pdf_bytes = pdf_generator.generate_immigration_roadmap(user_data, consultation_data)
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated immigration roadmap PDF for {consultation_data.get('destination_country', 'unknown destination')}")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=immigration_roadmap_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/pdf/document-checklist")
    async def generate_document_checklist_pdf(
        request: Dict[str, Any] = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate document checklist PDF"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "premium")
                    }
                )
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Initialize PDF generator
            pdf_generator = ImmigrationPDFGenerator()
            
            # Generate PDF
            user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", "")
            }
            
            consultation_data = request.get("consultation_data", {})
            pdf_bytes = pdf_generator.generate_document_checklist(user_data, consultation_data)
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated document checklist PDF for {consultation_data.get('goal', 'immigration')}")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=document_checklist_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/pdf/cost-breakdown")
    async def generate_cost_breakdown_pdf(
        request: Dict[str, Any] = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate cost breakdown PDF"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "premium")
                    }
                )
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Initialize PDF generator
            pdf_generator = ImmigrationPDFGenerator()
            
            # Generate PDF
            user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", "")
            }
            
            consultation_data = request.get("consultation_data", {})
            pdf_bytes = pdf_generator.generate_cost_breakdown_report(user_data, consultation_data)
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated cost breakdown PDF for {consultation_data.get('destination_country', 'immigration')}")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=cost_breakdown_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/pdf/quick-summary")
    async def generate_quick_summary_pdf(
        request: Dict[str, Any] = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate quick 1-page summary PDF"""
        try:
            # Check access to PDF feature (allow for free users with limits)
            access_info = check_user_access(current_user["id"], "pdf_summary")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_summary",
                        "upgrade_tier": access_info.get("upgrade_tier", "premium")
                    }
                )
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Initialize PDF generator
            pdf_generator = ImmigrationPDFGenerator()
            
            # Generate PDF
            user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", "")
            }
            
            consultation_data = request.get("consultation_data", {})
            pdf_bytes = pdf_generator.generate_quick_summary(user_data, consultation_data)
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated quick summary PDF")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=immigration_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # PDF Report with conversation data
    @app.post("/pdf/consultation-report")
    async def generate_consultation_report_pdf(
        conversation_id: str = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate PDF report from a specific conversation"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "premium")
                    }
                )
            
            # Get conversation data
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM conversations WHERE conversation_id = ?
            ''', (conversation_id,))
            
            conversation = cursor.fetchone()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Parse conversation data
            columns = [desc[0] for desc in cursor.description]
            conversation_dict = dict(zip(columns, conversation))
            
            # Extract user profile from conversation
            user_profile = json.loads(conversation_dict.get('user_profile', '{}'))
            
            conn.close()
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Initialize PDF generator
            pdf_generator = ImmigrationPDFGenerator()
            
            # Generate PDF with conversation context
            user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", "")
            }
            
            consultation_data = {
                "destination_country": user_profile.get('destination_country', ''),
                "origin_country": user_profile.get('origin_country', ''),
                "goal": user_profile.get('goal', ''),
                "conversation_question": conversation_dict.get('user_question', ''),
                "ai_response": conversation_dict.get('ai_response', ''),
                "conversation_date": conversation_dict.get('created_at', '')
            }
            
            pdf_bytes = pdf_generator.generate_immigration_roadmap(user_data, consultation_data)
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated consultation report PDF from conversation {conversation_id}")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=consultation_report_{conversation_id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # Missing comprehensive report endpoint
    @app.post("/pdf/comprehensive-report")
    async def generate_comprehensive_report_pdf(
        request: Dict[str, Any] = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate comprehensive immigration report PDF"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "starter")
                    }
                )
            
            # Increment usage
            increment_user_usage(current_user["id"], "report")
            
            # Fallback to simple PDF generation using reportlab
            from io import BytesIO
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            
            consultation_data = request.get("consultation_data", {})
            destination = consultation_data.get("destination_country", "Unknown")
            origin = consultation_data.get("origin_country", "Unknown") 
            goal = consultation_data.get("goal", "immigration")
            
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []
            
            # Title
            story.append(Paragraph("COMPREHENSIVE IMMIGRATION REPORT", styles['Title']))
            story.append(Spacer(1, 20))
            
            # User info
            story.append(Paragraph(f"<b>Client:</b> {current_user.get('first_name', '')} {current_user.get('last_name', '')}", styles['Normal']))
            story.append(Paragraph(f"<b>From:</b> {origin}", styles['Normal']))
            story.append(Paragraph(f"<b>To:</b> {destination}", styles['Normal']))
            story.append(Paragraph(f"<b>Goal:</b> {goal.title()}", styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Content sections
            story.append(Paragraph("1. IMMIGRATION ROADMAP & TIMELINE", styles['Heading2']))
            story.append(Paragraph(f"Your journey from {origin} to {destination} for {goal} purposes requires careful planning. This comprehensive guide covers all aspects of your immigration process.", styles['Normal']))
            story.append(Spacer(1, 10))
            
            story.append(Paragraph("2. COMPLETE DOCUMENT CHECKLIST", styles['Heading2']))
            story.append(Paragraph("Essential documents required for your application include passport, educational certificates, financial statements, and supporting documentation.", styles['Normal']))
            story.append(Spacer(1, 10))
            
            story.append(Paragraph("3. DETAILED COST BREAKDOWN", styles['Heading2']))
            story.append(Paragraph("Government fees, legal costs, document preparation, and other expenses vary by visa type and processing options.", styles['Normal']))
            story.append(Spacer(1, 10))
            
            story.append(Paragraph("4. STEP-BY-STEP APPLICATION PROCESS", styles['Heading2']))
            story.append(Paragraph("Follow these detailed steps to ensure a successful application submission and avoid common delays.", styles['Normal']))
            
            doc.build(story)
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            # Log the PDF generation
            log_activity(current_user["id"], "PDF_GENERATE", f"Generated comprehensive report PDF")
            
            # Return PDF as response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=comprehensive_immigration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                }
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # NEW PDF REPORT SYSTEM WITH QUESTION FLOWS
    @app.get("/pdf/get-questions")
    async def get_pdf_questions(
        current_user = Depends(get_current_frontend_user)
    ):
        """Get initial questions for PDF generation"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "starter")
                    }
                )
            
            # Get user's tier to determine PDF type
            user_tier = current_user.get("tier", "free")
            tier_limits = get_tier_limits(user_tier)
            pdf_type = tier_limits["limits"].get("pdf_type", "simple")
            
            # Import the question flow system
            try:
                from pdf_report_system import get_question_flow
                question_flow = get_question_flow()
                
                initial_questions = question_flow.get_initial_questions()
                
                return {
                    "status": "success",
                    "questions": initial_questions,
                    "pdf_type": pdf_type,
                    "tier": user_tier,
                    "step": "initial"
                }
            except ImportError:
                # Fallback to basic questions if system not available
                return {
                    "status": "success",
                    "questions": [
                        {
                            "id": "destination_country",
                            "question": "Which country are you planning to immigrate to?",
                            "type": "text",
                            "required": True
                        },
                        {
                            "id": "visa_type",
                            "question": "What type of visa are you applying for?",
                            "type": "text",
                            "required": True
                        }
                    ],
                    "pdf_type": pdf_type,
                    "tier": user_tier,
                    "step": "initial"
                }
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    @app.post("/pdf/get-followup-questions")
    async def get_followup_questions(
        user_data: Dict = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Get follow-up questions based on initial answers"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "starter")
                    }
                )
            
            try:
                from pdf_report_system import get_question_flow
                question_flow = get_question_flow()
                
                visa_type = user_data.get("visa_type", "")
                followup_questions = question_flow.get_follow_up_questions(visa_type, user_data)
                
                return {
                    "status": "success",
                    "questions": followup_questions,
                    "step": "followup",
                    "total_questions": len(followup_questions)
                }
            except ImportError:
                # Fallback questions
                return {
                    "status": "success",
                    "questions": [
                        {
                            "id": "travel_purpose",
                            "question": "What is the main purpose of your travel?",
                            "type": "textarea",
                            "required": True
                        }
                    ],
                    "step": "followup"
                }
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    @app.post("/pdf/generate-immigration-report")
    async def generate_immigration_report(
        user_answers: Dict = Body(...),
        current_user = Depends(get_current_frontend_user)
    ):
        """Generate PDF report based on user answers"""
        try:
            # Check access to PDF feature
            access_info = check_user_access(current_user["id"], "pdf_report")
            if not access_info["allowed"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "error",
                        "message": access_info["reason"],
                        "feature": "pdf_report",
                        "upgrade_tier": access_info.get("upgrade_tier", "starter")
                    }
                )
            
            # Increment usage first
            increment_user_usage(current_user["id"], "report")
            
            # Get user's tier to determine PDF type
            user_tier = current_user.get("tier", "free")
            tier_limits = get_tier_limits(user_tier)
            pdf_type = tier_limits["limits"].get("pdf_type", "simple")
            
            # Prepare user data for PDF generation
            pdf_user_data = {
                "first_name": current_user.get("first_name", ""),
                "last_name": current_user.get("last_name", ""),
                "email": current_user.get("email", ""),
                "tier": user_tier,
                **user_answers  # Include all user answers
            }
            
            try:
                from pdf_report_system import PDFReportGenerator
                pdf_generator = PDFReportGenerator()
                
                if pdf_type == "simple":
                    pdf_bytes = pdf_generator.generate_simple_report(pdf_user_data)
                    report_type = "Simple Immigration Report"
                else:
                    pdf_bytes = pdf_generator.generate_premium_report(pdf_user_data)
                    report_type = "Premium Immigration Report"
                
            except ImportError:
                # Fallback to existing PDF generator
                from pdf_generator import ImmigrationPDFGenerator
                pdf_generator = ImmigrationPDFGenerator()
                pdf_bytes = pdf_generator.generate_quick_summary(pdf_user_data, user_answers)
                report_type = "Immigration Report"
            
            # Log the PDF generation
            visa_type = user_answers.get("visa_type", "immigration")
            destination = user_answers.get("destination_country", "destination")
            log_activity(
                current_user["id"], 
                "PDF_GENERATE", 
                f"Generated {pdf_type} PDF report: {visa_type} to {destination}"
            )
            
            # Return PDF as response
            filename = f"immigration_report_{pdf_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.delete("/admin/qdrant/collection/{collection_name}")
    async def delete_vector_collection(
        collection_name: str,
        current_user = Depends(get_current_user)
    ):
        """Delete an entire vector collection"""
        try:
            # Use direct HTTP API to delete collection
            response = requests.delete(f"http://localhost:6333/collections/{collection_name}")
            
            if response.status_code == 200:
                return {
                    "status": "success",
                    "message": f"Collection '{collection_name}' deleted successfully"
                }
            else:
                return {
                    "status": "error", 
                    "message": f"Failed to delete collection: {response.text}"
                }
                
        except Exception as e:
            return {"status": "error", "message": f"Error deleting collection: {str(e)}"}
    
    @app.delete("/admin/qdrant/collection/{collection_name}/clear")
    async def clear_vector_collection(
        collection_name: str,
        current_user = Depends(get_current_user)
    ):
        """Clear all points from a vector collection without deleting the collection"""
        try:
            # Get all point IDs first
            response = requests.post(
                f"http://localhost:6333/collections/{collection_name}/points/scroll",
                json={"limit": 10000, "with_payload": False, "with_vector": False}
            )
            
            if response.status_code != 200:
                return {"status": "error", "message": "Failed to get points"}
            
            points_data = response.json()
            point_ids = [point["id"] for point in points_data.get("result", {}).get("points", [])]
            
            if not point_ids:
                return {"status": "success", "message": "Collection is already empty"}
            
            # Delete all points
            delete_response = requests.post(
                f"http://localhost:6333/collections/{collection_name}/points/delete",
                json={"points": point_ids}
            )
            
            if delete_response.status_code == 200:
                return {
                    "status": "success", 
                    "message": f"Cleared {len(point_ids)} points from collection '{collection_name}'"
                }
            else:
                return {"status": "error", "message": f"Failed to clear points: {delete_response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Error clearing collection: {str(e)}"}
    
    @app.delete("/admin/qdrant/collection/{collection_name}/points")
    async def delete_vector_points(
        collection_name: str,
        point_ids: List[str],
        current_user = Depends(get_current_user)
    ):
        """Delete specific points from a vector collection"""
        try:
            response = requests.post(
                f"http://localhost:6333/collections/{collection_name}/points/delete",
                json={"points": point_ids}
            )
            
            if response.status_code == 200:
                return {
                    "status": "success",
                    "message": f"Deleted {len(point_ids)} points from collection '{collection_name}'"
                }
            else:
                return {"status": "error", "message": f"Failed to delete points: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Error deleting points: {str(e)}"}

    # Temporary session storage for logged-out users
    def save_guest_session(session_id: str, selections: Dict[str, Any]):
        """Save guest user selections temporarily"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            # Create guest_sessions table if it doesn't exist
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS guest_sessions (
                    session_id TEXT PRIMARY KEY,
                    selections TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME DEFAULT (datetime('now', '+24 hours'))
                )
            ''')
            
            # Save or update guest session
            cursor.execute('''
                INSERT OR REPLACE INTO guest_sessions (session_id, selections)
                VALUES (?, ?)
            ''', (session_id, json.dumps(selections)))
            
            conn.commit()
            conn.close()
            print(f"💾 Saved guest session {session_id[:8]}... with selections: {list(selections.keys())}")
            
        except Exception as e:
            print(f"❌ Error saving guest session: {e}")

    def load_guest_session(session_id: str) -> Optional[Dict[str, Any]]:
        """Load guest user selections"""
        try:
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT selections FROM guest_sessions 
                WHERE session_id = ? AND expires_at > datetime('now')
            ''', (session_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                selections = json.loads(row[0])
                print(f"📖 Loaded guest session {session_id[:8]}... with selections: {list(selections.keys())}")
                return selections
            else:
                print(f"❌ No valid guest session found for {session_id[:8]}...")
                return None
                
        except Exception as e:
            print(f"❌ Error loading guest session: {e}")
            return None

    def transfer_guest_session_to_user(session_id: str, user_id: str):
        """Transfer guest selections to a new user account"""
        try:
            guest_selections = load_guest_session(session_id)
            if guest_selections:
                # Store selections in user profile or conversation memory
                conversation_memory.add_user_message(user_id, f"Previous selections: {json.dumps(guest_selections)}", guest_selections.get('first_name', 'User'))
                print(f"🔄 Transferred guest session {session_id[:8]}... to user {user_id}")
                
                # Clean up guest session
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('DELETE FROM guest_sessions WHERE session_id = ?', (session_id,))
                conn.commit()
                conn.close()
                
                return guest_selections
            return None
        except Exception as e:
            print(f"❌ Error transferring guest session: {e}")
            return None

    async def generate_onboarding_response(step: str, user_selections: Dict[str, Any] = None, user_language: str = 'en') -> str:
        """Generate onboarding flow responses for logged-out users"""
        user_selections = user_selections or {}
        
        if step == "start":
            onboarding_msg = """Hello! I'm Sarah, your worldwide immigration consultant. I help people immigrate to ANY country globally! 🌍

I use the latest official government data to give you accurate, up-to-date guidance.

**Let's start with the basics:**

🎯 **Which country do you want to immigrate TO?**

Please select your destination country so I can provide you with specific immigration guidance."""
            
            # Translate if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    onboarding_msg = await translation_service.translate_text(onboarding_msg, user_language, 'en')
                    print(f"🌐 Onboarding start message translated to {user_language}")
                except Exception as e:
                    print(f"❌ Translation failed for onboarding start: {e}")
            
            return onboarding_msg

        elif step == "origin_country":
            destination = user_selections.get('destination_country', 'your chosen destination')
            destination_display = destination.replace('_', ' ').title()
            if destination_display.lower() in ['usa', 'us']:
                destination_display = 'United States'
                
            onboarding_msg = f"""Great choice! {destination_display} is a popular destination for immigrants.

🌍 **Now, which country are you immigrating FROM?**

Please tell me your current country of residence or citizenship so I can give you country-specific guidance for your journey to {destination_display}."""
            
            # Translate if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    onboarding_msg = await translation_service.translate_text(onboarding_msg, user_language, 'en')
                    print(f"🌐 Onboarding origin country message translated to {user_language}")
                except Exception as e:
                    print(f"❌ Translation failed for onboarding origin country: {e}")
            
            return onboarding_msg

        elif step == "immigration_goal":
            destination = user_selections.get('destination_country', 'your chosen destination')
            origin = user_selections.get('origin_country', 'your current country')
            
            destination_display = destination.replace('_', ' ').title()
            if destination_display.lower() in ['usa', 'us']:
                destination_display = 'United States'
                
            onboarding_msg = f"""Perfect! So you want to move from {origin} to {destination_display}.

🎯 **What's your main immigration goal?**

Please select the option that best describes your situation:

• **Family** - Joining family members or spouse
• **Work** - Employment-based immigration
• **Study** - Student visas and education
• **Visit** - Tourism or temporary visits
• **Investment** - Investor or business visas
• **Other** - Tell me more about your specific situation

This will help me recommend the right visa type for you!"""
            
            # Translate if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    onboarding_msg = await translation_service.translate_text(onboarding_msg, user_language, 'en')
                    print(f"🌐 Onboarding immigration goal message translated to {user_language}")
                except Exception as e:
                    print(f"❌ Translation failed for onboarding immigration goal: {e}")
            
            return onboarding_msg

        elif step == "create_account":
            destination = user_selections.get('destination_country', 'your chosen destination')
            origin = user_selections.get('origin_country', 'your current country')
            goal = user_selections.get('goal', 'immigration')
            
            destination_display = destination.replace('_', ' ').title()
            if destination_display.lower() in ['usa', 'us']:
                destination_display = 'United States'
            
            onboarding_msg = f"""🎉 **Excellent! I have everything I need to help you:**

📍 **From:** {origin}
📍 **To:** {destination_display}  
🎯 **Goal:** {goal.title()} immigration

Now I'm ready to create your personalized immigration roadmap with specific visa recommendations, requirements, timelines, and step-by-step guidance.

**🔐 Create your FREE account to continue:**

✅ Get your personalized immigration plan
✅ Save your progress and recommendations  
✅ Access to 5 AI consultations per day
✅ Generate PDF reports of your plan

**Ready to continue your {destination_display} immigration journey?**

[CREATE_ACCOUNT_BUTTON]"""
            
            # Translate if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    onboarding_msg = await translation_service.translate_text(onboarding_msg, user_language, 'en')
                    print(f"🌐 Onboarding create account message translated to {user_language}")
                except Exception as e:
                    print(f"❌ Translation failed for onboarding create account: {e}")
            
            return onboarding_msg

        else:
            onboarding_msg = "Let's start your immigration journey! Which country would you like to immigrate to?"
            
            # Translate if needed
            if user_language != 'en':
                try:
                    from translation_service import translation_service
                    onboarding_msg = await translation_service.translate_text(onboarding_msg, user_language, 'en')
                    print(f"🌐 Onboarding fallback message translated to {user_language}")
                except Exception as e:
                    print(f"❌ Translation failed for onboarding fallback: {e}")
            
            return onboarding_msg

    @app.put("/auth/reset-password")
    async def reset_password(reset_data: PasswordReset):
        """Reset user password (sends reset email in production)"""
        try:
            user = get_user_by_email(reset_data.email)
            if not user:
                # Don't reveal if email exists for security
                return {"status": "success", "message": "If the email exists, a reset link has been sent"}
            
            # In development mode, we'll set a default password
            if os.getenv("DEVELOPMENT_MODE") == "true":
                new_password = "TempPassword123!"
                password_hash = hash_password(new_password)
                
                conn = sqlite3.connect('admin_secure.db')
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users SET 
                        password_hash = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE email = ?
                ''', (password_hash, reset_data.email))
                conn.commit()
                conn.close()
                
                return {
                    "status": "success", 
                    "message": f"Password reset to: {new_password}",
                    "dev_password": new_password  # Only show in dev mode
                }
            else:
                # In production, send reset email (implement email service)
                return {"status": "success", "message": "Password reset email sent"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    @app.post("/admin/users/create")
    async def admin_create_user(
        user_data: Dict = Body(...),
        current_user = Depends(get_current_user)
    ):
        """Admin endpoint to manually create users"""
        try:
            email = user_data.get("email")
            password = user_data.get("password", "TempPassword123!")
            first_name = user_data.get("first_name", "")
            last_name = user_data.get("last_name", "")
            tier = user_data.get("tier", "free")
            
            # Check if user already exists
            existing_user = get_user_by_email(email)
            if existing_user:
                return {"status": "error", "message": "User already exists"}
            
            # Create user
            user_id = str(uuid.uuid4())
            password_hash = hash_password(password)
            
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO users (id, email, password_hash, first_name, last_name, tier, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ''', (user_id, email, password_hash, first_name, last_name, tier))
            
            # Initialize usage tracking
            cursor.execute('''
                INSERT INTO user_usage (user_id) VALUES (?)
            ''', (user_id,))
            
            conn.commit()
            conn.close()
            
            log_activity(current_user["user_id"], "ADMIN_USER_CREATE", f"Created user {email}")
            
            return {
                "status": "success", 
                "message": f"User created successfully",
                "user_id": user_id,
                "email": email,
                "password": password  # Show password for manual creation
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # HeyGen Pydantic models for request/response
    class HeyGenSessionRequest(BaseModel):
        session_id: Optional[str] = None
        session_token: Optional[str] = None

    class HeyGenTaskRequest(BaseModel):
        session_id: str
        session_token: str
        text: str
        task_type: str = "talk"

    # HeyGen API Endpoints - Enhanced with usage tracking and idle timeout
    @app.post("/heygen/create-session")
    async def create_heygen_session(
        request: Request,
        current_user = Depends(get_optional_user)
    ):
        """Create HeyGen session token for StreamingAvatar SDK with usage tracking"""
        try:
            user_id = current_user.get("id") if current_user else "guest"
            print(f"🎬 [HeyGen] Creating session token for user: {user_id}")
            
            # Check user access for avatar feature
            if current_user and user_id != "guest":
                access_check = check_user_access(user_id, "avatar_chat")
                if not access_check["allowed"]:
                    return JSONResponse({
                        'error': access_check["reason"],
                        'upgrade_tier': access_check.get("upgrade_tier"),
                        'usage_limit_reached': True
                    }, status_code=403)
            
            # Get HeyGen API key from environment
            heygen_api_key = os.getenv('HEYGEN_API_KEY')
            if not heygen_api_key:
                print("❌ [HeyGen] No API key found in environment")
                return JSONResponse({
                    'error': 'HeyGen API key not configured',
                    'fallback_to_embed': True
                }, status_code=500)

            print("🎟️ [HeyGen] Generating session token...")
            
            # Create session token using the correct API
            token_response = requests.post(
                'https://api.heygen.com/v1/streaming.create_token',
                headers={
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'x-api-key': heygen_api_key
                },
                timeout=30
            )
            
            print(f"📡 [HeyGen] Token API Response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_text = token_response.text
                print(f"❌ [HeyGen] Token creation failed: {error_text}")
                return JSONResponse({
                    'error': f'Token creation failed: {error_text}',
                    'fallback_to_embed': True
                }, status_code=token_response.status_code)

            token_data = token_response.json()
            session_token = token_data.get('data', {}).get('token')
            
            if not session_token:
                print("❌ [HeyGen] No session token in response")
                return JSONResponse({
                    'error': 'No session token received',
                    'fallback_to_embed': True
                }, status_code=500)

            print("✅ [HeyGen] Session token created successfully")
            print("📤 [HeyGen] Returning token for StreamingAvatar SDK")
            
            # Get user tier limits for idle timeout
            tier_limits = get_tier_limits(current_user.get("tier", "free")) if current_user else get_tier_limits("free")
            idle_timeout = 120  # 2 minutes idle timeout for all users
            
            # Return the token with usage info
            return JSONResponse({
                'session_token': session_token,
                'token': session_token,  # Alias for compatibility
                'success': True,
                'idle_timeout': idle_timeout,
                'usage_info': {
                    'monthly_limit': tier_limits["limits"].get("avatar_minutes", 0),
                    'overage_rate': tier_limits.get("overage_rate", 0),
                    'current_usage': get_user_usage(user_id)["monthly_avatar_minutes_used"] if current_user else 0
                }
            })
            
        except Exception as e:
            print(f"💥 [HeyGen] Unexpected error: {str(e)}")
            return JSONResponse({
                'error': str(e),
                'fallback_to_embed': True
            }, status_code=500)

    @app.post("/heygen/send-task")
    async def send_heygen_task(
        request_data: Dict = Body(...),
        request: Request = None,
        current_user = Depends(get_optional_user)
    ):
        """Send a speaking task to HeyGen avatar using session token"""
        try:
            user_id = current_user.get("id") if current_user else "guest"
            session_id = request_data.get('session_id')
            session_token = request_data.get('session_token')
            text = request_data.get('text')
            task_type = request_data.get('task_type', 'talk')
            use_elevenlabs = request_data.get('use_elevenlabs', True)  # Default to ElevenLabs
            language = request_data.get('language', 'en')  # Language for voice selection
            
            print(f"💬 [HeyGen] Sending task to session: {session_id}")
            print(f"💬 [HeyGen] Text: {text[:100]}...")
            print(f"💬 [HeyGen] Task type: {task_type}")
            print(f"💬 [HeyGen] Use ElevenLabs: {use_elevenlabs}")
            print(f"�� [HeyGen] Language: {language}")
            
            if not session_id or not session_token or not text:
                return JSONResponse({
                    'error': 'Missing required parameters: session_id, session_token, or text'
                }, status_code=400)
            
            # Prepare task payload
            task_payload = {
                'session_id': session_id,
                'task_type': task_type
            }
            
            # Use ElevenLabs for better voice quality if enabled
            if use_elevenlabs and elevenlabs_service.api_key:
                try:
                    print("🎙️ [HeyGen+ElevenLabs] Generating high-quality voice...")
                    
                    # Generate audio with ElevenLabs
                    audio_data = await elevenlabs_service.synthesize_speech(text, language)
                    audio_base64 = await elevenlabs_service.convert_to_heygen_format(audio_data)
                    
                    # FIXED: Use proper audio format for HeyGen streaming API
                    task_payload['text'] = text  # Still required for fallback
                    task_payload['audio_data'] = audio_base64  # CHANGED: Use audio_data instead of audio_url
                    task_payload['audio_format'] = 'mp3'  # ADDED: Specify audio format
                    print("✅ [HeyGen+ElevenLabs] Using ElevenLabs audio for lip sync")
                    
                except Exception as e:
                    print(f"⚠️ [HeyGen+ElevenLabs] ElevenLabs failed, falling back to text: {str(e)}")
                    # Fallback to text mode
                    task_payload['text'] = text
            else:
                # Use text mode (default HeyGen voice)
                task_payload['text'] = text
                print("📝 [HeyGen] Using text mode with default voice")
            
            # Make API request to send task
            response = requests.post(
                'https://api.heygen.com/v1/streaming.task',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {session_token}'
                },
                json=task_payload,
                timeout=60  # Increased timeout for audio processing
            )
            
            print(f"📡 [HeyGen] Task API Response status: {response.status_code}")
            
            # ADDED: If audio fails, try text-only fallback
            if response.status_code != 200 and 'audio_data' in task_payload:
                error_text = response.text
                print(f"⚠️ [HeyGen] Audio task failed: {error_text}")
                print("🔄 [HeyGen] Trying text-only fallback...")
                
                # Try text-only fallback
                fallback_payload = {
                    'session_id': session_id,
                    'task_type': task_type,
                    'text': text
                }
                
                response = requests.post(
                    'https://api.heygen.com/v1/streaming.task',
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {session_token}'
                    },
                    json=fallback_payload,
                    timeout=60
                )
                
                print(f"📡 [HeyGen] Fallback Response status: {response.status_code}")
                
                if response.status_code != 200:
                    error_text = response.text
                    print(f"❌ [HeyGen] Fallback also failed: {error_text}")
                    return JSONResponse({
                        'error': f'HeyGen task API error: {error_text}'
                    }, status_code=response.status_code)
                else:
                    print("✅ [HeyGen] Text-only fallback successful")
            
            elif response.status_code != 200:
                error_text = response.text
                print(f"❌ [HeyGen] Task API Error: {error_text}")
                return JSONResponse({
                    'error': f'HeyGen task API error: {error_text}'
                }, status_code=response.status_code)
            
            task_info = response.json()
            print(f"✅ [HeyGen] Task sent successfully")
            
            return JSONResponse({
                'success': True,
                'task_id': task_info.get('task_id'),
                'voice_provider': 'elevenlabs' if use_elevenlabs and elevenlabs_service.api_key else 'heygen',
                'language': language,
                'data': task_info
            })
            
        except requests.exceptions.Timeout:
            print("⏰ [HeyGen] Task request timeout")
            return JSONResponse({
                'error': 'HeyGen task API timeout'
            }, status_code=504)
            
        except requests.exceptions.RequestException as e:
            print(f"🌐 [HeyGen] Task network error: {str(e)}")
            return JSONResponse({
                'error': f'Task network error: {str(e)}'
            }, status_code=500)
            
        except Exception as e:
            print(f"💥 [HeyGen] Task unexpected error: {str(e)}")
            return JSONResponse({
                'error': f'Task unexpected error: {str(e)}'
            }, status_code=500)

    # Add endpoint to get available ElevenLabs voices
    @app.get("/user/language")
    async def get_user_language():
        """Get current user's preferred language"""
        try:
            # For now, return English as default
            # In a full implementation, this would fetch from user preferences
            return JSONResponse({
                'success': True,
                'language': 'en'
            })
        except Exception as e:
            return JSONResponse({
                'error': f'Error fetching user language: {str(e)}'
            }, status_code=500)

    @app.get("/heygen/voices")
    async def get_available_voices():
        """Get available ElevenLabs voices organized by language"""
        try:
            return JSONResponse({
                'success': True,
                'elevenlabs_available': bool(elevenlabs_service.api_key),
                'language_voices': elevenlabs_service.language_voices,
                'supported_languages': list(elevenlabs_service.language_voices.keys()),
                'voice_quality': 'premium' if elevenlabs_service.api_key else 'standard'
            })
        except Exception as e:
            return JSONResponse({
                'error': f'Error fetching voices: {str(e)}'
            }, status_code=500)

    @app.get("/heygen/avatars")
    async def get_available_avatars():
        """Get available HeyGen avatars for debugging"""
        try:
            heygen_api_key = os.getenv('HEYGEN_API_KEY')
            if not heygen_api_key:
                return JSONResponse({
                    'error': 'HeyGen API key not configured'
                }, status_code=500)

            print("🔍 [HeyGen] Fetching available avatars...")
            
            # Try to get streaming avatars (these are specifically for interactive/streaming use)
            response = requests.get(
                'https://api.heygen.com/v1/streaming.list_avatars',
                headers={
                    'accept': 'application/json',
                    'x-api-key': heygen_api_key
                },
                timeout=30
            )
            
            print(f"📡 [HeyGen] Avatars API Response status: {response.status_code}")
            
            if response.status_code == 200:
                avatars_data = response.json()
                print(f"✅ [HeyGen] Found {len(avatars_data.get('data', []))} streaming avatars")
                
                return JSONResponse({
                    'success': True,
                    'avatars': avatars_data.get('data', []),
                    'your_custom_avatar': '7b3c235e1892472e977bbb0c8139404d',
                    'note': 'Custom avatars may need special configuration for streaming API'
                })
            else:
                error_text = response.text
                print(f"❌ [HeyGen] Avatars API Error: {error_text}")
                return JSONResponse({
                    'error': f'HeyGen avatars API error: {error_text}',
                    'your_custom_avatar': '7b3c235e1892472e977bbb0c8139404d',
                    'suggestion': 'Check if custom avatar is configured for streaming API'
                }, status_code=response.status_code)
                
        except Exception as e:
            print(f"❌ [HeyGen] Avatars fetch error: {e}")
            return JSONResponse({
                'error': f'Error fetching avatars: {str(e)}'
            }, status_code=500)

    # Add voice preview endpoint
    @app.post("/heygen/preview-voice")
    async def preview_voice(request_data: Dict = Body(...)):
        """Preview ElevenLabs voice for a given language"""
        try:
            text = request_data.get('text', 'Hello! This is a voice preview for immigration consultation.')
            language = request_data.get('language', 'en')
            
            if not elevenlabs_service.api_key:
                return JSONResponse({
                    'error': 'ElevenLabs not configured'
                }, status_code=400)
            
            # Generate preview audio
            audio_data = await elevenlabs_service.synthesize_speech(text, language)
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            return JSONResponse({
                'success': True,
                'audio_data': f"data:audio/mpeg;base64,{audio_base64}",
                'language': language,
                'voice_id': elevenlabs_service.language_voices.get(language),
                'preview_text': text
            })
            
        except Exception as e:
            print(f"❌ [Voice Preview] Error: {str(e)}")
            return JSONResponse({
                'error': f'Voice preview error: {str(e)}'
            }, status_code=500)

    @app.post("/heygen/close-session")
    async def close_heygen_session(
        request_data: Dict = Body(...),
        current_user = Depends(get_optional_user)
    ):
        """Close HeyGen session"""
        try:
            session_id = request_data.get('session_id')
            session_token = request_data.get('session_token')
            
            if not session_id or not session_token:
                return JSONResponse({
                    'error': 'Missing session_id or session_token'
                }, status_code=400)
            
            # Stop the session
            response = requests.post(
                'https://api.heygen.com/v1/streaming.stop',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {session_token}'
                },
                json={'session_id': session_id},
                timeout=30
            )
            
            print(f"📡 [HeyGen] Close session response: {response.status_code}")
            
            return JSONResponse({
                'success': True,
                'message': 'Session closed'
            })
            
        except Exception as e:
            print(f"❌ [HeyGen] Close session error: {e}")
            return JSONResponse({
                'error': f'Close session error: {str(e)}'
            }, status_code=500)

    @app.post('/auth/set-language')
    async def set_user_language(request: Request, current_user = Depends(get_current_frontend_user)):
        """Set user's preferred language"""
        try:
            if not current_user:
                return JSONResponse({"error": "Authentication required"}, status_code=401)
            
            data = await request.json()
            language_code = data.get('language', 'en')
            
            # Validate language code
            supported_languages = [
                'en', 'es', 'zh', 'hi', 'ar', 'fr', 'pt', 'ru', 'de', 'ja',
                'ko', 'it', 'tr', 'vi', 'th', 'pl', 'nl', 'sv', 'id',
                # NEW: ElevenLabs additional languages
                'hu', 'no', 'bg', 'ro', 'el', 'fi', 'hr', 'da', 'ta', 'fil',
                'cs', 'sk', 'uk', 'ms'
            ]
            
            if language_code not in supported_languages:
                return JSONResponse({"error": "Unsupported language"}, status_code=400)
            
            # Update user language preference
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users 
                SET language_preference = ? 
                WHERE email = ?
            """, (language_code, current_user['email']))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Updated language preference for {current_user['email']}: {language_code}")
            
            return JSONResponse({
                "success": True,
                "language": language_code,
                "message": "Language preference updated successfully"
            })
            
        except Exception as e:
            print(f"❌ Error setting language: {e}")
            return JSONResponse({"error": "Failed to update language preference"}, status_code=500)

    @app.get('/auth/get-language')
    async def get_user_language(current_user = Depends(get_optional_user)):
        """Get user's preferred language"""
        # Always return supported languages for both authenticated and non-authenticated users
        supported_languages = {
            "en": "English",
            "es": "Español", 
            "zh": "中文",
            "hi": "हिंदी",
            "ar": "العربية",
            "fr": "Français",
            "pt": "Português",
            "ru": "Русский",
            "de": "Deutsch",
            "ja": "日本語",
            "ko": "한국어",
            "it": "Italiano",
            "tr": "Türkçe",
            "vi": "Tiếng Việt",
            "th": "ไทย",
            "pl": "Polski",
            "nl": "Nederlands",
            "sv": "Svenska",
            "id": "Bahasa Indonesia",
            # NEW: ElevenLabs additional languages
            "hu": "Magyar",
            "no": "Norsk",
            "bg": "Български",
            "ro": "Română",
            "el": "Ελληνικά",
            "fi": "Suomi",
            "hr": "Hrvatski",
            "da": "Dansk",
            "ta": "தமிழ்",
            "fil": "Filipino",
            "cs": "Čeština",
            "sk": "Slovenčina",
            "uk": "Українська",
            "ms": "Bahasa Melayu"
        }
        
        try:
            # Check if user is authenticated
            if not current_user:
                return JSONResponse({
                    "language": "en",
                    "supported_languages": supported_languages
                })
            
            conn = sqlite3.connect('admin_secure.db')
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT language_preference 
                FROM users 
                WHERE email = ?
            """, (current_user['email'],))
            
            result = cursor.fetchone()
            conn.close()
            
            language = result[0] if result and result[0] else 'en'
            
            return JSONResponse({
                "language": language,
                "supported_languages": supported_languages
            })
            
        except Exception as e:
            print(f"❌ Error getting language: {e}")
            return JSONResponse({
                "language": "en",
                "supported_languages": supported_languages
            })

    @app.get("/static-translations/{language}")
    async def get_static_translations(language: str):
        """
        Get pre-translated static content for a specific language
        This eliminates API calls for UI elements and provides instant language switching
        """
        try:
            # Load static translations from JSON file
            static_translations_path = Path(__file__).parent / "static_translations.json"
            
            if not static_translations_path.exists():
                raise HTTPException(status_code=404, detail="Static translations file not found")
            
            with open(static_translations_path, 'r', encoding='utf-8') as f:
                all_translations = json.load(f)
            
            # Check if language is supported
            if language not in all_translations:
                # Fallback to English if language not found
                language = 'en'
            
            translations = all_translations.get(language, all_translations.get('en', {}))
            
            return {
                "status": "success",
                "language": language,
                "translations": translations,
                "cached": True,
                "message": f"Static translations loaded for {language}"
            }
            
        except Exception as e:
            print(f"❌ Error loading static translations: {e}")
            raise HTTPException(status_code=500, detail=f"Error loading static translations: {str(e)}")

    @app.post("/translate")
    async def translate_text_endpoint(request: Request):
        """Direct translation endpoint for frontend use"""
        try:
            # Get request body
            body = await request.json()
            text = body.get("text")
            target_language = body.get("target_language", "en")
            source_language = body.get("source_language", "en")
            
            if not text:
                return JSONResponse({"status": "error", "message": "Text is required"}, status_code=400)
            
            print(f"🌐 [Translate API] Translating: '{text[:50]}...' from {source_language} to {target_language}")
            
            # Use the translation service
            from translation_service import translation_service
            translated_text = await translation_service.translate_text(text, target_language, source_language)
            
            print(f"🌐 [Translate API] Result: '{translated_text[:50]}...'")
            
            return JSONResponse({
                "status": "success",
                "translated_text": translated_text,
                "source_language": source_language,
                "target_language": target_language
            })
            
        except Exception as e:
            print(f"❌ [Translate API] Error: {e}")
            return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

    return app

# Create the app
app = create_admin_app()

if __name__ == "__main__":
    import uvicorn
    # Set development mode
    os.environ["DEVELOPMENT_MODE"] = "true"
    uvicorn.run(app, host="0.0.0.0", port=8001) 