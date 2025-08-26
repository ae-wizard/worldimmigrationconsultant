"""
Enhanced RAG System - Phase 2 Implementation
Integrates smart chunking, relationship mapping, and temporal tracking
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

from smart_chunking import SmartChunker, SmartChunk
from relationship_mapper import RelationshipMapper, ImmigrationRelationship
from temporal_tracker import TemporalTracker, TemporalInfo
from rag_config import ProductionRAGConfig

logger = logging.getLogger(__name__)

@dataclass
class EnhancedChunk:
    """Enhanced chunk with all Phase 2 metadata"""
    # Core content
    content: str
    source_url: str
    document_title: str
    
    # Smart chunking metadata
    chunk_type: str
    section_title: str
    subsection_title: str = ""
    chunk_index: int = 0
    confidence_score: float = 1.0
    
    # Domain extraction
    form_numbers: List[str] = None
    visa_types: List[str] = None
    requirements: List[str] = None
    fees: List[str] = None
    countries: List[str] = None
    
    # Relationships
    relationships: List[Dict[str, Any]] = None
    dependencies: Dict[str, List[str]] = None
    process_flows: List[List[str]] = None
    
    # Temporal information
    temporal_info: List[Dict[str, Any]] = None
    is_current: bool = True
    freshness_score: float = 1.0
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    
    def __post_init__(self):
        if self.form_numbers is None:
            self.form_numbers = []
        if self.visa_types is None:
            self.visa_types = []
        if self.requirements is None:
            self.requirements = []
        if self.fees is None:
            self.fees = []
        if self.countries is None:
            self.countries = []
        if self.relationships is None:
            self.relationships = []
        if self.dependencies is None:
            self.dependencies = {}
        if self.process_flows is None:
            self.process_flows = []
        if self.temporal_info is None:
            self.temporal_info = []

class EnhancedRAGConfig:
    """Enhanced RAG system with Phase 2 smart content processing"""
    
    def __init__(self, qdrant_url: str = ":memory:", qdrant_api_key: str = None):
        # Initialize Phase 2 components
        self.smart_chunker = SmartChunker()
        self.relationship_mapper = RelationshipMapper()
        self.temporal_tracker = TemporalTracker()
        
        # Initialize base RAG system
        self.base_rag = ProductionRAGConfig()
        
        # Enhanced collection name
        self.collection_name = "immigration_docs_enhanced"
        
        logger.info("🚀 Enhanced RAG system initialized with Phase 2 components")

    async def process_document_enhanced(self, title: str, content: str, source_url: str = "") -> List[EnhancedChunk]:
        """Process document with full Phase 2 enhancement pipeline"""
        logger.info(f"🧠 Processing document with Phase 2 pipeline: {title}")
        
        # Step 1: Smart chunking
        smart_chunks = self.smart_chunker.smart_chunk_document(title, content, source_url)
        logger.info(f"✅ Created {len(smart_chunks)} smart chunks")
        
        # Step 2: Extract relationships from full content
        # Flatten form and visa lists from all chunks
        all_forms = []
        all_visas = []
        for chunk in smart_chunks:
            all_forms.extend(chunk.form_numbers)
            all_visas.extend(chunk.visa_types)
        
        relationships = self.relationship_mapper.extract_relationships(
            content, 
            source_forms=all_forms,
            source_visas=all_visas
        )
        logger.info(f"✅ Extracted {len(relationships)} relationships")
        
        # Step 3: Extract temporal information
        temporal_info = self.temporal_tracker.extract_temporal_info(content, title)
        temporal_summary = self.temporal_tracker.get_temporal_summary(temporal_info)
        logger.info(f"✅ Extracted {len(temporal_info)} temporal elements")
        
        # Step 4: Create enhanced chunks
        enhanced_chunks = []
        
        for i, chunk in enumerate(smart_chunks):
            # Get relationships for entities in this chunk
            chunk_entities = chunk.form_numbers + chunk.visa_types
            chunk_relationships = []
            chunk_dependencies = {}
            chunk_flows = []
            
            for entity in chunk_entities:
                # Get relationships
                entity_rels = [rel for rel in relationships 
                              if rel.source.upper() == entity.upper() or rel.target.upper() == entity.upper()]
                chunk_relationships.extend([{
                    'source': rel.source,
                    'target': rel.target,
                    'type': rel.relationship_type,
                    'confidence': rel.confidence,
                    'context': rel.context
                } for rel in entity_rels])
                
                # Get dependencies
                deps = self.relationship_mapper.get_entity_dependencies(entity)
                if deps:
                    chunk_dependencies[entity] = deps
                
                # Get process flows
                flows = self.relationship_mapper.get_process_flow(entity, max_depth=3)
                if flows:
                    chunk_flows.extend(flows)
            
            # Create enhanced chunk
            enhanced_chunk = EnhancedChunk(
                content=chunk.content,
                source_url=source_url,
                document_title=title,
                chunk_type=chunk.chunk_type,
                section_title=chunk.section_title,
                subsection_title=chunk.subsection_title,
                chunk_index=i,
                confidence_score=chunk.confidence_score,
                form_numbers=chunk.form_numbers,
                visa_types=chunk.visa_types,
                requirements=chunk.requirements,
                fees=chunk.fees,
                countries=chunk.countries,
                relationships=chunk_relationships,
                dependencies=chunk_dependencies,
                process_flows=chunk_flows,
                temporal_info=[{
                    'type': info.content_type,
                    'text': info.text_mention,
                    'date': info.date_mentioned.isoformat() if info.date_mentioned else None,
                    'confidence': info.confidence,
                    'context': info.context[:100] + '...' if len(info.context) > 100 else info.context
                } for info in temporal_info],
                is_current=temporal_summary['is_current'],
                freshness_score=temporal_summary['freshness_score'],
                effective_date=temporal_summary['effective_dates'][0]['date'] if temporal_summary['effective_dates'] else None,
                expiration_date=temporal_summary['expiration_dates'][0]['date'] if temporal_summary['expiration_dates'] else None
            )
            
            enhanced_chunks.append(enhanced_chunk)
        
        logger.info(f"🎯 Created {len(enhanced_chunks)} enhanced chunks with full Phase 2 metadata")
        return enhanced_chunks

    async def store_enhanced_chunks(self, enhanced_chunks: List[EnhancedChunk]) -> bool:
        """Store enhanced chunks in vector database with rich metadata"""
        try:
            logger.info(f"💾 Storing {len(enhanced_chunks)} enhanced chunks")
            
            # Create embeddings for each chunk
            texts = [chunk.content for chunk in enhanced_chunks]
            embeddings = []
            for text in texts:
                embedding = await self.base_rag.generate_embedding(text)
                embeddings.append(embedding)
            
            # Prepare points for Qdrant
            points = []
            for i, (chunk, embedding) in enumerate(zip(enhanced_chunks, embeddings)):
                # Convert chunk to serializable format
                payload = asdict(chunk)
                
                # Ensure all values are JSON serializable
                payload = self._make_serializable(payload)
                
                point = {
                    "id": i,
                    "vector": embedding,
                    "payload": payload
                }
                points.append(point)
            
            # Store in Qdrant
            result = await self.base_rag.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            
            logger.info(f"✅ Successfully stored {len(enhanced_chunks)} enhanced chunks")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error storing enhanced chunks: {e}")
            return False

    async def semantic_search_enhanced(self, query: str, limit: int = 5, 
                                     filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Enhanced semantic search with Phase 2 filtering capabilities"""
        try:
            logger.info(f"🔍 Enhanced semantic search: '{query}' (limit: {limit})")
            
            # Generate query embedding using the correct method name
            query_embedding = await self.base_rag.generate_embedding(query)
            
            # Build search filters
            search_filter = self._build_search_filter(filters) if filters else None
            
            # Search in Qdrant
            search_result = await self.base_rag.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                query_filter=search_filter,
                score_threshold=0.5
            )
            
            # Process results with enhanced metadata
            enhanced_results = []
            for result in search_result:
                enhanced_result = {
                    'content': result.payload.get('content', ''),
                    'score': result.score,
                    'metadata': {
                        'document_title': result.payload.get('document_title', ''),
                        'source_url': result.payload.get('source_url', ''),
                        'chunk_type': result.payload.get('chunk_type', ''),
                        'section_title': result.payload.get('section_title', ''),
                        'form_numbers': result.payload.get('form_numbers', []),
                        'visa_types': result.payload.get('visa_types', []),
                        'requirements': result.payload.get('requirements', []),
                        'fees': result.payload.get('fees', []),
                        'relationships': result.payload.get('relationships', []),
                        'process_flows': result.payload.get('process_flows', []),
                        'temporal_info': result.payload.get('temporal_info', []),
                        'is_current': result.payload.get('is_current', True),
                        'freshness_score': result.payload.get('freshness_score', 1.0),
                        'confidence_score': result.payload.get('confidence_score', 1.0)
                    }
                }
                enhanced_results.append(enhanced_result)
            
            logger.info(f"✅ Found {len(enhanced_results)} enhanced results")
            return enhanced_results
            
        except Exception as e:
            logger.error(f"❌ Enhanced search error: {e}")
            return []

    def _build_search_filter(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Build Qdrant filter from search criteria"""
        conditions = []
        
        # Filter by form numbers
        if 'form_numbers' in filters:
            conditions.append({
                "key": "form_numbers",
                "match": {"any": filters['form_numbers']}
            })
        
        # Filter by visa types
        if 'visa_types' in filters:
            conditions.append({
                "key": "visa_types", 
                "match": {"any": filters['visa_types']}
            })
        
        # Filter by chunk type
        if 'chunk_type' in filters:
            conditions.append({
                "key": "chunk_type",
                "match": {"value": filters['chunk_type']}
            })
        
        # Filter by currentness
        if 'current_only' in filters and filters['current_only']:
            conditions.append({
                "key": "is_current",
                "match": {"value": True}
            })
        
        # Filter by minimum freshness score
        if 'min_freshness' in filters:
            conditions.append({
                "key": "freshness_score",
                "range": {"gte": filters['min_freshness']}
            })
        
        if conditions:
            return {"must": conditions}
        
        return None

    def _make_serializable(self, obj: Any) -> Any:
        """Make object JSON serializable"""
        if isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif hasattr(obj, '__dict__'):
            return self._make_serializable(obj.__dict__)
        else:
            # Convert non-serializable types to strings
            try:
                json.dumps(obj)
                return obj
            except (TypeError, ValueError):
                return str(obj)

    async def get_entity_insights(self, entity: str) -> Dict[str, Any]:
        """Get comprehensive insights for an immigration entity"""
        logger.info(f"🔍 Getting entity insights for: {entity}")
        
        # Search for entity across all chunks
        entity_filter = {
            'form_numbers': [entity] if entity.startswith(('I-', 'N-', 'DS-')) else [],
            'visa_types': [entity] if not entity.startswith(('I-', 'N-', 'DS-')) else []
        }
        
        if not any(entity_filter.values()):
            # Generic search if entity type unclear
            entity_filter = None
        
        results = await self.semantic_search_enhanced(
            query=f"information about {entity}",
            limit=10,
            filters=entity_filter
        )
        
        # Aggregate insights
        insights = {
            'entity': entity,
            'total_mentions': len(results),
            'related_forms': set(),
            'related_visas': set(),
            'requirements': set(),
            'fees': set(),
            'relationships': [],
            'process_flows': [],
            'temporal_info': [],
            'average_freshness': 0.0,
            'sources': set()
        }
        
        total_freshness = 0
        for result in results:
            meta = result['metadata']
            
            # Aggregate related entities
            insights['related_forms'].update(meta.get('form_numbers', []))
            insights['related_visas'].update(meta.get('visa_types', []))
            insights['requirements'].update(meta.get('requirements', []))
            insights['fees'].update(meta.get('fees', []))
            insights['sources'].add(meta.get('source_url', ''))
            
            # Aggregate relationships
            insights['relationships'].extend(meta.get('relationships', []))
            
            # Aggregate process flows
            insights['process_flows'].extend(meta.get('process_flows', []))
            
            # Aggregate temporal info
            insights['temporal_info'].extend(meta.get('temporal_info', []))
            
            # Calculate average freshness
            total_freshness += meta.get('freshness_score', 1.0)
        
        # Convert sets to lists and calculate averages
        insights['related_forms'] = list(insights['related_forms'])
        insights['related_visas'] = list(insights['related_visas'])
        insights['requirements'] = list(insights['requirements'])
        insights['fees'] = list(insights['fees'])
        insights['sources'] = list(insights['sources'])
        insights['average_freshness'] = total_freshness / len(results) if results else 0.0
        
        # Get additional relationship insights
        entity_deps = self.relationship_mapper.get_entity_dependencies(entity)
        insights['dependencies'] = entity_deps
        
        entity_flows = self.relationship_mapper.get_process_flow(entity, max_depth=3)
        insights['complete_process_flows'] = entity_flows
        
        logger.info(f"✅ Generated comprehensive insights for {entity}")
        return insights

    async def validate_user_path(self, entities: List[str], user_country: str = None) -> Dict[str, Any]:
        """Validate a user's immigration path with comprehensive analysis"""
        logger.info(f"🧭 Validating user path: {entities}")
        
        # Use relationship mapper for validation
        validation = self.relationship_mapper.validate_entity_combination(entities, user_country)
        
        # Enhance with search results
        enhanced_validation = validation.copy()
        enhanced_validation['entity_insights'] = {}
        enhanced_validation['recommended_next_steps'] = []
        enhanced_validation['timeline_estimate'] = {}
        
        # Get insights for each entity
        for entity in entities:
            insights = await self.get_entity_insights(entity)
            enhanced_validation['entity_insights'][entity] = insights
            
            # Extract timeline estimates
            processing_estimate = self.temporal_tracker.get_processing_estimate(entity)
            if processing_estimate:
                enhanced_validation['timeline_estimate'][entity] = {
                    'min_days': processing_estimate[0],
                    'max_days': processing_estimate[1],
                    'description': f"{processing_estimate[0]//30}-{processing_estimate[1]//30} months"
                }
        
        # Generate recommendations
        if not validation['valid']:
            enhanced_validation['recommended_next_steps'].append(
                "Address the identified conflicts and missing requirements before proceeding"
            )
        else:
            # Find logical next steps in process flows
            for entity in entities:
                flows = self.relationship_mapper.get_process_flow(entity, max_depth=2)
                for flow in flows:
                    if len(flow) > 1 and flow[1] not in entities:
                        enhanced_validation['recommended_next_steps'].append(
                            f"Consider {flow[1]} as next step after {entity}"
                        )
        
        logger.info(f"✅ Completed path validation for {len(entities)} entities")
        return enhanced_validation

    async def cleanup_enhanced_collection(self):
        """Clean up enhanced collection"""
        try:
            await self.base_rag.qdrant_client.delete_collection(self.collection_name)
            logger.info(f"✅ Cleaned up enhanced collection: {self.collection_name}")
        except Exception as e:
            logger.warning(f"⚠️ Could not clean up collection: {e}")

    async def get_enhanced_status(self) -> Dict[str, Any]:
        """Get status of enhanced RAG system"""
        try:
            # Try to get collection info
            try:
                collection_info = await self.base_rag.qdrant_client.get_collection(self.collection_name)
                status = {
                    'collection_name': self.collection_name,
                    'total_chunks': collection_info.points_count,
                    'vector_size': collection_info.config.params.vectors.size,
                    'components': {
                        'smart_chunker': 'initialized',
                        'relationship_mapper': 'initialized', 
                        'temporal_tracker': 'initialized'
                    },
                    'capabilities': [
                        'smart_chunking',
                        'relationship_mapping',
                        'temporal_awareness',
                        'entity_insights',
                        'path_validation',
                        'enhanced_search'
                    ]
                }
            except Exception as collection_error:
                # Collection doesn't exist, create it
                await self._ensure_collection_exists()
                status = {
                    'collection_name': self.collection_name,
                    'total_chunks': 0,
                    'vector_size': 1536,  # Default embedding size
                    'components': {
                        'smart_chunker': 'initialized',
                        'relationship_mapper': 'initialized', 
                        'temporal_tracker': 'initialized'
                    },
                    'capabilities': [
                        'smart_chunking',
                        'relationship_mapping',
                        'temporal_awareness',
                        'entity_insights',
                        'path_validation',
                        'enhanced_search'
                    ],
                    'status': 'collection_created'
                }
            
            return status
            
        except Exception as e:
            return {
                'collection_name': self.collection_name,
                'error': str(e),
                'status': 'not_ready'
            }

    async def _ensure_collection_exists(self):
        """Ensure the enhanced collection exists"""
        try:
            await self.base_rag.qdrant_client.get_collection(self.collection_name)
        except Exception:
            # Collection doesn't exist, create it using Qdrant client directly
            try:
                from qdrant_client.models import Distance, VectorParams
                self.base_rag.qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.base_rag.embedding_dimensions,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"✅ Created enhanced collection: {self.collection_name}")
            except Exception as e:
                logger.error(f"❌ Failed to create enhanced collection: {e}")
                raise 