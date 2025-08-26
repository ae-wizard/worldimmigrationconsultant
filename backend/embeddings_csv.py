import os
import json
from typing import List, Dict
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
import time
import re

# Initialize embedding model
embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def get_qdrant_client(use_production: bool = True):
    """Get Qdrant client - production or development"""
    if use_production:
        # Production: Persistent storage
        return QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
    else:
        # Development: In-memory (not persistent)
        return QdrantClient(":memory:")

def ensure_collection(collection_name: str = "immigration_docs", vector_dim: int = 384):
    """Ensure the Qdrant collection exists"""
    qdrant = get_qdrant_client()
    
    try:
        # Check if collection exists by listing all collections
        collections = qdrant.get_collections()
        existing_names = [col.name for col in collections.collections]
        
        if collection_name in existing_names:
            print(f"✓ Collection '{collection_name}' already exists")
            # Get the actual collection info to show point count
            try:
                collection_info = qdrant.get_collection(collection_name)
                print(f"  Points count: {collection_info.points_count}")
            except:
                print(f"  (Could not get point count, but collection exists)")
            return True
        else:
            # Collection doesn't exist, create it
            print(f"Creating new collection: {collection_name}")
            qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_dim,  # sentence-transformers/all-MiniLM-L6-v2 embedding size
                    distance=Distance.COSINE
                )
            )
            print(f"✓ Created collection '{collection_name}'")
            return True
            
    except Exception as e:
        print(f"❌ Error ensuring collection: {e}")
        return False

def index_csv_content(content_list: List[dict], collection_name: str = "immigration_docs", batch_size: int = 100):
    """Index CSV-scraped content into the vector database with batching"""
    qdrant = get_qdrant_client()
    
    # Ensure collection exists
    if not ensure_collection(collection_name):
        print(f"❌ Failed to ensure collection '{collection_name}' exists")
        return False
    
    print(f"🚀 Starting to index {len(content_list)} content pieces...")
    print(f"Using collection: {collection_name}")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    total_batches = (len(content_list) + batch_size - 1) // batch_size
    all_points = []
    
    for batch_idx in range(0, len(content_list), batch_size):
        batch = content_list[batch_idx:batch_idx + batch_size]
        current_batch_num = (batch_idx // batch_size) + 1
        
        print(f"Processing batch {current_batch_num}/{total_batches} ({len(batch)} items)")
        
        try:
            # Generate embeddings for the batch
            texts = [item.get('text', '') for item in batch]
            embeddings = embed_model.encode(texts, show_progress_bar=False)
            
            # Create points for this batch
            batch_points = []
            for i, (content, embedding) in enumerate(zip(batch, embeddings)):
                point_id = batch_idx + i
                
                point = PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload={
                        "text": content.get('text', ''),
                        "source_url": content.get('source_url', ''),
                        "chunk_id": content.get('chunk_id', ''),
                        "source_type": content.get('source_type', 'immigration_csv'),
                        "category": content.get('category', ''),
                        "country": content.get('country', ''),
                        "country_name": content.get('country_name', ''),
                        "title": content.get('title', ''),
                        "description": content.get('description', ''),
                        "visa_type": content.get('visa_type', ''),
                        "category_name": content.get('category_name', ''),
                        "scraped_at": content.get('scraped_at', ''),
                        "status": content.get('status', 'unknown')
                    }
                )
                batch_points.append(point)
            
            # Upload batch to Qdrant
            qdrant.upsert(
                collection_name=collection_name,
                points=batch_points
            )
            
            print(f"  ✓ Batch {current_batch_num} indexed successfully")
            all_points.extend(batch_points)
            
        except Exception as e:
            print(f"  ✗ Error processing batch {current_batch_num}: {e}")
            continue
    
    # Final statistics
    try:
        collection_info = qdrant.get_collection(collection_name)
        print(f"\n🎉 INDEXING COMPLETE!")
        print(f"Total points indexed: {len(all_points)}")
        print(f"Collection total points: {collection_info.points_count}")
        print(f"Collection: {collection_name}")
        
        # Get content statistics
        countries = list(set([p.payload.get('country_name', '') for p in all_points if p.payload.get('country_name')]))
        categories = list(set([p.payload.get('category', '') for p in all_points if p.payload.get('category')]))
        
        print(f"Countries covered: {len(countries)}")
        print(f"Categories covered: {len(categories)}")
        
        return True
    except Exception as e:
        print(f"⚠️ Error getting final stats (indexing still successful): {e}")
        print(f"\n🎉 INDEXING COMPLETE!")
        print(f"Total points indexed: {len(all_points)}")
        print(f"Collection: {collection_name}")
        
        # Return True since the actual indexing succeeded
        return True

