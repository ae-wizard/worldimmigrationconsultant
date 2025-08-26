import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Button, Form, Table, Modal, 
  Alert, Badge, Tabs, Tab, ProgressBar, Spinner, Toast
} from 'react-bootstrap';
import { 
  Upload, Download, Play, Pause, Settings, FileText, 
  Database, Users, Activity, Shield, Calendar, Plus,
  Edit, Trash, Eye, RefreshCw, Clock, CheckCircle, XCircle, Search
} from 'lucide-react';

// Custom CSS styles for better tab visibility
const customStyles = `
  .nav-tabs .nav-link {
    color: #ffffff !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    margin-right: 5px !important;
    border-radius: 8px 8px 0 0 !important;
    font-weight: 500 !important;
    transition: all 0.3s ease !important;
  }
  
  .nav-tabs .nav-link:hover {
    color: #f8f9fa !important;
    background-color: rgba(255, 255, 255, 0.2) !important;
    border-color: rgba(255, 255, 255, 0.3) !important;
    transform: translateY(-2px) !important;
  }
  
  .nav-tabs .nav-link.active {
    color: #495057 !important;
    background-color: #ffffff !important;
    border-color: #dee2e6 #dee2e6 #ffffff !important;
    font-weight: 600 !important;
  }
  
  .nav-tabs {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    padding: 15px 15px 0 15px !important;
    border-radius: 10px 10px 0 0 !important;
    margin-bottom: 0 !important;
  }
  
  .tab-content {
    border: 1px solid #dee2e6 !important;
    border-top: none !important;
    border-radius: 0 0 10px 10px !important;
    padding: 20px !important;
    background-color: #ffffff !important;
  }
`;

