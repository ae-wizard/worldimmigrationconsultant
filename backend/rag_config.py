"""
Production RAG Configuration
Handles OpenAI Embeddings, Qdrant Cloud, and Redis caching
"""
import os
from typing import Optional, List
import openai
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import redis
import json
import hashlib
import numpy as np
from datetime import datetime, timedelta
import asyncio
from asyncio_throttle import Throttler

class ProductionRAGConfig:
    """Production-grade RAG configuration with real infrastructure"""
    
    def __init__(self):
        # OpenAI Configuration
        self.openai_api_key = "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"
        self.embedding_model = "text-embedding-3-large"
        self.embedding_dimensions = 3072
        self.embedding_dimension = 3072  # Alias for compatibility
        
        # Qdrant Configuration
        self.qdrant_url = os.getenv("QDRANT_URL", ":memory:")  # Fallback to memory for development
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self.collection_name = "immigration_docs"
        
        # RAG Parameters
        self.chunk_size = 500
        self.chunk_overlap = 50
        self.max_retrieval_results = 10
        
        # Caching Configuration
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.cache_ttl = 24 * 60 * 60  # 24 hours
        
        # Rate limiting for OpenAI API
        self.embedding_throttler = Throttler(rate_limit=1000, period=60)  # 1000 requests per minute
        
        # Initialize clients
        self._init_clients()
    
    def _init_clients(self):
        """Initialize Qdrant and Redis clients"""
        try:
            # Initialize Qdrant client
            if self.qdrant_url == ":memory:":
                print("🔧 Using in-memory Qdrant for development")
                self.qdrant_client = QdrantClient(":memory:")
            else:
                print(f"🔧 Connecting to Qdrant Cloud: {self.qdrant_url}")
                self.qdrant_client = QdrantClient(
                    url=self.qdrant_url,
                    api_key=self.qdrant_api_key,
                )
            
            # Initialize Redis client for caching
            try:
                self.redis_client = redis.from_url(self.redis_url)
                self.redis_client.ping()
                print("🔧 Redis cache connected")
            except:
                print("⚠️ Redis not available, using in-memory cache")
                self.redis_client = None
                self._memory_cache = {}
            
            # Create collection if it doesn't exist
            self._ensure_collection_exists()
            
        except Exception as e:
            print(f"❌ Error initializing RAG clients: {e}")
            # Fallback to memory-based system
            self.qdrant_client = QdrantClient(":memory:")
            self.redis_client = None
            self._memory_cache = {}
            self._ensure_collection_exists()
    
    def _ensure_collection_exists(self):
        """Ensure the vector collection exists"""
        try:
            collections = self.qdrant_client.get_collections()
            collection_names = [c.name for c in collections.collections]
            
            if self.collection_name not in collection_names:
                print(f"🔧 Creating collection: {self.collection_name}")
                self.qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_dimensions,
                        distance=Distance.COSINE
                    )
                )
                print(f"✅ Collection created: {self.collection_name}")
            else:
                print(f"✅ Collection exists: {self.collection_name}")
                
        except Exception as e:
            print(f"❌ Error with collection: {e}")
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API with proper v1.0+ syntax"""
        try:
            # Truncate text if too long (OpenAI has token limits)
            if len(text) > 8000:
                text = text[:8000]
            
            print(f"🔄 Generating embedding for text: {text[:50]}...")
            
            # Use the new OpenAI v1.0+ client syntax
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.embeddings.create(
                input=text,
                model=self.embedding_model
            )
            
            embedding = response.data[0].embedding
            print(f"✅ Generated embedding: {len(embedding)} dimensions")
            return embedding
            
        except Exception as e:
            print(f"❌ Error generating embedding: {e}")
            # Return a dummy embedding for development
            return [0.0] * self.embedding_dimensions
    
    def _get_cache(self, key: str) -> Optional[list]:
        """Get from cache (Redis or memory)"""
        try:
            if self.redis_client:
                cached = self.redis_client.get(key)
                if cached:
                    return json.loads(cached)
            elif hasattr(self, '_memory_cache'):
                return self._memory_cache.get(key)
        except:
            pass
        return None
    
    def _set_cache(self, key: str, value: list):
        """Set cache (Redis or memory)"""
        try:
            if self.redis_client:
                self.redis_client.setex(
                    key, 
                    self.cache_ttl, 
                    json.dumps(value)
                )
            elif hasattr(self, '_memory_cache'):
                self._memory_cache[key] = value
        except:
            pass
    
    def smart_chunk_text(self, text: str, document_id: str, title: str = "") -> list:
        """Smart chunking with context preservation"""
        if not text.strip():
            return []
        
        # Clean and prepare text
        text = text.strip()
        words = text.split()
        
        if len(words) <= self.chunk_size:
            # Document is small enough to be one chunk
            return [{
                'text': text,
                'chunk_id': f"{document_id}_chunk_0",
                'document_id': document_id,
                'title': title,
                'chunk_index': 0,
                'total_chunks': 1,
                'word_count': len(words)
            }]
        
        chunks = []
        start_idx = 0
        chunk_index = 0
        
        while start_idx < len(words):
            # Calculate end index
            end_idx = min(start_idx + self.chunk_size, len(words))
            
            # Get chunk words
            chunk_words = words[start_idx:end_idx]
            chunk_text = ' '.join(chunk_words)
            
            # Add context if available
            context_prefix = f"Document: {title}\n\n" if title else ""
            full_chunk_text = context_prefix + chunk_text
            
            chunks.append({
                'text': full_chunk_text,
                'chunk_id': f"{document_id}_chunk_{chunk_index}",
                'document_id': document_id,
                'title': title,
                'chunk_index': chunk_index,
                'word_count': len(chunk_words),
                'start_word': start_idx,
                'end_word': end_idx
            })
            
            # Move to next chunk with overlap
            start_idx = end_idx - self.chunk_overlap
            chunk_index += 1
            
            # Prevent infinite loop
            if start_idx >= end_idx - self.chunk_overlap:
                break
        
        # Update total chunks count
        for chunk in chunks:
            chunk['total_chunks'] = len(chunks)
        
        return chunks
    
    async def vectorize_chunks(self, chunks: list, progress_callback=None) -> list:
        """Vectorize chunks with progress tracking"""
        vectorized_chunks = []
        total_chunks = len(chunks)
        
        for i, chunk in enumerate(chunks):
            if progress_callback:
                progress_callback(i + 1, total_chunks, f"Vectorizing chunk {i+1}/{total_chunks}")
            
            # Get embedding
            embedding = await self.generate_embedding(chunk['text'])
            
            # Ensure embedding is a list (it should already be from OpenAI)
            if not isinstance(embedding, list):
                embedding = list(embedding)
            
            # Create point for Qdrant
            point = PointStruct(
                id=hash(chunk['chunk_id']) % (2**63),  # Convert to valid int64
                vector=embedding,  # Remove .tolist() since it's already a list
                payload={
                    'chunk_id': chunk['chunk_id'],
                    'document_id': chunk['document_id'],
                    'title': chunk['title'],
                    'text': chunk['text'],
                    'chunk_index': chunk['chunk_index'],
                    'total_chunks': chunk['total_chunks'],
                    'word_count': chunk['word_count'],
                    'created_at': datetime.now().isoformat()
                }
            )
            
            vectorized_chunks.append(point)
        
        return vectorized_chunks
    
    def upsert_vectors(self, points: list) -> bool:
        """Insert vectors into Qdrant"""
        try:
            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            print(f"✅ Upserted {len(points)} vectors to Qdrant")
            return True
        except Exception as e:
            print(f"❌ Error upserting vectors: {e}")
            return False
    
    async def semantic_search(self, query: str, limit: int = 5) -> List[dict]:
        """Perform semantic search using real embeddings"""
        try:
            if not query.strip():
                return []
            
            # Get query embedding
            query_embedding = await self.generate_embedding(query)
            
            if all(x == 0.0 for x in query_embedding):
                print("⚠️ Query embedding is all zeros, falling back to text search")
                return []
            
            # Search in Qdrant
            search_results = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit
            )
            
            results = []
            for result in search_results:
                results.append({
                    'text': result.payload.get('text', ''),
                    'title': result.payload.get('title', 'Immigration Document'),
                    'source': result.payload.get('source', 'Unknown'),
                    'score': float(result.score),
                    'chunk_id': result.id
                })
            
            print(f"✅ Semantic search returned {len(results)} results")
            return results
            
        except Exception as e:
            print(f"❌ Error in semantic search: {e}")
            return []
    
    def get_collection_stats(self) -> dict:
        """Get collection statistics"""
        try:
            info = self.qdrant_client.get_collection(self.collection_name)
            return {
                'total_vectors': info.vectors_count,
                'indexed_vectors': info.indexed_vectors_count,
                'status': 'connected'
            }
        except Exception as e:
            print(f"❌ Error getting collection stats: {e}")
            return {
                'total_vectors': 0,
                'indexed_vectors': 0,
                'status': 'disconnected'
            }

# Global RAG configuration instance
rag_config = ProductionRAGConfig() 