def search_immigration_content(query: str, collection_name: str = "immigration_docs", limit: int = 5) -> List[Dict]:
    """Search for similar immigration content"""
    qdrant = get_qdrant_client()
    
    # Generate embedding for the query
    query_embedding = embed_model.encode(query).tolist()
    
    try:
        # Search in Qdrant
        search_results = qdrant.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=limit
        )
        
        results = []
        for result in search_results:
            # Return all available fields from the payload for maximum flexibility
            search_result = {
                "text": result.payload.get("text", ""),
                "content": result.payload.get("content", ""),
                "combined_text": result.payload.get("combined_text", ""),
                "full_chunk": result.payload.get("full_chunk", ""),
                "source_url": result.payload.get("source_url", ""),
                "country": result.payload.get("country_name", result.payload.get("country", "")),
                "country_name": result.payload.get("country_name", ""),
                "category": result.payload.get("category_name", result.payload.get("category", "")),
                "category_name": result.payload.get("category_name", ""),
                "title": result.payload.get("title", ""),
                "csv_title": result.payload.get("csv_title", ""),
                "document_title": result.payload.get("document_title", ""),
                "csv_description": result.payload.get("csv_description", ""),
                "description": result.payload.get("description", ""),
                "type": result.payload.get("type", ""),
                "flag": result.payload.get("flag", ""),
                "chunk_id": result.payload.get("chunk_id", ""),
                "chunk_index": result.payload.get("chunk_index"),
                "chunk_length": result.payload.get("chunk_length"),
                "source_type": result.payload.get("source_type", ""),
                "search_type": "semantic",
                "score": result.score,
                "id": getattr(result, 'id', 'unknown')
            }
            results.append(search_result)
        
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []

def get_collection_stats(collection_name: str = "immigration_docs") -> Dict:
    """Get statistics about the collection"""
    qdrant = get_qdrant_client()
    
    try:
        collection_info = qdrant.get_collection(collection_name)
        return {
            "total_points": collection_info.points_count,
            "vectors_count": collection_info.vectors_count if hasattr(collection_info, 'vectors_count') else collection_info.points_count,
            "collection_name": collection_name
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {"error": str(e)}

def delete_collection(collection_name: str = "immigration_docs"):
    """Delete a collection (use with caution!)"""
    qdrant = get_qdrant_client()
    
    try:
        qdrant.delete_collection(collection_name)
        print(f"✓ Deleted collection: {collection_name}")
        return True
    except Exception as e:
        print(f"Error deleting collection: {e}")
        return False

def load_and_index_csv_content(json_file: str = "csv_immigration_content.json", collection_name: str = "immigration_docs"):
    """Load CSV-scraped content and index it"""
    print("🔄 Loading CSV-scraped content...")
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            raw_content = json.load(f)
        
        print(f"✓ Loaded {len(raw_content)} content pieces from {json_file}")
        
        # Convert scraped content format to vectorization format
        content = []
        for i, item in enumerate(raw_content):
            # Extract text content from HTML
            html_content = item.get('content', '')
            # Simple HTML tag removal for better embedding
            text_content = re.sub(r'<[^>]+>', ' ', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            # Take first 2000 characters to avoid too long texts
            text_content = text_content[:2000] if len(text_content) > 2000 else text_content
            
            converted_item = {
                'text': text_content,
                'source_url': item.get('url', ''),
                'chunk_id': f"scraped_{i}",
                'source_type': 'manual_scraping',
                'title': item.get('title', ''),
                'country': item.get('country', ''),
                'category': item.get('category', ''),
                'scraped_at': item.get('scraped_at', ''),
                'status': item.get('status', 'unknown')
            }
            content.append(converted_item)
        
        print(f"✓ Converted {len(content)} items to vectorization format")
        
        # Index the content
        success = index_csv_content(content, collection_name)
        
        if success:
            print(f"✅ Successfully indexed content into collection: {collection_name}")
            
            # Show final stats with graceful error handling
            try:
                stats = get_collection_stats(collection_name)
                print(f"📊 Final Statistics:")
                print(f"   Total vectors: {stats.get('total_points', 0)}")
                print(f"   Collection: {stats.get('collection_name', 'Unknown')}")
            except Exception as stats_error:
                print(f"⚠️ Could not get final stats (vectorization still successful): {stats_error}")
            
            return True
        else:
            print("❌ Failed to index content")
            return False
            
    except FileNotFoundError:
        print(f"❌ File not found: {json_file}")
        print("Run scraper_csv.py first to scrape content")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🔮 IMMIGRATION CONTENT VECTORIZER")
    print("=" * 60)
    
    # Check if scraped content exists
    json_file = "csv_immigration_content.json"
    if not os.path.exists(json_file):
        print(f"❌ Scraped content file not found: {json_file}")
        print("Please run scraper_csv.py first to scrape content")
        exit(1)
    
    # Load and check content
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        print(f"Found scraped content: {len(content)} pieces")
        
        # Show preview
        if content:
            countries = list(set([item.get('country_name', '') for item in content]))
            categories = list(set([item.get('category', '') for item in content]))
            
            print(f"Countries: {len(countries)}")
            print(f"Categories: {len(categories)}")
            print(f"Example countries: {', '.join(sorted(countries)[:5])}...")
        
        print("=" * 60)
        print("Ready to vectorize content!")
        print("This will create embeddings and store in Qdrant vector database")
        
        proceed = input("Proceed with vectorization? (y/n): ").lower().strip()
        if proceed == 'y':
            success = load_and_index_csv_content(json_file)
            if success:
                print("\n✅ VECTORIZATION COMPLETE!")
                print("Your RAG system is ready with comprehensive worldwide immigration data")
            else:
                print("\n❌ Vectorization failed")
        else:
            print("Vectorization cancelled")
            
    except Exception as e:
        print(f"Error reading content file: {e}") 