const SecureAdminPanel = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('admin_token'));
  const [user, setUser] = useState(null);

  // Data state
  const [csvData, setCsvData] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [manualDocs, setManualDocs] = useState([]);
  const [qdrantData, setQdrantData] = useState({
    collections: [],
    status: 'unknown',
    selectedCollection: null,
    searchResults: [],
    searchQuery: ''
  });

  // Add missing qdrantStatus state
  const [qdrantStatus, setQdrantStatus] = useState({
    connected: false,
    status: 'disconnected',
    total_vectors: 0,
    indexed_vectors: 0
  });

  // Conversations state (NEW)
  const [conversations, setConversations] = useState([]);
  const [conversationFilters, setConversationFilters] = useState({
    search: '',
    country_filter: '',
    goal_filter: '',
    limit: 50,
    offset: 0
  });
  const [conversationStats, setConversationStats] = useState({
    total_count: 0,
    analytics: null
  });

  // Leads state (NEW)
  const [leads, setLeads] = useState([]);
  const [leadFilters, setLeadFilters] = useState({
    search: '',
    destination_country: '',
    origin_country: '',
    goal: '',
    timeline: '',
    limit: 50,
    offset: 0
  });

  // User management state (NEW)
  const [users, setUsers] = useState([]);
  const [userFilters, setUserFilters] = useState({
    search: '',
    tier: '',
    status: '',
    limit: 50,
    offset: 0
  });
  const [tierSettings, setTierSettings] = useState({
    free: {
      daily_questions: 5,
      monthly_reports: 0,
      avatar_minutes: 0,
      download_access: false,
      template_access: false,
      history_limit: 3,
      priority_support: false
    },
    starter: {
      daily_questions: -1, // unlimited
      monthly_reports: 3,
      avatar_minutes: 30,
      download_access: true,
      template_access: true,
      history_limit: -1, // unlimited
      priority_support: false
    },
    pro: {
      daily_questions: -1, // unlimited
      monthly_reports: 10,
      avatar_minutes: 120,
      download_access: true,
      template_access: true,
      history_limit: -1, // unlimited
      priority_support: true
    },
    elite: {
      daily_questions: -1, // unlimited
      monthly_reports: -1, // unlimited
      avatar_minutes: 300,
      download_access: true,
      template_access: true,
      history_limit: -1, // unlimited
      priority_support: true
    },

  });

  // CSV Management state
  const [csvFilters, setCsvFilters] = useState({
    country: '',
    category: '',
    status: '',
    searchText: ''
  });
  const [csvSort, setCsvSort] = useState({
    field: 'country_name',
    direction: 'asc'
  });
  const [scrapingProgress, setScrapingProgress] = useState({
    active: false,
    total: 0,
    completed: 0,
    failed: 0,
    currentUrl: '',
    results: []
  });

  // Add vectorization progress state with proper database_stats initialization
  const [vectorizationProgress, setVectorizationProgress] = useState({
    active: false,
    total: 0,
    completed: 0,
    failed: 0,
    chunks_created: 0,
    vectors_created: 0,
    current_document: '',
    database_stats: {
      total_chunks: 0,
      total_vectors: 0,
      last_updated: null
    }
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  // Forms state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [documentForm, setDocumentForm] = useState({
    title: '', content: '', country: '', category: '', source_url: ''
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: '', task_type: 'scrape_all', schedule_type: 'daily', enabled: true
  });
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    country: '',
    country_name: '',
    flag: '',
    category: '',
    category_name: '',
    type: '',
    url: '',
    title: '',
    description: '',
    enabled: true,
    auto_refresh: false
  });

  const API_BASE = 'http://localhost:8001';

  // Authentication functions
  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAuthToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('admin_token', data.token);
        showToast('Login successful!', 'success');
        loadDashboard();
      } else {
        showToast('Invalid credentials', 'error');
      }
    } catch (error) {
      showToast('Login failed: ' + error.message, 'error');
    }
    
    setLoading(false);
  };

  const logout = () => {
    // Clear any active intervals before logout
    if (window.scrapingInterval) {
      clearInterval(window.scrapingInterval);
      window.scrapingInterval = null;
    }
    if (window.vectorizationInterval) {
      clearInterval(window.vectorizationInterval);
      window.vectorizationInterval = null;
    }
    
    setIsAuthenticated(false);
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
  };

  // Cleanup function for intervals
  const cleanupIntervals = () => {
    if (window.scrapingInterval) {
      console.log('🧹 Cleaning up scraping interval...');
      clearInterval(window.scrapingInterval);
      window.scrapingInterval = null;
    }
    if (window.vectorizationInterval) {
      console.log('🧹 Cleaning up vectorization interval...');
      clearInterval(window.vectorizationInterval);
      window.vectorizationInterval = null;
    }
  };

  // API functions with authentication
  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error('Authentication expired');
    }

    return response;
  };

  // Data loading functions
  const loadDashboard = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCsvData(),
        loadSystemStatus(),
        loadSchedules(),
        loadQdrantData(),
        loadScrapedContent(),
        loadConversations(),
        loadAnalytics(),
        loadLeads()
      ]);
    } catch (error) {
      showToast('Error loading dashboard: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const loadCsvData = async () => {
    try {
      const response = await apiCall('/admin/csv/data');
      const data = await response.json();
      if (data.status === 'success') {
        setCsvData(data.data);
      }
    } catch (error) {
      console.error('Error loading CSV data:', error);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const response = await apiCall('/admin/status');
      const data = await response.json();
      if (data.status === 'success') {
        setSystemStatus(data.stats);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await apiCall('/admin/schedules');
      const data = await response.json();
      if (data.status === 'success') {
        setSchedules(data.schedules);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  // Qdrant Knowledge Base functions
  const loadQdrantData = async () => {
    try {
      // First get Qdrant status
      const statusResponse = await apiCall('/admin/qdrant/status');
      const statusData = await statusResponse.json();
      
      // Then get collections
      const collectionsResponse = await apiCall('/admin/qdrant/collections');
      const collectionsData = await collectionsResponse.json();
      
      // Set Qdrant status from the correct response structure
      if (statusData.status === 'success' && statusData.qdrant) {
        setQdrantStatus(statusData.qdrant);
      }
      
      setQdrantData(prev => ({
        ...prev,
        collections: collectionsData.collections || [],
        status: statusData.qdrant?.connected ? 'connected' : 'disconnected'
      }));
      
      console.log('✅ Qdrant data loaded - Connected:', statusData.qdrant?.connected);
    } catch (error) {
      console.error('❌ Error loading Qdrant data:', error);
      setQdrantData(prev => ({ ...prev, status: 'error' }));
      setQdrantStatus({ connected: false, status: 'disconnected' });
    }
  };

  // Load Qdrant status separately
  const loadQdrantStatus = async () => {
    try {
      const response = await apiCall('/admin/qdrant/status');
      const data = await response.json();
      
      if (data.status === 'success' && data.qdrant) {
        setQdrantStatus(data.qdrant);
        console.log('✅ Qdrant status loaded:', data.qdrant);
      } else {
        console.error('❌ Failed to load Qdrant status:', data);
        setQdrantStatus({ connected: false, status: 'disconnected' });
      }
    } catch (error) {
      console.error('❌ Error loading Qdrant status:', error);
      setQdrantStatus({ connected: false, status: 'disconnected' });
    }
  };

  // Load Qdrant collections separately
  const loadQdrantCollections = async () => {
    try {
      const response = await apiCall('/admin/qdrant/collections');
      const data = await response.json();
      
      if (data.status === 'success') {
        setQdrantData(prev => ({
          ...prev,
          collections: data.collections || [],
          status: data.collections && data.collections.length > 0 ? 'connected' : 'empty'
        }));
        console.log('✅ Qdrant collections loaded:', data.collections);
      } else {
        console.error('❌ Failed to load Qdrant collections:', data);
      }
    } catch (error) {
      console.error('❌ Error loading Qdrant collections:', error);
    }
  };

  // NEW: Load scraped content pending vectorization
  const loadScrapedContent = async () => {
    try {
      const response = await apiCall('/admin/scraped/pending');
      const data = await response.json();
      
      if (data.status === 'success') {
        setQdrantData(prev => ({
          ...prev,
          scrapedContent: data.scraped_files || [],
          totalScrapedItems: data.total_items || 0
        }));
        console.log('✅ Scraped content loaded:', data.scraped_files);
      } else {
        console.error('❌ Failed to load scraped content:', data);
      }
    } catch (error) {
      console.error('❌ Error loading scraped content:', error);
    }
  };

  const searchQdrantCollection = async (collectionName, query = '', limit = 10) => {
    try {
      const response = await apiCall(`/admin/qdrant/search?query=${encodeURIComponent(query)}&collection=${collectionName}&limit=${limit}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setQdrantData(prev => ({
          ...prev,
          searchResults: data.results,
          selectedCollection: collectionName,
          searchQuery: query,
          // Enhanced data from new search response
          chunks_by_url: data.chunks_by_url || {},
          chunk_stats: data.chunk_stats || {},
          total_results: data.total_results || 0
        }));
        
        // Log enhanced search info
        console.log(`🔍 Enhanced search completed:`, {
          query,
          totalResults: data.total_results,
          uniqueDocuments: data.chunk_stats?.unique_documents,
          avgChunksPerDoc: data.chunk_stats?.avg_chunks_per_doc
        });
        
      } else {
        showToast('Search failed: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Search failed: ' + error.message, 'error');
    }
  };

  const deleteQdrantCollection = async (collectionName) => {
    if (!window.confirm(`Are you sure you want to delete collection "${collectionName}"?`)) return;
    
    setLoading(true);
    try {
      const response = await apiCall(`/admin/qdrant/collection/${collectionName}`, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.status === 'success') {
        showToast('Collection deleted successfully!', 'success');
        loadQdrantData(); // Reload collections
      } else {
        showToast('Delete failed: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const clearQdrantCollection = async (collectionName) => {
    if (!window.confirm(`Are you sure you want to clear all content from collection "${collectionName}"? This will remove all vectors but keep the collection.`)) return;
    
    setLoading(true);
    try {
      const response = await apiCall(`/admin/qdrant/collection/${collectionName}/clear`, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.status === 'success') {
        showToast('Collection cleared successfully!', 'success');
        loadQdrantData(); // Reload collections
      } else {
        showToast('Clear failed: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Clear failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleBrowseVectorContent = async (collectionName) => {
    if (!collectionName) {
      showToast('Please select a collection first', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      // Browse content with empty query (shows sample content)
      await searchQdrantCollection(collectionName, '', 10);
      showToast(`Browsing content from ${collectionName}`, 'success');
    } catch (error) {
      showToast('Failed to browse content: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleClearCollection = async (collectionName) => {
    await clearQdrantCollection(collectionName);
  };

  const handleDeleteCollection = async (collectionName) => {
    await deleteQdrantCollection(collectionName);
  };

  // Scraped content management functions
  const deleteScrapedFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const response = await apiCall(`/admin/scraped/file/${filename}`, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.status === 'success') {
        showToast(data.message, 'success');
        loadQdrantData(); // Reload to refresh scraped content
      } else {
        showToast('Delete failed: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const clearAllScrapedContent = async () => {
    if (!window.confirm('Are you sure you want to clear ALL scraped content files? This will delete both manual_scrape_content.json and enhanced_content.json. This action cannot be undone.')) return;
    
    setLoading(true);
    try {
      const response = await apiCall('/admin/scraped/clear-all', { method: 'DELETE' });
      const data = await response.json();
      
      if (data.status === 'success') {
        showToast(data.message, 'success');
        loadQdrantData(); // Reload to refresh scraped content
      } else {
        showToast('Clear failed: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Clear failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // CSV Management functions
  const handleCsvUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/admin/csv/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast(data.message, 'success');
        loadCsvData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const exportCsv = async () => {
    try {
      const response = await apiCall('/admin/csv/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immigration_sources_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      showToast('CSV exported successfully!', 'success');
    } catch (error) {
      showToast('Export failed: ' + error.message, 'error');
    }
  };

  // CSV Filtering and Sorting
  const getFilteredAndSortedCsvData = () => {
    let filtered = csvData.filter(row => {
      const matchesCountry = !csvFilters.country || row.country_name.toLowerCase().includes(csvFilters.country.toLowerCase());
      const matchesCategory = !csvFilters.category || row.category_name.toLowerCase().includes(csvFilters.category.toLowerCase());
      const matchesStatus = !csvFilters.status || 
        (csvFilters.status === 'enabled' && row.enabled) ||
        (csvFilters.status === 'disabled' && !row.enabled) ||
        (csvFilters.status === 'scraped' && row.last_scraped) ||
        (csvFilters.status === 'never_scraped' && !row.last_scraped);
      const matchesSearch = !csvFilters.searchText || 
        row.title.toLowerCase().includes(csvFilters.searchText.toLowerCase()) ||
        row.url.toLowerCase().includes(csvFilters.searchText.toLowerCase()) ||
        row.description.toLowerCase().includes(csvFilters.searchText.toLowerCase());
      
      return matchesCountry && matchesCategory && matchesStatus && matchesSearch;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      const aVal = a[csvSort.field] || '';
      const bVal = b[csvSort.field] || '';
      
      if (csvSort.direction === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    return filtered;
  };

  const handleSort = (field) => {
    setCsvSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const resetFilters = () => {
    setCsvFilters({
      country: '',
      category: '',
      status: '',
      searchText: ''
    });
  };

  // Enhanced scraping with progress tracking
  const triggerScrapingWithProgress = async (urlIds = null) => {
    const urlsToScrape = urlIds ? csvData.filter(r => urlIds.includes(r.id)) : csvData.filter(r => r.enabled);
    
    setScrapingProgress({
      active: true,
      total: urlsToScrape.length,
      completed: 0,
      failed: 0,
      currentUrl: '',
      results: []
    });

    try {
      const payload = urlIds ? { url_ids: urlIds } : {};
      showToast(`🔄 Starting to scrape ${urlsToScrape.length} URLs...`, 'success');
      
      const response = await apiCall('/admin/scrape/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast(`✅ Scraping started! Monitoring progress...`, 'success');
        
        // Start progress monitoring
        monitorScrapingProgress(urlsToScrape.length);
      } else {
        showToast('❌ Scraping failed: ' + data.message, 'error');
        setScrapingProgress(prev => ({ ...prev, active: false }));
      }
    } catch (error) {
      showToast('❌ Scraping failed: ' + error.message, 'error');
      setScrapingProgress(prev => ({ ...prev, active: false }));
    }
  };

  // Fixed monitoring with proper cleanup
  const monitorScrapingProgress = async (totalUrls) => {
    // Clear any existing monitoring intervals first
    if (window.scrapingInterval) {
      clearInterval(window.scrapingInterval);
      window.scrapingInterval = null;
    }

    let consecutiveErrors = 0;
    const maxErrors = 3;

    window.scrapingInterval = setInterval(async () => {
      try {
        // Check scraping progress from the new endpoint
        const response = await apiCall('/admin/scrape/progress');
        const data = await response.json();
        
        consecutiveErrors = 0; // Reset error counter on success
        
        if (data.status === 'success' && data.scraping) {
          const scrapingData = data.scraping;
          
          setScrapingProgress(prev => ({
            ...prev,
            active: scrapingData.active,
            completed: scrapingData.completed,
            failed: scrapingData.failed,
            total: scrapingData.total,
            currentUrl: scrapingData.urls_processed.length > 0 ? 
              scrapingData.urls_processed[scrapingData.urls_processed.length - 1].url : '',
            results: scrapingData.urls_processed.map(item => ({
              url: item.url,
              title: item.url.split('/').pop() || 'URL',
              status: item.status,
              processed_at: item.processed_at
            }))
          }));
          
          // Stop monitoring when scraping is complete
          if (!scrapingData.active && scrapingData.status === 'completed') {
            console.log('📋 Scraping completed, cleaning up interval...');
            clearInterval(window.scrapingInterval);
            window.scrapingInterval = null;
            setScrapingProgress(prev => ({ ...prev, active: false }));
            showToast(`✅ Scraping complete! ${scrapingData.completed} successful, ${scrapingData.failed} failed`, 'success');
            
            // Only refresh status, not CSV data to avoid infinite loop
            loadSystemStatus();
          }
        }
      } catch (error) {
        console.error('Progress monitoring error:', error);
        consecutiveErrors++;
        
        // Stop monitoring after too many consecutive errors
        if (consecutiveErrors >= maxErrors) {
          console.log('📋 Too many errors, stopping progress monitoring...');
          clearInterval(window.scrapingInterval);
          window.scrapingInterval = null;
          setScrapingProgress(prev => ({ ...prev, active: false }));
          showToast('Progress monitoring stopped due to errors', 'warning');
        }
      }
    }, 1000); // Check every 1 second for real-time updates

    // Cleanup after maximum time (10 minutes)
    setTimeout(() => {
      if (window.scrapingInterval) {
        console.log('📋 Timeout reached, cleaning up scraping interval...');
        clearInterval(window.scrapingInterval);
        window.scrapingInterval = null;
        setScrapingProgress(prev => ({ ...prev, active: false }));
      }
    }, 10 * 60 * 1000);
  };

  // Monitor vectorization progress with proper cleanup
  const monitorVectorizationProgress = async () => {
    // Clear any existing vectorization intervals first
    if (window.vectorizationInterval) {
      clearInterval(window.vectorizationInterval);
      window.vectorizationInterval = null;
    }

    let consecutiveErrors = 0;
    const maxErrors = 3;

    window.vectorizationInterval = setInterval(async () => {
      try {
        // Check vectorization progress from the new endpoint
        const response = await apiCall('/admin/vectorize/progress');
        const data = await response.json();
        
        consecutiveErrors = 0; // Reset error counter on success
        
        if (data.status === 'success' && data.vectorization) {
          setVectorizationProgress(data.vectorization);
          
          // Update UI with current progress
          const progress = data.vectorization;
          console.log(`🔄 Vectorization Progress: ${progress.completed}/${progress.total} - Phase: ${progress.phase || 'processing'}`);
          
          // If vectorization is complete, clear interval and refresh data
          if (!progress.active && progress.status === 'completed') {
            console.log('✅ Vectorization completed, clearing interval...');
            clearInterval(window.vectorizationInterval);
            window.vectorizationInterval = null;
            
            // Refresh Knowledge Base data
            setTimeout(() => {
              loadQdrantCollections();
              loadQdrantStatus();
              loadScrapedContent();
            }, 1000);
            
            showToast(`✅ Vectorization completed! Created ${progress.vectors_created || progress.completed} vectors from ${progress.completed} documents`, 'success');
          }
          
          // If vectorization failed, clear interval
          if (!progress.active && progress.status === 'error') {
            console.log('❌ Vectorization failed, clearing interval...');
            clearInterval(window.vectorizationInterval);
            window.vectorizationInterval = null;
            showToast(`❌ Vectorization failed: ${progress.error_message || 'Unknown error'}`, 'error');
          }
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`❌ Error monitoring vectorization progress (${consecutiveErrors}/${maxErrors}):`, error);
        
        if (consecutiveErrors >= maxErrors) {
          console.log('❌ Too many consecutive errors, stopping vectorization monitoring');
          clearInterval(window.vectorizationInterval);
          window.vectorizationInterval = null;
        }
      }
    }, 2000); // Check every 2 seconds

    console.log('🔄 Started vectorization progress monitoring...');
  };

  // Trigger safe batch vectorization 
  const triggerVectorization = async () => {
    // Use the safe batch vectorization approach
    return handleSafeBatchVectorize();
  };

  // Safe batch vectorization function
  const handleSafeBatchVectorize = async () => {
    if (vectorizationProgress.active) {
      showToast('Vectorization already in progress', 'warning');
      return;
    }

    // Check if collection already has vectors and warn user
    if (qdrantData.collections && qdrantData.collections.length > 0) {
      const immigrationCollection = qdrantData.collections.find(c => c.name === 'immigration_docs');
      if (immigrationCollection && immigrationCollection.points_count > 0) {
        const confirmOverwrite = window.confirm(
          `⚠️ The collection already contains ${immigrationCollection.points_count} vectors.\n\n` +
          `Running vectorization again will create DUPLICATES.\n\n` +
          `Would you like to:\n` +
          `• Click "OK" to CLEAR the collection first (recommended)\n` +
          `• Click "Cancel" to abort\n\n` +
          `Note: You can also use the "Clear Collection" button below.`
        );
        
        if (!confirmOverwrite) {
          showToast('Vectorization canceled by user', 'info');
          return;
        }
        
        // Clear the collection first
        try {
          showToast('🗑️ Clearing existing vectors first...', 'info');
          const clearResponse = await apiCall('/admin/qdrant/collection/immigration_docs/clear', {
            method: 'DELETE'
          });
          
          if (clearResponse.ok) {
            showToast('✅ Collection cleared successfully', 'success');
            // Refresh collection data
            loadQdrantData();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for UI update
          } else {
            showToast('❌ Failed to clear collection', 'error');
            return;
          }
        } catch (error) {
          showToast(`❌ Error clearing collection: ${error.message}`, 'error');
          return;
        }
      }
    }

    setLoading(true);
    setVectorizationProgress({
      active: true,
      total: null,
      completed: 0,
      failed: 0,
      chunks_created: 0,
      vectors_created: 0,
      current_document: 'Starting safe batch vectorization...',
      current_step: 'Initializing batch processing...',
      phase: 'initializing'
    });

    try {
      showToast('🚀 Starting safe batch vectorization...', 'info');

      const response = await apiCall('/admin/vectorize-batch', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        console.log('✅ Safe batch vectorization completed:', data);
        
        setVectorizationProgress({
          active: false,
          total: data.details.total_documents,
          completed: data.details.total_documents - data.details.failed_batches,
          failed: data.details.failed_batches,
          chunks_created: data.details.processed_chunks,
          vectors_created: data.details.total_vectors_in_collection || data.details.processed_chunks,
          current_document: 'Completed',
          current_step: `Successfully processed ${data.details.processed_chunks} chunks from ${data.details.total_documents} documents`,
          phase: 'completed'
        });

        showToast(`✅ Safe vectorization completed! Processed ${data.details.processed_chunks} chunks from ${data.details.total_documents} documents`, 'success');
        
        // Refresh data after completion
        loadQdrantData();
        loadScrapedContent();
        
      } else {
        console.error('❌ Safe batch vectorization failed:', data);
        setVectorizationProgress({ 
          active: false, 
          status: 'error',
          current_step: data.message || 'Vectorization failed'
        });
        showToast(`❌ ${data.message || 'Safe vectorization failed'}`, 'error');
      }
    } catch (error) {
      console.error('❌ Safe batch vectorization error:', error);
      setVectorizationProgress({ 
        active: false, 
        status: 'error',
        current_step: error.message || 'Unknown error occurred'
      });
      showToast(`❌ Failed to start safe vectorization: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Legacy vectorize function (kept for compatibility)
  const handleVectorize = async () => {
    // Redirect to safe batch vectorization
    return handleSafeBatchVectorize();
  };

  // Test RAG retrieval function
  const testRAGRetrieval = async () => {
    setLoading(true);
    try {
      showToast('🔍 Testing RAG retrieval...', 'info');
      
      const testQuestion = "What are the requirements for H-1B visa?";
      const response = await apiCall('/ask-worldwide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: testQuestion,
          user_profile: {
            destination_country: 'US',
            origin_country: 'India',
            goal: 'work'
          }
        })
      });

      if (response.ok) {
        const answer = await response.text();
        
        // Show the result in a modal or toast
        showToast(`✅ RAG Test Successful! Response length: ${answer.length} characters`, 'success');
        
        // Also log for debugging
        console.log('🔍 RAG Test Question:', testQuestion);
        console.log('✅ RAG Test Response:', answer.substring(0, 200) + '...');
        
      } else {
        const errorData = await response.json();
        showToast(`❌ RAG Test Failed: ${errorData.message || 'Unknown error'}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ RAG test error:', error);
      showToast(`❌ RAG Test Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Document upload function
  const uploadDocument = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiCall('/admin/documents/upload', {
        method: 'POST',
        body: JSON.stringify(documentForm)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Document uploaded successfully!', 'success');
        setDocumentForm({ title: '', content: '', country: '', category: '', source_url: '' });
        setShowModal(false);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // Schedule management
  const createSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiCall('/admin/schedules', {
        method: 'POST',
        body: JSON.stringify(scheduleForm)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Schedule created successfully!', 'success');
        setScheduleForm({ name: '', task_type: 'scrape_all', schedule_type: 'daily', enabled: true });
        setShowModal(false);
        loadSchedules();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Schedule creation failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // CSV Row Editing functions
  const startEditingRow = (row) => {
    setEditForm({ ...row });
    setEditingRow(row.id);
    setModalType('editRow');
    setShowModal(true);
  };

  const saveEditedRow = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update the specific row in csvData
      const updatedCsvData = csvData.map(row => 
        row.id === editForm.id ? { ...editForm } : row
      );

      // Send all CSV data to backend
      const response = await apiCall('/admin/csv/save', {
        method: 'POST',
        body: JSON.stringify(updatedCsvData)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Row updated successfully!', 'success');
        setCsvData(updatedCsvData);
        setShowModal(false);
        setEditingRow(null);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Update failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const deleteRow = async (rowId) => {
    if (!window.confirm('Are you sure you want to delete this row?')) return;
    
    setLoading(true);
    try {
      // Remove the row from csvData
      const updatedCsvData = csvData.filter(row => row.id !== rowId);

      // Send updated data to backend
      const response = await apiCall('/admin/csv/save', {
        method: 'POST',
        body: JSON.stringify(updatedCsvData)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Row deleted successfully!', 'success');
        setCsvData(updatedCsvData);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const toggleRowEnabled = async (rowId) => {
    setLoading(true);
    try {
      // Toggle the enabled status
      const updatedCsvData = csvData.map(row => 
        row.id === rowId ? { ...row, enabled: !row.enabled } : row
      );

      // Send updated data to backend
      const response = await apiCall('/admin/csv/save', {
        method: 'POST',
        body: JSON.stringify(updatedCsvData)
      });

      const data = await response.json();
      if (data.status === 'success') {
        setCsvData(updatedCsvData);
        const row = updatedCsvData.find(r => r.id === rowId);
        showToast(`Row ${row.enabled ? 'enabled' : 'disabled'} successfully!`, 'success');
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Toggle failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // Enhanced manual refresh functions
  const refreshSingleUrl = async (rowId) => {
    if (scrapingProgress.active) {
      showToast('Scraping already in progress. Please wait for completion.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiCall('/admin/scrape/manual', {
        method: 'POST',
        body: JSON.stringify({ url_ids: [rowId] })
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Single URL refresh started!', 'success');
        
        // Start progress monitoring for single URL
        setScrapingProgress({
          active: true,
          total: 1,
          completed: 0,
          failed: 0,
          currentUrl: '',
          results: []
        });
        
        monitorScrapingProgress(1);
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Single refresh failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const bulkRefreshSelected = async () => {
    if (selectedRows.length === 0) return;
    
    triggerScrapingWithProgress(selectedRows);
  };

  const bulkToggleEnabled = async (enabledState) => {
    if (selectedRows.length === 0) return;
    
    setLoading(true);
    try {
      // Update selected rows
      const updatedCsvData = csvData.map(row => 
        selectedRows.includes(row.id) ? { ...row, enabled: enabledState } : row
      );

      // Send updated data to backend
      const response = await apiCall('/admin/csv/save', {
        method: 'POST',
        body: JSON.stringify(updatedCsvData)
      });

      const data = await response.json();
      if (data.status === 'success') {
        setCsvData(updatedCsvData);
        showToast(`${selectedRows.length} URLs ${enabledState ? 'enabled' : 'disabled'} successfully!`, 'success');
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Bulk toggle failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // Utility functions
  const showToast = (message, variant) => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 5000);
  };

  const toggleRowSelection = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // Conversations functions (NEW)
  const loadConversations = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(conversationFilters).forEach(key => {
        if (conversationFilters[key]) {
          params.append(key, conversationFilters[key]);
        }
      });

      const response = await apiCall(`/admin/conversations?${params}`);
      const data = await response.json();
      if (data.status === 'success') {
        setConversations(data.conversations);
        setConversationStats(prev => ({
          ...prev,
          total_count: data.total_count
        }));
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await apiCall('/admin/analytics');
      const data = await response.json();
      if (data.status === 'success') {
        setConversationStats(prev => ({
          ...prev,
          analytics: data.analytics
        }));
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const submitFeedback = async (conversationId, rating, feedbackType, comments = '') => {
    try {
      const response = await fetch(`${API_BASE}/admin/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          rating,
          feedback_type: feedbackType,
          comments
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Feedback submitted successfully!', 'success');
        loadConversations(); // Refresh
      } else {
        showToast('Failed to submit feedback: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Failed to submit feedback: ' + error.message, 'error');
    }
  };

  // User management functions (NEW)
  const loadUsers = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(userFilters).forEach(key => {
        if (userFilters[key]) {
          params.append(key, userFilters[key]);
        }
      });

      const response = await apiCall(`/admin/users?${params}`);
      const data = await response.json();
      if (data.status === 'success') {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const updateUserTier = async (userId, newTier) => {
    try {
      const response = await apiCall(`/admin/users/${userId}/tier`, {
        method: 'PUT',
        body: JSON.stringify({ tier: newTier })
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('User tier updated successfully!', 'success');
        loadUsers(); // Refresh
      } else {
        showToast('Failed to update user tier: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Failed to update user tier: ' + error.message, 'error');
    }
  };

  const updateTierSettings = async () => {
    try {
      const response = await apiCall('/admin/tier-settings', {
        method: 'PUT',
        body: JSON.stringify(tierSettings)
      });

      const data = await response.json();
      if (data.status === 'success') {
        showToast('Tier settings updated successfully!', 'success');
      } else {
        showToast('Failed to update tier settings: ' + data.message, 'error');
      }
    } catch (error) {
      showToast('Failed to update tier settings: ' + error.message, 'error');
    }
  };

  // Leads functions (NEW)
  const loadLeads = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(leadFilters).forEach(key => {
        if (leadFilters[key]) {
          params.append(key, leadFilters[key]);
        }
      });

      const response = await apiCall(`/admin/leads?${params}`);
      const data = await response.json();
      if (data.status === 'success') {
        setLeads(data.leads);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    if (authToken) {
      setIsAuthenticated(true);
      loadDashboard();
    }
  }, [authToken]);

  // Load data when tab changes
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'conversations') {
        loadConversations();
        loadAnalytics();
      } else if (activeTab === 'users') {
        loadUsers();
      } else if (activeTab === 'leads') {
        loadLeads();
      }
    }
  }, [activeTab, isAuthenticated]);

  // Cleanup intervals on component unmount
  useEffect(() => {
    return () => {
      cleanupIntervals();
    };
  }, []);

  // Login screen
  if (!isAuthenticated) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ width: '400px' }}>
          <Card.Header className="text-center">
            <Shield size={32} className="mb-2" />
            <h4>Secure Admin Portal</h4>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={login}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  required
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Login'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  // Main admin interface
  return (
    <Container fluid>
      {/* Inject custom CSS styles */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      {/* Toast notifications */}
      <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
        <Toast show={toast.show} onClose={() => setToast({...toast, show: false})}>
          <Toast.Header>
            <strong className="me-auto">
              {toast.variant === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {toast.variant === 'success' ? ' Success' : ' Error'}
            </strong>
          </Toast.Header>
          <Toast.Body>{toast.message}</Toast.Body>
        </Toast>
      </div>

      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2 style={{ color: 'white' }}><Database size={28} /> Immigration Admin Panel</h2>
            <div>
              <span className="me-3" style={{ color: 'white' }}>Welcome, {user?.username}</span>
              <Button 
                variant="outline-light" 
                size="sm" 
                onClick={logout}
                style={{ 
                  color: 'white', 
                  borderColor: 'white',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = 'white';
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Navigation Tabs */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        
        {/* Dashboard Tab */}
        <Tab eventKey="dashboard" title={<><Activity size={16} /> Dashboard</>}>
          <Row>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6><FileText size={16} /> Total URLs</h6>
                  <h3>{systemStatus?.total_urls || 0}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6><CheckCircle size={16} /> Enabled URLs</h6>
                  <h3 className="text-success">{systemStatus?.enabled_urls || 0}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6><Database size={16} /> Vectors</h6>
                  <h3 className="text-info">{systemStatus?.vector_count || 0}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6>💬 Conversations</h6>
                  <h3 className="text-primary">{systemStatus?.total_conversations || 0}</h3>
                  <small className="text-muted">({systemStatus?.conversations_24h || 0} today)</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6>🎯 Leads</h6>
                  <h3 className="text-warning">{systemStatus?.total_leads || leads.length}</h3>
                  <small className="text-muted">({systemStatus?.leads_24h || 0} today)</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="mb-3">
                <Card.Body>
                  <h6>⭐ Feedback</h6>
                  <h3 className="text-info">{systemStatus?.total_feedback || 0}</h3>
                  <small className="text-muted">{conversationStats?.analytics?.average_rating ? `Avg: ${conversationStats.analytics.average_rating}★` : 'No ratings'}</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Analytics Overview */}
          {conversationStats?.analytics && (
            <Row className="mb-4">
              <Col md={6}>
                <Card className="h-100">
                  <Card.Header><h6>🏆 Top Destinations</h6></Card.Header>
                  <Card.Body>
                    {conversationStats.analytics.top_destinations?.slice(0, 5).map((dest, index) => (
                      <div key={index} className="d-flex justify-content-between mb-2">
                        <span>{dest.country}</span>
                        <Badge bg="primary">{dest.count}</Badge>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="h-100">
                  <Card.Header><h6>🎯 Top Goals</h6></Card.Header>
                  <Card.Body>
                    {conversationStats.analytics.top_goals?.slice(0, 5).map((goal, index) => (
                      <div key={index} className="d-flex justify-content-between mb-2">
                        <span>{goal.goal}</span>
                        <Badge bg="success">{goal.count}</Badge>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Quick Actions */}
          <Card className="mb-4">
            <Card.Header><h5>🚀 Quick Actions</h5></Card.Header>
            <Card.Body>
              <Row>
                <Col md={8}>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button 
                      variant="primary" 
                      onClick={() => triggerScrapingWithProgress()}
                      disabled={loading || scrapingProgress.active}
                    >
                      <Play size={16} /> Scrape All URLs ({systemStatus?.enabled_urls || 0})
                    </Button>
                    <Button 
                      variant="success" 
                      onClick={handleVectorize}
                      disabled={loading || vectorizationProgress.active}
                    >
                      <Database size={16} /> Vectorize Content
                    </Button>
                    <Button 
                      variant="info" 
                      onClick={exportCsv}
                      disabled={loading}
                    >
                      <Download size={16} /> Export CSV
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={loadDashboard}
                      disabled={loading}
                    >
                      <RefreshCw size={16} /> Refresh All
                    </Button>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="text-end">
                    <small className="text-muted">
                      Last updated: {new Date().toLocaleTimeString()}
                    </small>
                    <br />
                    <Badge bg={loading ? 'warning' : 'success'}>
                      {loading ? 'Processing...' : 'Ready'}
                    </Badge>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Manual Operations Status */}
          <Card className="mb-4">
            <Card.Header><h5>📋 Manual Operations Guide</h5></Card.Header>
            <Card.Body>
              <Row>
                <Col md={4}>
                  <Card className="border-primary h-100">
                    <Card.Body>
                      <h6 className="text-primary">🔄 Single URL Refresh</h6>
                      <p className="small">Click the refresh button next to any URL in the CSV Management tab to scrape just that URL.</p>
                      <Badge bg="info">Available in CSV tab</Badge>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-success h-100">
                    <Card.Body>
                      <h6 className="text-success">📦 Bulk Operations</h6>
                      <p className="small">Select multiple URLs and use bulk actions to scrape, enable, or disable multiple URLs at once.</p>
                      <Badge bg="success">Select rows first</Badge>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-warning h-100">
                    <Card.Body>
                      <h6 className="text-warning">🧠 Knowledge Base</h6>
                      <p className="small">After scraping, use "Vectorize" to add content to your AI knowledge base for better responses.</p>
                      <Badge bg="warning">After scraping</Badge>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Recent Activity */}
          <Card>
            <Card.Header><h5>Recent Activity</h5></Card.Header>
            <Card.Body>
              {systemStatus?.recent_activity?.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {systemStatus.recent_activity.map((activity, index) => (
                    <div key={index} className="border-bottom py-2">
                      <small className="text-muted">{activity.timestamp}</small>
                      <div><strong>{activity.action}</strong>: {activity.details}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No recent activity</p>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* CSV Management Tab */}
        <Tab eventKey="csv" title={<><FileText size={16} /> CSV Management</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>Immigration Sources CSV ({getFilteredAndSortedCsvData().length} of {csvData.length} records)</h5>
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ display: 'none' }}
                  id="csv-upload"
                />
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => document.getElementById('csv-upload').click()}
                  className="me-2"
                >
                  <Upload size={16} /> Upload CSV
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={exportCsv} className="me-2">
                  <Download size={16} /> Export
                </Button>
                <Button variant="outline-info" size="sm" onClick={loadCsvData}>
                  <RefreshCw size={16} /> Refresh View
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              
              {/* Scraping Progress Display */}
              {scrapingProgress.active && (
                <Alert variant="info" className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>🔄 Scraping in Progress...</strong>
                      <div>Progress: {scrapingProgress.completed}/{scrapingProgress.total} completed, {scrapingProgress.failed} failed</div>
                    </div>
                    <div className="text-end">
                      <ProgressBar 
                        now={(scrapingProgress.completed + scrapingProgress.failed) / scrapingProgress.total * 100} 
                        style={{ width: '200px' }}
                        label={`${Math.round((scrapingProgress.completed + scrapingProgress.failed) / scrapingProgress.total * 100)}%`}
                      />
                    </div>
                  </div>
                  {scrapingProgress.results.length > 0 && (
                    <div className="mt-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                      <small>Recent results:</small>
                      {scrapingProgress.results.slice(-3).map((result, index) => (
                        <div key={index} className="small">
                          <Badge bg={result.status === 'success' ? 'success' : 'danger'}>
                            {result.status === 'success' ? '✅' : '❌'}
                          </Badge> {result.title}
                        </div>
                      ))}
                    </div>
                  )}
                </Alert>
              )}

              {/* Filters and Search */}
              <Row className="mb-3">
                <Col md={12}>
                  <Card className="border-secondary">
                    <Card.Header>
                      <strong>🔍 Filters & Search</strong>
                      <Button variant="outline-secondary" size="sm" className="float-end" onClick={resetFilters}>
                        <RefreshCw size={12} /> Reset
                      </Button>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Search Text</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Search titles, URLs, descriptions..."
                              value={csvFilters.searchText}
                              onChange={(e) => setCsvFilters(prev => ({...prev, searchText: e.target.value}))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Country</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Filter by country"
                              value={csvFilters.country}
                              onChange={(e) => setCsvFilters(prev => ({...prev, country: e.target.value}))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Category</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Filter by category"
                              value={csvFilters.category}
                              onChange={(e) => setCsvFilters(prev => ({...prev, category: e.target.value}))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Status</Form.Label>
                            <Form.Select
                              value={csvFilters.status}
                              onChange={(e) => setCsvFilters(prev => ({...prev, status: e.target.value}))}
                            >
                              <option value="">All Status</option>
                              <option value="enabled">Enabled</option>
                              <option value="disabled">Disabled</option>
                              <option value="scraped">Recently Scraped</option>
                              <option value="never_scraped">Never Scraped</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Sort By</Form.Label>
                            <div className="d-flex gap-2">
                              <Form.Select
                                value={csvSort.field}
                                onChange={(e) => setCsvSort(prev => ({...prev, field: e.target.value}))}
                              >
                                <option value="country_name">Country</option>
                                <option value="category_name">Category</option>
                                <option value="title">Title</option>
                                <option value="last_scraped">Last Scraped</option>
                                <option value="enabled">Status</option>
                              </Form.Select>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setCsvSort(prev => ({...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc'}))}
                              >
                                {csvSort.direction === 'asc' ? '⬆️' : '⬇️'}
                              </Button>
                            </div>
                          </Form.Group>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Enhanced Control Panel */}
              <Row className="mb-3">
                <Col md={6}>
                  <Card className="border-primary">
                    <Card.Header><strong>🔄 Manual Refresh Controls</strong></Card.Header>
                    <Card.Body>
                      <div className="d-grid gap-2">
                        <Button 
                          variant="primary" 
                          onClick={() => triggerScrapingWithProgress()}
                          disabled={loading || scrapingProgress.active}
                        >
                          <Play size={16} /> Scrape All Enabled URLs ({csvData.filter(r => r.enabled).length})
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          onClick={() => triggerScrapingWithProgress(selectedRows)}
                          disabled={loading || selectedRows.length === 0 || scrapingProgress.active}
                        >
                          <Play size={16} /> Scrape Selected ({selectedRows.length})
                        </Button>
                        <Button 
                          variant="success" 
                          onClick={handleVectorize}
                          disabled={loading || vectorizationProgress.active}
                        >
                          <Database size={16} /> Vectorize & Add to Knowledge Base
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-info">
                    <Card.Header><strong>📊 Current View Stats</strong></Card.Header>
                    <Card.Body>
                      <div className="row text-center">
                        <div className="col-3">
                          <div className="h5 text-primary">{getFilteredAndSortedCsvData().length}</div>
                          <small>Filtered</small>
                        </div>
                        <div className="col-3">
                          <div className="h5 text-success">{getFilteredAndSortedCsvData().filter(r => r.enabled).length}</div>
                          <small>Enabled</small>
                        </div>
                        <div className="col-3">
                          <div className="h5 text-warning">{selectedRows.length}</div>
                          <small>Selected</small>
                        </div>
                        <div className="col-3">
                          <div className="h5 text-info">{getFilteredAndSortedCsvData().filter(r => r.last_scraped).length}</div>
                          <small>Scraped</small>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {selectedRows.length > 0 && (
                <Alert variant="info" className="mb-3">
                  <strong>{selectedRows.length} URLs selected</strong> - You can bulk scrape, enable/disable, or clear selection
                  <div className="mt-2">
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => triggerScrapingWithProgress(selectedRows)}
                      className="me-2"
                      disabled={loading || scrapingProgress.active}
                    >
                      <Play size={16} /> Scrape Selected
                    </Button>
                    <Button 
                      variant="outline-success" 
                      size="sm"
                      onClick={() => bulkToggleEnabled(true)}
                      className="me-2"
                      disabled={loading}
                    >
                      <CheckCircle size={16} /> Enable All
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => bulkToggleEnabled(false)}
                      className="me-2"
                      disabled={loading}
                    >
                      <XCircle size={16} /> Disable All
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => setSelectedRows([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </Alert>
              )}
              
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th width="50">
                        <Form.Check
                          type="checkbox"
                          checked={selectedRows.length === getFilteredAndSortedCsvData().length && getFilteredAndSortedCsvData().length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRows(getFilteredAndSortedCsvData().map(row => row.id));
                            } else {
                              setSelectedRows([]);
                            }
                          }}
                        />
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('country_name')}>
                        Country {csvSort.field === 'country_name' && (csvSort.direction === 'asc' ? '⬆️' : '⬇️')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category_name')}>
                        Category {csvSort.field === 'category_name' && (csvSort.direction === 'asc' ? '⬆️' : '⬇️')}
                      </th>
                      <th>Type</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('title')}>
                        Title {csvSort.field === 'title' && (csvSort.direction === 'asc' ? '⬆️' : '⬇️')}
                      </th>
                      <th>URL</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('enabled')}>
                        Status {csvSort.field === 'enabled' && (csvSort.direction === 'asc' ? '⬆️' : '⬇️')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAndSortedCsvData().map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedRows.includes(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                          />
                        </td>
                        <td>{row.country_name} {row.flag}</td>
                        <td>{row.category_name}</td>
                        <td><Badge bg="secondary">{row.type}</Badge></td>
                        <td style={{ maxWidth: '200px' }}>
                          <div className="text-truncate" title={row.title}>
                            {row.title}
                          </div>
                        </td>
                        <td style={{ maxWidth: '200px' }}>
                          <div className="text-truncate" title={row.url}>
                            <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                              {row.url}
                            </a>
                          </div>
                        </td>
                        <td>
                          <Badge 
                            bg={row.enabled ? 'success' : 'secondary'} 
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleRowEnabled(row.id)}
                            title="Click to toggle"
                          >
                            {row.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {row.last_scraped && (
                            <div>
                              <small className="text-muted">
                                Last: {new Date(row.last_scraped).toLocaleDateString()}
                              </small>
                            </div>
                          )}
                          {row.scrape_status === 'failed' && (
                            <div>
                              <Badge bg="danger" title={row.error_message}>Failed</Badge>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            <Button 
                              size="sm" 
                              variant="outline-success"
                              onClick={() => refreshSingleUrl(row.id)}
                              title="Refresh this URL"
                              disabled={loading || scrapingProgress.active}
                            >
                              <RefreshCw size={12} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => startEditingRow(row)}
                              title="Edit row"
                            >
                              <Edit size={12} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-danger"
                              onClick={() => deleteRow(row.id)}
                              title="Delete row"
                            >
                              <Trash size={12} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-info"
                              onClick={() => window.open(row.url, '_blank')}
                              title="View URL"
                            >
                              <Eye size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              {getFilteredAndSortedCsvData().length === 0 && csvData.length > 0 && (
                <Alert variant="warning" className="text-center">
                  <h5>No URLs match current filters</h5>
                  <p>Try adjusting your filters or search terms.</p>
                  <Button variant="secondary" onClick={resetFilters}>
                    <RefreshCw size={16} /> Reset Filters
                  </Button>
                </Alert>
              )}
              
              {csvData.length === 0 && (
                <Alert variant="warning" className="text-center">
                  <h5>No CSV data found</h5>
                  <p>Upload a CSV file or check if the database is properly initialized.</p>
                  <Button variant="primary" onClick={loadCsvData}>
                    <RefreshCw size={16} /> Reload Data
                  </Button>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Document Upload Tab */}
        <Tab eventKey="documents" title={<><Upload size={16} /> Documents</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>Manual Document Upload</h5>
              <Button 
                variant="primary"
                onClick={() => {
                  setModalType('document');
                  setShowModal(true);
                }}
              >
                <Plus size={16} /> Add Document
              </Button>
            </Card.Header>
            <Card.Body>
              <p className="text-muted">
                Upload documents manually for URLs that failed to scrape or for additional content.
                Documents will be automatically vectorized and added to your knowledge base.
              </p>
              
              {/* Document list would go here */}
              <Alert variant="info">
                Manual documents will appear here after upload
              </Alert>
            </Card.Body>
          </Card>
        </Tab>

        {/* Scheduling Tab */}
        <Tab eventKey="scheduling" title={<><Calendar size={16} /> Scheduling</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>Automated Scheduling</h5>
              <Button 
                variant="primary"
                onClick={() => {
                  setModalType('schedule');
                  setShowModal(true);
                }}
              >
                <Plus size={16} /> Add Schedule
              </Button>
            </Card.Header>
            <Card.Body>
              <Table striped>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Last Run</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>{schedule.name}</td>
                      <td><Badge bg="info">{schedule.task_type}</Badge></td>
                      <td>{schedule.schedule_type}</td>
                      <td>
                        <Badge bg={schedule.enabled ? 'success' : 'secondary'}>
                          {schedule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>{schedule.last_run || 'Never'}</td>
                      <td>
                        <Button size="sm" variant="outline-primary">
                          <Edit size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* Knowledge Base Tab */}
        <Tab eventKey="knowledge" title={<><Database size={16} /> Knowledge Base</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>🧠 RAG Knowledge Base & Vector Database</h5>
              <div>
                <Badge bg={qdrantStatus?.connected || qdrantData.status === 'connected' ? 'success' : 'danger'} className="me-2">
                  {qdrantStatus?.connected || qdrantData.status === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
                <Button 
                  variant="success" 
                  size="sm"
                  onClick={triggerVectorization}
                  disabled={loading || vectorizationProgress.active}
                  className="me-2"
                >
                  <Database size={16} /> {vectorizationProgress.active ? 'Safe Batch Vectorizing...' : 'Safe Batch Vectorize'}
                </Button>
                <Button 
                  variant="info" 
                  size="sm"
                  onClick={testRAGRetrieval}
                  disabled={loading}
                  className="me-2"
                >
                  <Search size={16} /> Test RAG
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={() => {
                  loadQdrantData();
                  loadQdrantStatus();
                  loadQdrantCollections();
                  loadScrapedContent();
                }}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {qdrantStatus?.connected || qdrantData.status === 'connected' ? (
                <>
                  {/* Enhanced Vectorization Progress Display */}
                  {vectorizationProgress.active && (
                    <Alert variant="info" className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">
                          🔄 RAG Vectorization in Progress...
                          {vectorizationProgress.phase && (
                            <Badge bg="primary" className="ms-2">
                              {vectorizationProgress.phase === 'chunking' && '📄 Chunking'}
                              {vectorizationProgress.phase === 'embedding' && '🔄 Embedding'}
                              {vectorizationProgress.phase === 'storage' && '💾 Storing'}
                              {vectorizationProgress.phase === 'completed' && '✅ Complete'}
                              {!['chunking', 'embedding', 'storage', 'completed'].includes(vectorizationProgress.phase) && vectorizationProgress.phase}
                            </Badge>
                          )}
                        </h6>
                        <Badge bg="primary">
                          {vectorizationProgress.completed}/{vectorizationProgress.total} documents
                        </Badge>
                      </div>
                      
                      {/* Current Document/Step */}
                      {vectorizationProgress.current_document && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <strong>Current:</strong> {vectorizationProgress.current_document}
                          </small>
                        </div>
                      )}
                      
                      {vectorizationProgress.current_step && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <strong>Step:</strong> {vectorizationProgress.current_step}
                          </small>
                        </div>
                      )}
                      
                      {/* Document Progress */}
                      <div className="progress mb-2" style={{height: '8px'}}>
                        <div 
                          className="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                          style={{width: `${vectorizationProgress.total > 0 ? (vectorizationProgress.completed / vectorizationProgress.total) * 100 : 0}%`}}
                        ></div>
                      </div>
                      
                      {/* Embedding Progress */}
                      {vectorizationProgress.embedding_progress && (
                        <>
                          <div className="mb-1">
                            <small className="text-muted">
                              <strong>Embedding Progress:</strong> {vectorizationProgress.embedding_progress.completed_chunks || 0}/{vectorizationProgress.embedding_progress.total_chunks || 0} chunks
                            </small>
                          </div>
                          <div className="progress mb-2" style={{height: '6px'}}>
                            <div 
                              className="progress-bar progress-bar-striped progress-bar-animated bg-info" 
                              style={{width: `${vectorizationProgress.embedding_progress.total_chunks > 0 ? (vectorizationProgress.embedding_progress.completed_chunks / vectorizationProgress.embedding_progress.total_chunks) * 100 : 0}%`}}
                            ></div>
                          </div>
                        </>
                      )}
                      
                      <Row className="g-2 mb-2">
                        <Col md={6}>
                          <small className="text-muted">
                            Progress: {vectorizationProgress.completed}/{vectorizationProgress.total} documents, 
                            {vectorizationProgress.failed || 0} failed
                          </small>
                        </Col>
                        <Col md={6}>
                          <small className="text-muted">
                            Created: {vectorizationProgress.chunks_created || 0} chunks, {vectorizationProgress.vectors_created || 0} vectors
                          </small>
                        </Col>
                      </Row>
                    </Alert>
                  )}

                  {/* Database Statistics */}
                  <Row className="mb-4">
                    <Col md={3}>
                      <Card className="border-0 bg-light text-center">
                        <Card.Body>
                          <h3 className="text-primary mb-1">{qdrantStatus?.total_vectors || vectorizationProgress.database_stats?.total_chunks || 0}</h3>
                          <small className="text-muted">Total Vectors</small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={3}>
                      <Card className="border-0 bg-light text-center">
                        <Card.Body>
                          <h3 className="text-success mb-1">{qdrantStatus?.indexed_vectors || vectorizationProgress.database_stats?.total_vectors || 0}</h3>
                          <small className="text-muted">Indexed Vectors</small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={3}>
                      <Card className="border-0 bg-light text-center">
                        <Card.Body>
                          <h3 className="text-info mb-1">
                            {qdrantData.collections.length > 0 ? 
                              qdrantData.collections.reduce((sum, col) => sum + (col.points_count || col.vectors_count || 0), 0) : 
                              qdrantStatus?.total_vectors || 0}
                          </h3>
                          <small className="text-muted">Vector Points</small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={3}>
                      <Card className="border-0 bg-light text-center">
                        <Card.Body>
                          <h3 className="text-warning mb-1">{qdrantData.collections.length || 1}</h3>
                          <small className="text-muted">Collections</small>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* NEW: Scraped Content Ready for Vectorization */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="border-success">
                        <Card.Header><strong>📄 Scraped Content Ready for Vectorization</strong></Card.Header>
                        <Card.Body>
                          {qdrantData.scrapedContent && qdrantData.scrapedContent.length > 0 ? (
                            <>
                              <div className="mb-3">
                                <Badge bg="success" className="me-2">
                                  {qdrantData.totalScrapedItems} Total Items
                                </Badge>
                                <Badge bg="info" className="me-3">
                                  {qdrantData.scrapedContent.length} Files
                                </Badge>
                                <Button 
                                  size="sm" 
                                  variant="outline-danger"
                                  onClick={clearAllScrapedContent}
                                  disabled={loading}
                                >
                                  🗑️ Clear All Files
                                </Button>
                              </div>
                              
                              {qdrantData.scrapedContent.map((file, index) => (
                                <Card key={index} className="mb-3">
                                  <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                      <div>
                                        <h6 className="mb-1">{file.type}</h6>
                                        <small className="text-muted">{file.file}</small>
                                      </div>
                                      <div className="text-end">
                                        <Badge bg={file.vectorized ? 'success' : 'warning'}>
                                          {file.vectorized ? '✅ Vectorized' : '⏳ Ready for Vectorization'}
                                        </Badge>
                                        <div className="small text-muted mt-1">
                                          {file.count} items • {file.size_mb} MB
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {file.sample_urls && file.sample_urls.length > 0 && (
                                      <div className="mt-2">
                                        <small className="text-muted d-block mb-1">Sample URLs:</small>
                                        <div className="small">
                                          {file.sample_urls.slice(0, 3).map((url, urlIndex) => (
                                            <div key={urlIndex} className="text-truncate">
                                              🔗 {url}
                                            </div>
                                          ))}
                                          {file.sample_urls.length > 3 && (
                                            <div className="text-muted">
                                              ... and {file.sample_urls.length - 3} more URLs
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {file.ready_for_vectorization && !file.vectorized && (
                                      <div className="mt-2">
                                        <div className="d-flex gap-2">
                                          <Button 
                                            size="sm" 
                                            variant="success"
                                            onClick={triggerVectorization}
                                            disabled={loading || vectorizationProgress.active}
                                          >
                                            <Database size={14} /> Vectorize This Content
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="outline-danger"
                                            onClick={() => deleteScrapedFile(file.file)}
                                            disabled={loading}
                                          >
                                            🗑️ Delete
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {file.vectorized && (
                                      <div className="mt-2">
                                        <Button 
                                          size="sm" 
                                          variant="outline-danger"
                                          onClick={() => deleteScrapedFile(file.file)}
                                          disabled={loading}
                                        >
                                          🗑️ Delete File
                                        </Button>
                                      </div>
                                    )}
                                  </Card.Body>
                                </Card>
                              ))}
                            </>
                          ) : (
                            <Alert variant="info" className="text-center">
                              <h6>No scraped content found</h6>
                              <p>Scrape some URLs first to see content ready for vectorization.</p>
                              <Button variant="primary" onClick={() => setActiveTab('csv')}>
                                🔄 Go to CSV Management
                              </Button>
                            </Alert>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Collections Overview */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="border-info">
                        <Card.Header><strong>📊 Vector Collections</strong></Card.Header>
                        <Card.Body>
                          {qdrantData.collections.length > 0 ? (
                            <Row>
                              {qdrantData.collections.map((collection, index) => (
                                <Col md={6} key={index} className="mb-3">
                                  <Card className="h-100 border-primary">
                                    <Card.Header className="d-flex justify-content-between align-items-center">
                                      <strong>{collection.name}</strong>
                                      <Badge bg="success">{collection.points_count || 0}</Badge>
                                    </Card.Header>
                                    <Card.Body>
                                      <div className="mb-2">
                                        <small className="text-muted">
                                          Points: {collection.points_count || 0} | Vectors: {collection.vectors_count || 0}
                                        </small>
                                      </div>
                                      {vectorizationProgress?.database_stats?.last_updated && (
                                        <div className="mb-2">
                                          <small className="text-muted">
                                            Last updated: {new Date(vectorizationProgress.database_stats.last_updated).toLocaleString()}
                                          </small>
                                        </div>
                                      )}
                                      <div className="d-grid gap-2">
                                        <Button 
                                          size="sm" 
                                          variant="outline-primary"
                                          onClick={() => searchQdrantCollection(collection.name)}
                                        >
                                          <Eye size={12} /> Browse Content
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline-warning"
                                          onClick={() => handleClearCollection(collection.name)}
                                          disabled={loading}
                                        >
                                          🗑️ Clear Collection
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline-danger"
                                          onClick={() => handleDeleteCollection(collection.name)}
                                          disabled={loading}
                                        >
                                          ❌ Delete Collection
                                        </Button>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </Col>
                              ))}
                            </Row>
                          ) : (
                            <Alert variant="info" className="text-center">
                              <Database size={48} className="text-muted mb-3" />
                              <h6>No collections found</h6>
                              <p>Create your first collection by vectorizing some scraped content!</p>
                              <Button variant="primary" onClick={handleVectorize}>
                                <Database size={16} /> Start Vectorization
                              </Button>
                            </Alert>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Enhanced Search Interface */}
                  {qdrantData.selectedCollection && (
                    <Row className="mb-4">
                      <Col md={12}>
                        <Card className="border-success">
                          <Card.Header>
                            <strong>🔍 Semantic Search: {qdrantData.selectedCollection}</strong>
                          </Card.Header>
                          <Card.Body>
                            <Form.Group className="mb-3">
                              <Form.Label>Search Query (RAG-powered)</Form.Label>
                              <div className="d-flex gap-2">
                                <Form.Control
                                  type="text"
                                  placeholder="Enter search query (e.g., 'I-130', 'work visa', 'green card')"
                                  value={qdrantData.searchQuery}
                                  onChange={(e) => setQdrantData(prev => ({...prev, searchQuery: e.target.value}))}
                                  onKeyPress={(e) => e.key === 'Enter' && searchQdrantCollection(qdrantData.selectedCollection, qdrantData.searchQuery)}
                                />
                                <Button 
                                  variant="primary"
                                  onClick={() => searchQdrantCollection(qdrantData.selectedCollection, qdrantData.searchQuery)}
                                  disabled={loading}
                                >
                                  <Database size={16} /> Search
                                </Button>
                              </div>
                            </Form.Group>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* Enhanced Search Results */}
                  {qdrantData.searchResults && qdrantData.searchResults.length > 0 && (
                    <Row>
                      <Col md={12}>
                        <Card className="border-warning">
                          <Card.Header>
                            <strong>📋 Search Results ({qdrantData.searchResults.length})</strong>
                            {qdrantData.chunk_stats && (
                              <div className="float-end">
                                <Badge bg="info" className="me-2">
                                  {qdrantData.chunk_stats.unique_documents} Documents
                                </Badge>
                                <Badge bg="success">
                                  {qdrantData.chunk_stats.avg_chunks_per_doc} Avg Chunks/Doc
                                </Badge>
                              </div>
                            )}
                          </Card.Header>
                          <Card.Body>
                            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                              {qdrantData.searchResults.map((result, index) => {
                                const chunkInfo = result.chunk_info || {};
                                const metadata = result.metadata || {};
                                const sourceUrl = result.url || '';
                                
                                return (
                                  <Card key={index} className="mb-3">
                                    <Card.Body>
                                      <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="flex-grow-1">
                                          <h6 className="mb-1">
                                            {result.title || result.original_title || 'Untitled Document'}
                                          </h6>
                                          <div className="d-flex gap-2 mb-2 flex-wrap">
                                            <Badge bg="primary">
                                              Score: {result.score?.toFixed(3) || '0.000'}
                                            </Badge>
                                            <Badge bg="success">
                                              Chunk {(chunkInfo.index ?? 0) + 1}
                                            </Badge>
                                            {chunkInfo.type && (
                                              <Badge bg="info">{chunkInfo.type}</Badge>
                                            )}
                                            {metadata.search_type && (
                                              <Badge bg="secondary">{metadata.search_type}</Badge>
                                            )}
                                            {metadata.country && (
                                              <Badge bg="warning">{metadata.country}</Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-end">
                                          {sourceUrl && (
                                            <Button 
                                              size="sm" 
                                              variant="outline-primary"
                                              onClick={() => window.open(sourceUrl, '_blank')}
                                              className="mb-2"
                                            >
                                              <Eye size={12} /> View Source
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Enhanced Section Information */}
                                      {(chunkInfo.section || chunkInfo.subsection) && (
                                        <div className="mb-2 p-2 bg-light rounded">
                                          <small className="text-muted">
                                            {chunkInfo.section && (
                                              <span><strong>Section:</strong> {chunkInfo.section}</span>
                                            )}
                                            {chunkInfo.subsection && chunkInfo.subsection !== chunkInfo.section && (
                                              <span className="ms-3"><strong>Subsection:</strong> {chunkInfo.subsection}</span>
                                            )}
                                          </small>
                                        </div>
                                      )}
                                      
                                      {/* Content Preview */}
                                      <p className="mb-2" style={{ maxHeight: '100px', overflow: 'hidden' }}>
                                        {result.content_preview || 'No content preview available'}
                                      </p>
                                      
                                      {/* Enhanced Metadata Display */}
                                      {(metadata.form_numbers?.length > 0 || metadata.visa_types?.length > 0 || 
                                        metadata.requirements?.length > 0 || metadata.fees?.length > 0) && (
                                        <div className="mb-2">
                                          <small className="text-muted d-block mb-1">Enhanced Information:</small>
                                          <div className="d-flex gap-1 flex-wrap">
                                            {metadata.form_numbers?.slice(0, 3).map((form, idx) => (
                                              <Badge key={idx} bg="outline-primary" className="small">📄 {form}</Badge>
                                            ))}
                                            {metadata.visa_types?.slice(0, 3).map((visa, idx) => (
                                              <Badge key={idx} bg="outline-success" className="small">🛂 {visa}</Badge>
                                            ))}
                                            {metadata.fees?.slice(0, 2).map((fee, idx) => (
                                              <Badge key={idx} bg="outline-warning" className="small">💰 {fee}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Show full chunk if different from preview */}
                                      {result.full_content && result.full_content !== result.content_preview && (
                                        <details className="mb-2">
                                          <summary className="text-muted small" style={{ cursor: 'pointer' }}>
                                            View full chunk content ({result.full_content.length} characters)
                                          </summary>
                                          <div className="p-2 bg-light rounded small mt-1" style={{ maxHeight: '200px', overflow: 'auto' }}>
                                            {result.full_content}
                                          </div>
                                        </details>
                                      )}
                                      
                                      {/* Source URL Display */}
                                      {sourceUrl && (
                                        <div className="mt-2 pt-2 border-top">
                                          <small className="text-muted">
                                            <strong>Source:</strong> 
                                            <a 
                                              href={sourceUrl} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="ms-2 text-decoration-none"
                                            >
                                              {sourceUrl.length > 60 ? sourceUrl.substring(0, 60) + '...' : sourceUrl}
                                            </a>
                                          </small>
                                        </div>
                                      )}
                                    </Card.Body>
                                  </Card>
                                );
                              })}
                              
                              {/* Chunk Grouping Display */}
                              {qdrantData.chunks_by_url && Object.keys(qdrantData.chunks_by_url).length > 1 && (
                                <Card className="mt-3 border-info">
                                  <Card.Header>
                                    <strong>📊 Document Breakdown</strong>
                                  </Card.Header>
                                  <Card.Body>
                                    {Object.entries(qdrantData.chunks_by_url).map(([url, chunks], urlIndex) => (
                                      <div key={urlIndex} className="mb-2">
                                        <div className="d-flex justify-content-between align-items-center">
                                          <small className="text-muted">
                                            <strong>{chunks[0]?.original_title || 'Unknown Document'}</strong>
                                          </small>
                                          <Badge bg="info">{chunks.length} chunks found</Badge>
                                        </div>
                                        <div className="small text-muted">
                                          Chunks: {chunks.map(c => (c.chunk_info?.index ?? 0) + 1).sort((a, b) => a - b).join(', ')}
                                        </div>
                                      </div>
                                    ))}
                                  </Card.Body>
                                </Card>
                              )}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  )}
                </>
              ) : (
                <Alert variant="warning" className="text-center">
                  <h5>⚠️ Vector Database Not Connected</h5>
                  <p>The RAG system is ready but needs vectorized content. Start by scraping and vectorizing some documents!</p>
                  <div className="d-flex gap-2 justify-content-center">
                    <Button variant="primary" onClick={handleVectorize}>
                      <Database size={16} /> Start Vectorization
                    </Button>
                    <Button variant="outline-primary" onClick={loadQdrantData}>
                      <RefreshCw size={16} /> Retry Connection
                    </Button>
                  </div>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Conversations Tab (NEW) */}
        <Tab eventKey="conversations" title={<><Users size={16} /> Conversations</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>💬 User Conversations ({conversationStats.total_count})</h5>
              <div>
                <Button variant="outline-secondary" size="sm" onClick={loadConversations}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              
              {/* Conversation Filters */}
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Search</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search questions or responses..."
                      value={conversationFilters.search}
                      onChange={(e) => setConversationFilters(prev => ({...prev, search: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Country</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Filter by destination country"
                      value={conversationFilters.country_filter}
                      onChange={(e) => setConversationFilters(prev => ({...prev, country_filter: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Goal</Form.Label>
                    <Form.Select
                      value={conversationFilters.goal_filter}
                      onChange={(e) => setConversationFilters(prev => ({...prev, goal_filter: e.target.value}))}
                    >
                      <option value="">All Goals</option>
                      <option value="work">Work</option>
                      <option value="study">Study</option>
                      <option value="family">Family</option>
                      <option value="business">Business</option>
                      <option value="investment">Investment</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>&nbsp;</Form.Label>
                    <div className="d-grid">
                      <Button variant="primary" onClick={loadConversations}>
                        🔍 Filter
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              {/* Conversations List */}
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {conversations.length > 0 ? (
                  conversations.map((conv, index) => (
                    <Card key={conv.id} className="mb-3">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <div className="d-flex gap-2 mb-2">
                              {conv.destination_country && (
                                <Badge bg="primary">{conv.destination_country}</Badge>
                              )}
                              {conv.immigration_goal && (
                                <Badge bg="success">{conv.immigration_goal}</Badge>
                              )}
                              {conv.rating && (
                                <Badge bg="warning">{'⭐'.repeat(conv.rating)}</Badge>
                              )}
                            </div>
                            <h6 className="mb-2">❓ {conv.user_question}</h6>
                            <div className="p-2 bg-light rounded" style={{ maxHeight: '100px', overflow: 'hidden' }}>
                              <small className="text-muted">🤖 Response:</small>
                              <div className="small">
                                {conv.ai_response.length > 300 
                                  ? conv.ai_response.substring(0, 300) + '...' 
                                  : conv.ai_response}
                              </div>
                            </div>
                          </div>
                          <div className="ms-3 text-end">
                            <small className="text-muted d-block">{new Date(conv.created_at).toLocaleString()}</small>
                            <small className="text-muted d-block">ID: {conv.id}</small>
                            {conv.feedback_comments && (
                              <Badge bg="info" className="mt-1">Has Feedback</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Feedback Buttons */}
                        {!conv.rating && (
                          <div className="mt-2 pt-2 border-top">
                            <small className="text-muted d-block mb-2">Mark as:</small>
                            <div className="d-flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline-success"
                                onClick={() => submitFeedback(conv.id, 5, 'excellent')}
                              >
                                👍 Excellent
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline-primary"
                                onClick={() => submitFeedback(conv.id, 3, 'helpful')}
                              >
                                ✅ Helpful
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline-warning"
                                onClick={() => submitFeedback(conv.id, 2, 'needs_improvement')}
                              >
                                ⚠️ Needs Work
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline-danger"
                                onClick={() => submitFeedback(conv.id, 1, 'not_helpful')}
                              >
                                👎 Poor
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  ))
                ) : (
                  <Alert variant="info" className="text-center">
                    <h5>No conversations found</h5>
                    <p>User conversations will appear here when people use the AI assistant.</p>
                  </Alert>
                )}
              </div>
            </Card.Body>
          </Card>
        </Tab>

        {/* Users Tab (NEW) */}
        <Tab eventKey="users" title={<><Shield size={16} /> Users</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>👥 User Management</h5>
              <div>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => {
                    setModalType('tierSettings');
                    setShowModal(true);
                  }}
                  className="me-2"
                >
                  <Settings size={16} /> Tier Settings
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={loadUsers}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              
              {/* User Access Control Overview */}
              <Row className="mb-4">
                <Col md={12}>
                  <Card className="border-primary">
                    <Card.Header><strong>🎛️ Feature Access Control</strong></Card.Header>
                    <Card.Body>
                      <Table striped size="sm">
                        <thead>
                          <tr>
                            <th>Feature</th>
                            <th>Non-Logged-In</th>
                            <th>Free Users</th>
                            <th>Premium Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>🔍 Country Visa Pages</td>
                            <td><Badge bg="success">✅ Full Access</Badge></td>
                            <td><Badge bg="success">✅ Full Access</Badge></td>
                            <td><Badge bg="success">✅ Full Access</Badge></td>
                          </tr>
                          <tr>
                            <td>🤖 AI Chat Assistant</td>
                            <td><Badge bg="danger">❌ Login Required</Badge></td>
                            <td><Badge bg="warning">📝 {tierSettings.free.daily_questions}/day</Badge></td>
                            <td><Badge bg="success">✅ Unlimited</Badge></td>
                          </tr>
                          <tr>
                            <td>📄 Visa Reports</td>
                            <td><Badge bg="danger">❌ Not Available</Badge></td>
                            <td><Badge bg="warning">📊 {tierSettings.free.monthly_reports}/month</Badge></td>
                            <td><Badge bg="success">✅ Unlimited</Badge></td>
                          </tr>
                          <tr>
                            <td>📥 PDF Downloads</td>
                            <td><Badge bg="danger">❌ Locked</Badge></td>
                            <td><Badge bg="danger">❌ Locked</Badge></td>
                            <td><Badge bg="success">✅ Included</Badge></td>
                          </tr>
                          <tr>
                            <td>📝 Document Templates</td>
                            <td><Badge bg="danger">❌ Locked</Badge></td>
                            <td><Badge bg="danger">❌ Locked</Badge></td>
                            <td><Badge bg="success">✅ Unlimited</Badge></td>
                          </tr>
                          <tr>
                            <td>📊 Session History</td>
                            <td><Badge bg="danger">❌ Not Saved</Badge></td>
                            <td><Badge bg="warning">🔢 Last {tierSettings.free.history_limit}</Badge></td>
                            <td><Badge bg="success">✅ Full History</Badge></td>
                          </tr>
                          <tr>
                            <td>🔔 Policy Alerts</td>
                            <td><Badge bg="danger">❌ Not Available</Badge></td>
                            <td><Badge bg="danger">❌ Not Available</Badge></td>
                            <td><Badge bg="success">✅ Real-time</Badge></td>
                          </tr>
                          <tr>
                            <td>💬 Priority Support</td>
                            <td><Badge bg="danger">❌ Not Available</Badge></td>
                            <td><Badge bg="danger">❌ Not Available</Badge></td>
                            <td><Badge bg="success">✅ Chat & Email</Badge></td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* User Filters */}
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Search Users</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search by name or email..."
                      value={userFilters.search}
                      onChange={(e) => setUserFilters(prev => ({...prev, search: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Tier</Form.Label>
                    <Form.Select
                      value={userFilters.tier}
                      onChange={(e) => setUserFilters(prev => ({...prev, tier: e.target.value}))}
                    >
                      <option value="">All Tiers</option>
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={userFilters.status}
                      onChange={(e) => setUserFilters(prev => ({...prev, status: e.target.value}))}
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>&nbsp;</Form.Label>
                    <div className="d-grid">
                      <Button variant="primary" onClick={loadUsers}>
                        🔍 Filter
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              {/* Users List */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Tier</th>
                      <th>Usage</th>
                      <th>Last Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length > 0 ? users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div>
                            <strong>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email}</strong>
                            <br />
                            <small className="text-muted">{user.email}</small>
                            {user.origin_country && (
                              <>
                                <br />
                                <small className="text-info">From: {user.origin_country}</small>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge bg={user.tier === 'premium' ? 'warning' : user.tier === 'enterprise' ? 'danger' : 'secondary'}>
                            {user.tier?.toUpperCase() || 'FREE'}
                          </Badge>
                        </td>
                        <td>
                          <small>
                            Questions: {user.daily_questions_used || 0}/{user.tier === 'premium' ? '∞' : 5}<br />
                            Reports: {user.monthly_reports_used || 0}/{user.tier === 'premium' ? '∞' : 1}
                          </small>
                        </td>
                        <td>
                          <small>
                            {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Never'}
                            <br />
                            <span className="text-muted">
                              {user.created_at ? `Joined: ${new Date(user.created_at).toLocaleDateString()}` : ''}
                            </span>
                          </small>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => updateUserTier(user.id, user.tier === 'premium' ? 'free' : 'premium')}
                            >
                              {user.tier === 'premium' ? 'Downgrade' : 'Upgrade'}
                            </Button>
                            <Button size="sm" variant="outline-secondary" title="View Details">
                              <Eye size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No users found. Users will appear here once authentication is enabled.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Tab>

        {/* Leads Tab (NEW) */}
        <Tab eventKey="leads" title={<><Activity size={16} /> Leads</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>🎯 Lead Generation & Management</h5>
              <div>
                <Badge bg="info" className="me-2">
                  Visa Advisor Submissions
                </Badge>
                <Button variant="outline-secondary" size="sm" onClick={loadLeads}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              
              {/* Lead Filters */}
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Search</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search by name or email..."
                      value={leadFilters.search}
                      onChange={(e) => setLeadFilters(prev => ({...prev, search: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Destination</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Filter by destination"
                      value={leadFilters.destination_country}
                      onChange={(e) => setLeadFilters(prev => ({...prev, destination_country: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Origin</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Filter by origin"
                      value={leadFilters.origin_country}
                      onChange={(e) => setLeadFilters(prev => ({...prev, origin_country: e.target.value}))}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Goal</Form.Label>
                    <Form.Select
                      value={leadFilters.goal}
                      onChange={(e) => setLeadFilters(prev => ({...prev, goal: e.target.value}))}
                    >
                      <option value="">All Goals</option>
                      <option value="work">Work</option>
                      <option value="study">Study</option>
                      <option value="family">Family</option>
                      <option value="business">Business</option>
                      <option value="investment">Investment</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Timeline</Form.Label>
                    <Form.Select
                      value={leadFilters.timeline}
                      onChange={(e) => setLeadFilters(prev => ({...prev, timeline: e.target.value}))}
                    >
                      <option value="">All Timelines</option>
                      <option value="immediate">Immediate (0-3 months)</option>
                      <option value="short">Short-term (3-6 months)</option>
                      <option value="medium">Medium-term (6-12 months)</option>
                      <option value="long">Long-term (12+ months)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={1}>
                  <Form.Group>
                    <Form.Label>&nbsp;</Form.Label>
                    <div className="d-grid">
                      <Button variant="primary" onClick={loadLeads}>
                        🔍
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              {/* Leads Overview Stats */}
              <Row className="mb-4">
                <Col md={3}>
                  <Card className="border-primary h-100">
                    <Card.Body className="text-center">
                      <div className="h4 text-primary">{leads.length}</div>
                      <small>Total Leads</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border-success h-100">
                    <Card.Body className="text-center">
                      <div className="h4 text-success">
                        {leads.filter(lead => {
                          const today = new Date();
                          const leadDate = new Date(lead.created_at || lead.timestamp);
                          return leadDate.toDateString() === today.toDateString();
                        }).length}
                      </div>
                      <small>Today</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border-warning h-100">
                    <Card.Body className="text-center">
                      <div className="h4 text-warning">
                        {new Set(leads.map(lead => lead.destination_country)).size}
                      </div>
                      <small>Countries</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border-info h-100">
                    <Card.Body className="text-center">
                      <div className="h4 text-info">
                        {leads.filter(lead => lead.phone && lead.phone.trim() !== '').length}
                      </div>
                      <small>With Phone</small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Leads List */}
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {leads.length > 0 ? (
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Contact Info</th>
                        <th>Immigration Details</th>
                        <th>Timeline & Budget</th>
                        <th>Additional Info</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead, index) => (
                        <tr key={lead.id || index}>
                          <td>
                            <div>
                              <strong>{lead.name || 'Name not provided'}</strong>
                              <br />
                              <small className="text-muted">{lead.email}</small>
                              {lead.phone && (
                                <>
                                  <br />
                                  <small className="text-info">📞 {lead.phone}</small>
                                </>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              <div>
                                <Badge bg="primary" className="me-1">From:</Badge>
                                <span>{lead.origin_country || 'Not specified'}</span>
                              </div>
                              <div>
                                <Badge bg="success" className="me-1">To:</Badge>
                                <span>{lead.destination_country}</span>
                              </div>
                              <div>
                                <Badge bg="info" className="me-1">Goal:</Badge>
                                <span>{lead.goal || lead.intent || 'Not specified'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              {lead.timeline && (
                                <div className="mb-1">
                                  <Badge bg="warning" className="me-1">Timeline:</Badge>
                                  <span className="small">{lead.timeline}</span>
                                </div>
                              )}
                              {lead.budget && (
                                <div>
                                  <Badge bg="secondary" className="me-1">Budget:</Badge>
                                  <span className="small">{lead.budget}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '200px' }}>
                              {lead.additional_info ? (
                                <small className="text-muted">
                                  {lead.additional_info.length > 100 
                                    ? lead.additional_info.substring(0, 100) + '...' 
                                    : lead.additional_info}
                                </small>
                              ) : (
                                <small className="text-muted">No additional information</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <small>
                              {new Date(lead.created_at || lead.timestamp).toLocaleDateString()}
                              <br />
                              <span className="text-muted">
                                {new Date(lead.created_at || lead.timestamp).toLocaleTimeString()}
                              </span>
                            </small>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              <Button 
                                size="sm" 
                                variant="outline-primary"
                                onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                                title="Send Email"
                              >
                                📧 Email
                              </Button>
                              {lead.phone && (
                                <Button 
                                  size="sm" 
                                  variant="outline-success"
                                  onClick={() => window.open(`tel:${lead.phone}`, '_blank')}
                                  title="Call"
                                >
                                  📞 Call
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline-info"
                                title="View Details"
                              >
                                👁️ Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Alert variant="info" className="text-center">
                    <h5>No leads found</h5>
                    <p>Lead submissions from the Visa Advisor form will appear here.</p>
                    <div className="mt-3">
                      <small className="text-muted">
                        💡 Leads are generated when users complete the Visa Advisor form on the frontend.
                      </small>
                    </div>
                  </Alert>
                )}
              </div>

              {/* Lead Source Information */}
              <Row className="mt-4">
                <Col md={12}>
                  <Card className="border-secondary">
                    <Card.Header><strong>📋 Lead Generation Sources</strong></Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={6}>
                          <h6>🎯 Visa Advisor Form</h6>
                          <ul className="small">
                            <li>Users complete consultation form after AI chat</li>
                            <li>Collects contact info, immigration goals, timeline</li>
                            <li>Available to both logged-in and guest users</li>
                            <li>Integrated with PDF report generation</li>
                          </ul>
                        </Col>
                        <Col md={6}>
                          <h6>📊 Lead Data Collected</h6>
                          <ul className="small">
                            <li><strong>Contact:</strong> Name, email, phone (optional)</li>
                            <li><strong>Immigration:</strong> Origin country, destination, goal</li>
                            <li><strong>Planning:</strong> Timeline, budget range</li>
                            <li><strong>Context:</strong> Additional information, specific questions</li>
                          </ul>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Tab>

        {/* PDF Reports Tab (NEW) */}
        <Tab eventKey="pdf-reports" title={<><FileText size={16} /> PDF Reports</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>📄 PDF Report Generation & Management</h5>
              <div>
                <Badge bg="info" className="me-2">
                  Professional Immigration Reports
                </Badge>
                <Button variant="outline-secondary" size="sm" onClick={loadDashboard}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              
              {/* PDF Generation Overview */}
              <Row className="mb-4">
                <Col md={12}>
                  <Card className="border-primary">
                    <Card.Header><strong>🎯 PDF Report Types Available</strong></Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={3} className="mb-3">
                          <Card className="h-100 border-success">
                            <Card.Header className="text-center">
                              <div className="h4 mb-0">🗺️</div>
                              <strong>Immigration Roadmap</strong>
                            </Card.Header>
                            <Card.Body>
                              <ul className="small mb-3">
                                <li>Step-by-step guidance</li>
                                <li>Document requirements</li>
                                <li>Timeline estimates</li>
                                <li>Cost breakdown</li>
                                <li>Government resources</li>
                              </ul>
                              <Badge bg="success">8-12 pages</Badge>
                              <br />
                              <Badge bg="warning" className="mt-1">Premium Feature</Badge>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3} className="mb-3">
                          <Card className="h-100 border-info">
                            <Card.Header className="text-center">
                              <div className="h4 mb-0">📋</div>
                              <strong>Document Checklist</strong>
                            </Card.Header>
                            <Card.Body>
                              <ul className="small mb-3">
                                <li>Complete document list</li>
                                <li>Checkboxes for tracking</li>
                                <li>Specific requirements</li>
                                <li>Preparation tips</li>
                                <li>Official sources</li>
                              </ul>
                              <Badge bg="info">4-6 pages</Badge>
                              <br />
                              <Badge bg="warning" className="mt-1">Premium Feature</Badge>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3} className="mb-3">
                          <Card className="h-100 border-warning">
                            <Card.Header className="text-center">
                              <div className="h4 mb-0">💰</div>
                              <strong>Cost Analysis</strong>
                            </Card.Header>
                            <Card.Body>
                              <ul className="small mb-3">
                                <li>Government fees</li>
                                <li>Service costs</li>
                                <li>Payment schedule</li>
                                <li>Financial planning</li>
                                <li>Currency considerations</li>
                              </ul>
                              <Badge bg="warning">3-4 pages</Badge>
                              <br />
                              <Badge bg="warning" className="mt-1">Premium Feature</Badge>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3} className="mb-3">
                          <Card className="h-100 border-secondary">
                            <Card.Header className="text-center">
                              <div className="h4 mb-0">📄</div>
                              <strong>Quick Summary</strong>
                            </Card.Header>
                            <Card.Body>
                              <ul className="small mb-3">
                                <li>Pathway overview</li>
                                <li>Priority next steps</li>
                                <li>Essential timeline</li>
                                <li>Cost summary</li>
                                <li>Key reminders</li>
                              </ul>
                              <Badge bg="secondary">1 page</Badge>
                              <br />
                              <Badge bg="success" className="mt-1">Free Feature</Badge>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Test PDF Generation */}
              <Row className="mb-4">
                <Col md={12}>
                  <Card className="border-success">
                    <Card.Header><strong>🧪 Test PDF Generation (Admin Only)</strong></Card.Header>
                    <Card.Body>
                      <p className="text-muted mb-3">
                        Generate test PDFs with sample data to verify the PDF generation system is working correctly.
                      </p>
                      
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Test User Data</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={JSON.stringify({
                                first_name: "John",
                                last_name: "Doe", 
                                email: "admin@test.com",
                                origin_country: "India"
                              }, null, 2)}
                              readOnly
                            />
                            <Form.Text className="text-muted">
                              Sample user data for PDF generation
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Test Consultation Data</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={JSON.stringify({
                                destination_country: "Canada",
                                origin_country: "India",
                                goal: "work",
                                consultation_date: new Date().toISOString()
                              }, null, 2)}
                              readOnly
                            />
                            <Form.Text className="text-muted">
                              Sample consultation data for PDF generation
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                      
                      <div className="d-flex gap-2 flex-wrap">
                        <Button 
                          variant="success" 
                          onClick={() => {
                            // Test Immigration Roadmap PDF
                            const testData = {
                              consultation_data: {
                                destination_country: "Canada",
                                origin_country: "India", 
                                goal: "work"
                              }
                            };
                            
                            fetch(`${API_BASE}/pdf/immigration-roadmap`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify(testData)
                            })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `test_immigration_roadmap_${Date.now()}.pdf`;
                              a.click();
                              showToast('✅ Test Immigration Roadmap PDF generated!', 'success');
                            })
                            .catch(error => {
                              console.error('PDF generation failed:', error);
                              showToast('❌ PDF generation failed: ' + error.message, 'error');
                            });
                          }}
                          disabled={loading}
                        >
                          <Download size={16} /> Test Immigration Roadmap
                        </Button>
                        
                        <Button 
                          variant="info" 
                          onClick={() => {
                            // Test Document Checklist PDF
                            const testData = {
                              consultation_data: {
                                destination_country: "Canada",
                                origin_country: "India",
                                goal: "work"
                              }
                            };
                            
                            fetch(`${API_BASE}/pdf/document-checklist`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify(testData)
                            })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `test_document_checklist_${Date.now()}.pdf`;
                              a.click();
                              showToast('✅ Test Document Checklist PDF generated!', 'success');
                            })
                            .catch(error => {
                              console.error('PDF generation failed:', error);
                              showToast('❌ PDF generation failed: ' + error.message, 'error');
                            });
                          }}
                          disabled={loading}
                        >
                          <Download size={16} /> Test Document Checklist
                        </Button>
                        
                        <Button 
                          variant="warning" 
                          onClick={() => {
                            // Test Cost Breakdown PDF
                            const testData = {
                              consultation_data: {
                                destination_country: "Canada",
                                origin_country: "India",
                                goal: "work"
                              }
                            };
                            
                            fetch(`${API_BASE}/pdf/cost-breakdown`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify(testData)
                            })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `test_cost_breakdown_${Date.now()}.pdf`;
                              a.click();
                              showToast('✅ Test Cost Breakdown PDF generated!', 'success');
                            })
                            .catch(error => {
                              console.error('PDF generation failed:', error);
                              showToast('❌ PDF generation failed: ' + error.message, 'error');
                            });
                          }}
                          disabled={loading}
                        >
                          <Download size={16} /> Test Cost Breakdown
                        </Button>
                        
                        <Button 
                          variant="secondary" 
                          onClick={() => {
                            // Test Quick Summary PDF
                            const testData = {
                              consultation_data: {
                                destination_country: "Canada",
                                origin_country: "India",
                                goal: "work"
                              }
                            };
                            
                            fetch(`${API_BASE}/pdf/quick-summary`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify(testData)
                            })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `test_quick_summary_${Date.now()}.pdf`;
                              a.click();
                              showToast('✅ Test Quick Summary PDF generated!', 'success');
                            })
                            .catch(error => {
                              console.error('PDF generation failed:', error);
                              showToast('❌ PDF generation failed: ' + error.message, 'error');
                            });
                          }}
                          disabled={loading}
                        >
                          <Download size={16} /> Test Quick Summary
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* PDF System Status */}
              <Row className="mb-4">
                <Col md={6}>
                  <Card className="border-info h-100">
                    <Card.Header><strong>📊 PDF System Status</strong></Card.Header>
                    <Card.Body>
                      <Table striped size="sm">
                        <tbody>
                          <tr>
                            <td>PDF Generator Library</td>
                            <td><Badge bg="success">✅ ReportLab</Badge></td>
                          </tr>
                          <tr>
                            <td>Font Support</td>
                            <td><Badge bg="success">✅ Helvetica</Badge></td>
                          </tr>
                          <tr>
                            <td>Image Support</td>
                            <td><Badge bg="success">✅ Enabled</Badge></td>
                          </tr>
                          <tr>
                            <td>Chart Generation</td>
                            <td><Badge bg="success">✅ Available</Badge></td>
                          </tr>
                          <tr>
                            <td>Custom Styling</td>
                            <td><Badge bg="success">✅ Professional</Badge></td>
                          </tr>
                          <tr>
                            <td>Backend Integration</td>
                            <td><Badge bg="success">✅ Connected</Badge></td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-warning h-100">
                    <Card.Header><strong>🔧 PDF Features & Capabilities</strong></Card.Header>
                    <Card.Body>
                      <ul className="small">
                        <li><strong>Professional Styling:</strong> Custom branded headers and footers</li>
                        <li><strong>Dynamic Content:</strong> Personalized based on user consultation</li>
                        <li><strong>Multi-Page Support:</strong> Complex reports with tables and charts</li>
                        <li><strong>Interactive Elements:</strong> Checkboxes for document tracking</li>
                        <li><strong>Government Integration:</strong> Official source links and references</li>
                        <li><strong>Cost Calculations:</strong> Real-time fee estimates and breakdowns</li>
                        <li><strong>Timeline Planning:</strong> Processing time estimates and milestones</li>
                        <li><strong>Compliance Ready:</strong> Official document formatting standards</li>
                      </ul>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Frontend Integration Status */}
              <Row>
                <Col md={12}>
                  <Card className="border-primary">
                    <Card.Header><strong>🌐 Frontend Integration Status</strong></Card.Header>
                    <Card.Body>
                      <Table striped>
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Status</th>
                            <th>Features</th>
                            <th>User Access</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>PDFReportGenerator.jsx</strong></td>
                            <td><Badge bg="success">✅ Integrated</Badge></td>
                            <td>
                              <div className="small">
                                • All 4 report types<br/>
                                • Feature gating by user tier<br/>
                                • Professional UI/UX
                              </div>
                            </td>
                            <td><Badge bg="info">Available in Main App</Badge></td>
                          </tr>
                          <tr>
                            <td><strong>Backend Endpoints</strong></td>
                            <td><Badge bg="success">✅ Active</Badge></td>
                            <td>
                              <div className="small">
                                • /pdf/immigration-roadmap<br/>
                                • /pdf/document-checklist<br/>
                                • /pdf/cost-breakdown<br/>
                                • /pdf/quick-summary
                              </div>
                            </td>
                            <td><Badge bg="warning">Token Required</Badge></td>
                          </tr>
                          <tr>
                            <td><strong>User Authentication</strong></td>
                            <td><Badge bg="success">✅ Working</Badge></td>
                            <td>
                              <div className="small">
                                • JWT token validation<br/>
                                • Tier-based access control<br/>
                                • Usage tracking
                              </div>
                            </td>
                            <td><Badge bg="success">Free & Premium</Badge></td>
                          </tr>
                          <tr>
                            <td><strong>Chat Integration</strong></td>
                            <td><Badge bg="success">✅ Enabled</Badge></td>
                            <td>
                              <div className="small">
                                • PDF button in chat options<br/>
                                • Context-aware generation<br/>
                                • Conversation data passing
                              </div>
                            </td>
                            <td><Badge bg="info">Available After Chat</Badge></td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modals */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalType === 'document' && 'Upload Document'}
            {modalType === 'schedule' && 'Create Schedule'}
            {modalType === 'editRow' && 'Edit CSV Row'}
            {modalType === 'tierSettings' && 'Tier Settings'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalType === 'document' && (
            <Form onSubmit={uploadDocument}>
              <Form.Group className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  value={documentForm.title}
                  onChange={(e) => setDocumentForm({...documentForm, title: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Country</Form.Label>
                <Form.Control
                  type="text"
                  value={documentForm.country}
                  onChange={(e) => setDocumentForm({...documentForm, country: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={documentForm.category}
                  onChange={(e) => setDocumentForm({...documentForm, category: e.target.value})}
                  required
                >
                  <option value="">Select category...</option>
                  <option value="work_visas">Work Visas</option>
                  <option value="student_visas">Student Visas</option>
                  <option value="business_visas">Business Visas</option>
                  <option value="family_visas">Family Visas</option>
                  <option value="investment_visas">Investment Visas</option>
                  <option value="permanent_residence">Permanent Residence</option>
                  <option value="citizenship">Citizenship</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Source URL (optional)</Form.Label>
                <Form.Control
                  type="url"
                  value={documentForm.source_url}
                  onChange={(e) => setDocumentForm({...documentForm, source_url: e.target.value})}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Content</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={8}
                  value={documentForm.content}
                  onChange={(e) => setDocumentForm({...documentForm, content: e.target.value})}
                  required
                />
              </Form.Group>
              <div className="d-flex justify-content-end">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="me-2">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Upload Document'}
                </Button>
              </div>
            </Form>
          )}

          {modalType === 'schedule' && (
            <Form onSubmit={createSchedule}>
              <Form.Group className="mb-3">
                <Form.Label>Schedule Name</Form.Label>
                <Form.Control
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Task Type</Form.Label>
                <Form.Select
                  value={scheduleForm.task_type}
                  onChange={(e) => setScheduleForm({...scheduleForm, task_type: e.target.value})}
                >
                  <option value="scrape_all">Scrape All URLs</option>
                  <option value="scrape_selected">Scrape Selected URLs</option>
                  <option value="vectorize">Vectorize Content</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Schedule Type</Form.Label>
                <Form.Select
                  value={scheduleForm.schedule_type}
                  onChange={(e) => setScheduleForm({...scheduleForm, schedule_type: e.target.value})}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Enabled"
                  checked={scheduleForm.enabled}
                  onChange={(e) => setScheduleForm({...scheduleForm, enabled: e.target.checked})}
                />
              </Form.Group>
              <div className="d-flex justify-content-end">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="me-2">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Create Schedule'}
                </Button>
              </div>
            </Form>
          )}

          {modalType === 'editRow' && (
            <Form onSubmit={saveEditedRow}>
              <Form.Group className="mb-3">
                <Form.Label>Country</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.country}
                  onChange={(e) => setEditForm({...editForm, country: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Country Name</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.country_name}
                  onChange={(e) => setEditForm({...editForm, country_name: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Flag</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.flag}
                  onChange={(e) => setEditForm({...editForm, flag: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Category Name</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.category_name}
                  onChange={(e) => setEditForm({...editForm, category_name: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Type</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.type}
                  onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>URL</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.url}
                  onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Enabled"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({...editForm, enabled: e.target.checked})}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Auto Refresh"
                  checked={editForm.auto_refresh}
                  onChange={(e) => setEditForm({...editForm, auto_refresh: e.target.checked})}
                />
              </Form.Group>
              <div className="d-flex justify-content-end">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="me-2">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Save Changes'}
                </Button>
              </div>
            </Form>
          )}

          {modalType === 'tierSettings' && (
            <Form onSubmit={(e) => { e.preventDefault(); updateTierSettings(); setShowModal(false); }}>
              <h5 className="mb-3">🔧 Configure User Tier Limits</h5>
              
              <Row>
                <Col md={6}>
                  <Card className="border-secondary h-100 mb-3">
                    <Card.Header><strong>🆓 Free Tier Settings</strong></Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Daily AI Questions Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.free.daily_questions}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            free: { ...prev.free, daily_questions: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Number of AI chat questions per day (0 = disabled)
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Monthly Reports Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.free.monthly_reports}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            free: { ...prev.free, monthly_reports: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Number of visa reports per month
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Avatar Minutes Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.free.avatar_minutes}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            free: { ...prev.free, avatar_minutes: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Avatar consultation minutes per month
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="PDF Download Access"
                          checked={tierSettings.free.download_access}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            free: { ...prev.free, download_access: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="Priority Support Access"
                          checked={tierSettings.free.priority_support}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            free: { ...prev.free, priority_support: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="border-success h-100 mb-3">
                    <Card.Header><strong>🌟 Starter Tier Settings ($19.99/month)</strong></Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Daily AI Questions Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.starter.daily_questions}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            starter: { ...prev.starter, daily_questions: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Monthly Reports Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.starter.monthly_reports}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            starter: { ...prev.starter, monthly_reports: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Avatar Minutes Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.starter.avatar_minutes}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            starter: { ...prev.starter, avatar_minutes: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Avatar consultation minutes per month
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="PDF Download Access"
                          checked={tierSettings.starter.download_access}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            starter: { ...prev.starter, download_access: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="Priority Support Access"
                          checked={tierSettings.starter.priority_support}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            starter: { ...prev.starter, priority_support: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Card className="border-primary h-100 mb-3">
                    <Card.Header><strong>💼 Pro Tier Settings ($39.99/month)</strong></Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Daily AI Questions Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.pro.daily_questions}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            pro: { ...prev.pro, daily_questions: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Monthly Reports Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.pro.monthly_reports}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            pro: { ...prev.pro, monthly_reports: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Avatar Minutes Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.pro.avatar_minutes}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            pro: { ...prev.pro, avatar_minutes: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Avatar consultation minutes per month
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="PDF Download Access"
                          checked={tierSettings.pro.download_access}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            pro: { ...prev.pro, download_access: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="Priority Support Access"
                          checked={tierSettings.pro.priority_support}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            pro: { ...prev.pro, priority_support: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="border-warning h-100 mb-3">
                    <Card.Header><strong>👑 Elite Tier Settings ($79.99/month)</strong></Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Daily AI Questions Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.elite.daily_questions}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            elite: { ...prev.elite, daily_questions: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Monthly Reports Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="-1"
                          value={tierSettings.elite.monthly_reports}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            elite: { ...prev.elite, monthly_reports: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Use -1 for unlimited access
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Label>Avatar Minutes Limit</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          value={tierSettings.elite.avatar_minutes}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            elite: { ...prev.elite, avatar_minutes: parseInt(e.target.value) }
                          }))}
                        />
                        <Form.Text className="text-muted">
                          Avatar consultation minutes per month
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="PDF Download Access"
                          checked={tierSettings.elite.download_access}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            elite: { ...prev.elite, download_access: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                      
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="Priority Support Access"
                          checked={tierSettings.elite.priority_support}
                          onChange={(e) => setTierSettings(prev => ({
                            ...prev,
                            elite: { ...prev.elite, priority_support: e.target.checked }
                          }))}
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <div className="d-flex justify-content-end mt-3">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="me-2">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Save Settings'}
                </Button>
              </div>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      {loading && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
             style={{ backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1060 }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <div className="mt-2">Processing...</div>
          </div>
        </div>
      )}
    </Container>
  );
};

export default SecureAdminPanel; 