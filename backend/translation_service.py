import os
import json
import time
import asyncio
import aiohttp
import sqlite3
from typing import Dict, Optional, List
from datetime import datetime, timedelta

class TranslationService:
    """Translation service with multiple providers and caching"""
    
    def __init__(self):
        self.cache_db = "translation_cache.db"
        self.setup_cache_db()
        
        # Provider configurations
        self.providers = {
            'google': {
                'api_key': os.getenv('GOOGLE_TRANSLATE_API_KEY'),
                'endpoint': 'https://translation.googleapis.com/language/translate/v2',
                'cost_per_char': 0.00002  # $20 per 1M chars
            },
            'azure': {
                'api_key': os.getenv('AZURE_TRANSLATOR_KEY'),
                'endpoint': 'https://api.cognitive.microsofttranslator.com/translate',
                'region': os.getenv('AZURE_TRANSLATOR_REGION', 'eastus'),
                'cost_per_char': 0.00001  # $10 per 1M chars
            },
            'deepl': {
                'api_key': os.getenv('DEEPL_API_KEY'),
                'endpoint': 'https://api-free.deepl.com/v2/translate',
                'cost_per_char': 0.000007  # $6.99 per 1M chars
            }
        }
        
        # Language code mappings for different providers
        self.language_mappings = {
            'zh': 'zh-CN',  # Chinese Simplified
            'ar': 'ar',
            'hi': 'hi',
            'es': 'es',
            'fr': 'fr',
            'pt': 'pt',
            'ru': 'ru',
            'de': 'de',
            'ja': 'ja',
            'ko': 'ko',
            'it': 'it',
            'tr': 'tr',
            'vi': 'vi',
            'th': 'th',
            'pl': 'pl',
            'nl': 'nl',
            'sv': 'sv',
            'id': 'id',
            # NEW: ElevenLabs additional languages
            'hu': 'hu',    # Hungarian
            'no': 'nb',    # Norwegian (Bokmål)
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
    
    def setup_cache_db(self):
        """Setup SQLite cache database"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS translation_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_text TEXT NOT NULL,
                    source_lang TEXT NOT NULL,
                    target_lang TEXT NOT NULL,
                    translated_text TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(source_text, source_lang, target_lang)
                )
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_translation_lookup 
                ON translation_cache(source_text, source_lang, target_lang)
            """)
            
            conn.commit()
            conn.close()
            print("✅ Translation cache database setup complete")
            
        except Exception as e:
            print(f"❌ Error setting up translation cache: {e}")
    
    def get_cached_translation(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Get translation from cache"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT translated_text, created_at 
                FROM translation_cache 
                WHERE source_text = ? AND source_lang = ? AND target_lang = ?
                AND created_at > datetime('now', '-30 days')
            """, (text, source_lang, target_lang))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                print(f"📱 Cache hit for translation: {text[:50]}...")
                return result[0]
                
            return None
            
        except Exception as e:
            print(f"❌ Error getting cached translation: {e}")
            return None
    
    def cache_translation(self, text: str, source_lang: str, target_lang: str, 
                         translated_text: str, provider: str):
        """Cache translation result"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO translation_cache 
                (source_text, source_lang, target_lang, translated_text, provider)
                VALUES (?, ?, ?, ?, ?)
            """, (text, source_lang, target_lang, translated_text, provider))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"❌ Error caching translation: {e}")
    
    async def translate_with_google(self, text: str, target_lang: str, source_lang: str = 'en') -> Optional[str]:
        """Translate using Google Translate API"""
        try:
            api_key = self.providers['google']['api_key']
            if not api_key:
                return None
            
            url = f"{self.providers['google']['endpoint']}?key={api_key}"
            
            payload = {
                'q': text,
                'target': target_lang,
                'source': source_lang,
                'format': 'text'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        translated_text = result['data']['translations'][0]['translatedText']
                        print(f"✅ Google translation successful: {len(translated_text)} chars")
                        return translated_text
                    else:
                        print(f"❌ Google translation failed: {response.status}")
                        return None
                        
        except Exception as e:
            print(f"❌ Google translation error: {e}")
            return None
    
    async def translate_with_azure(self, text: str, target_lang: str, source_lang: str = 'en') -> Optional[str]:
        """Translate using Azure Translator API"""
        try:
            api_key = self.providers['azure']['api_key']
            region = self.providers['azure']['region']
            
            if not api_key:
                return None
            
            url = f"{self.providers['azure']['endpoint']}?api-version=3.0&to={target_lang}"
            
            headers = {
                'Ocp-Apim-Subscription-Key': api_key,
                'Ocp-Apim-Subscription-Region': region,
                'Content-Type': 'application/json'
            }
            
            payload = [{'text': text}]
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        translated_text = result[0]['translations'][0]['text']
                        print(f"✅ Azure translation successful: {len(translated_text)} chars")
                        return translated_text
                    else:
                        print(f"❌ Azure translation failed: {response.status}")
                        return None
                        
        except Exception as e:
            print(f"❌ Azure translation error: {e}")
            return None
    
    async def translate_with_deepl(self, text: str, target_lang: str, source_lang: str = 'en') -> Optional[str]:
        """Translate using DeepL API"""
        try:
            api_key = self.providers['deepl']['api_key']
            if not api_key:
                return None
            
            # DeepL uses different language codes
            deepl_target = target_lang.upper()
            if target_lang == 'zh':
                deepl_target = 'ZH'
            elif target_lang == 'pt':
                deepl_target = 'PT'
            
            url = self.providers['deepl']['endpoint']
            
            payload = {
                'auth_key': api_key,
                'text': text,
                'target_lang': deepl_target,
                'source_lang': source_lang.upper()
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        translated_text = result['translations'][0]['text']
                        print(f"✅ DeepL translation successful: {len(translated_text)} chars")
                        return translated_text
                    else:
                        print(f"❌ DeepL translation failed: {response.status}")
                        return None
                        
        except Exception as e:
            print(f"❌ DeepL translation error: {e}")
            return None
    
    async def translate_text(self, text: str, target_lang: str, source_lang: str = 'en') -> str:
        """Main translation method with fallbacks and caching"""
        
        # Skip translation if target is same as source
        if target_lang == source_lang:
            return text
        
        # Check cache first
        cached = self.get_cached_translation(text, source_lang, target_lang)
        if cached:
            return cached
        
        # Normalize language codes
        target_lang = self.language_mappings.get(target_lang, target_lang)
        
        print(f"🌐 Translating text ({len(text)} chars) from {source_lang} to {target_lang}")
        
        # Try providers in order of preference (accuracy for immigration + cost)
        # Azure recommended as primary for immigration content
        providers = ['azure', 'deepl', 'google']
        
        for provider in providers:
            try:
                if provider == 'google':
                    result = await self.translate_with_google(text, target_lang, source_lang)
                elif provider == 'azure':
                    result = await self.translate_with_azure(text, target_lang, source_lang)
                elif provider == 'deepl':
                    result = await self.translate_with_deepl(text, target_lang, source_lang)
                
                if result:
                    # Cache successful translation
                    self.cache_translation(text, source_lang, target_lang, result, provider)
                    print(f"✅ Translation successful using {provider}")
                    return result
                    
            except Exception as e:
                print(f"❌ Translation failed with {provider}: {e}")
                continue
        
        # If all providers fail, return original text
        print(f"⚠️ All translation providers failed, returning original text")
        return text
    
    def get_translation_stats(self) -> Dict:
        """Get translation usage statistics"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    target_lang,
                    provider,
                    COUNT(*) as count,
                    DATE(created_at) as date
                FROM translation_cache 
                WHERE created_at > datetime('now', '-7 days')
                GROUP BY target_lang, provider, DATE(created_at)
                ORDER BY date DESC
            """)
            
            results = cursor.fetchall()
            conn.close()
            
            stats = {}
            for row in results:
                lang, provider, count, date = row
                if lang not in stats:
                    stats[lang] = {}
                if provider not in stats[lang]:
                    stats[lang][provider] = []
                stats[lang][provider].append({'date': date, 'count': count})
            
            return stats
            
        except Exception as e:
            print(f"❌ Error getting translation stats: {e}")
            return {}

# Global translation service instance
translation_service = TranslationService() 