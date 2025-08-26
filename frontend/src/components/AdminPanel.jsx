import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Form states
  const [newCountry, setNewCountry] = useState({ country_code: '', country_name: '', flag_emoji: '' });
  const [newCategory, setNewCategory] = useState({ country_id: '', category_code: '', category_name: '', description: '' });
  const [newUrl, setNewUrl] = useState({ 
    country_id: '', 
    category_id: '', 
    url_type: 'guidelines', 
    url: '', 
    title: '', 
    description: '' 
  });
  
  const [csvData, setCsvData] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const API_BASE = 'http://127.0.0.1:8001';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCountries(),
        loadCategories(),
        loadUrls()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/countries`);
      const data = await response.json();
      if (data.status === 'success') {
        setCountries(data.countries);
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/visa-categories`);
      const data = await response.json();
      if (data.status === 'success') {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadUrls = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/immigration-urls`);
      const data = await response.json();
      if (data.status === 'success') {
        setUrls(data.urls);
      }
    } catch (error) {
      console.error('Error loading URLs:', error);
    }
  };

  const createCountry = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/admin/countries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCountry)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setNewCountry({ country_code: '', country_name: '', flag_emoji: '' });
        loadCountries();
        alert('Country created successfully!');
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      alert('Error creating country: ' + error.message);
    }
  };

  const createCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/admin/visa-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategory,
          country_id: parseInt(newCategory.country_id)
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setNewCategory({ country_id: '', category_code: '', category_name: '', description: '' });
        loadCategories();
        alert('Visa category created successfully!');
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      alert('Error creating category: ' + error.message);
    }
  };

  const createUrl = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/admin/immigration-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUrl,
          country_id: parseInt(newUrl.country_id),
          category_id: parseInt(newUrl.category_id)
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setNewUrl({ 
          country_id: '', 
          category_id: '', 
          url_type: 'guidelines', 
          url: '', 
          title: '', 
          description: '' 
        });
        loadUrls();
        alert('URL added successfully!');
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      alert('Error creating URL: ' + error.message);
    }
  };

  const initializeFromCurrent = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/initialize-from-current`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert(`Successfully initialized with ${data.imported_count} URLs from ${data.countries_count} countries!`);
        loadData();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      alert('Error initializing: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/export-csv`);
      const data = await response.json();
      if (data.status === 'success') {
        // Convert to CSV string
        const headers = Object.keys(data.csv_data[0]);
        const csvContent = [
          headers.join(','),
          ...data.csv_data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'immigration_sources.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert('Error exporting CSV: ' + error.message);
    }
  };

  const processCsvImport = async () => {
    if (!csvData.trim()) {
      alert('Please paste CSV data first');
      return;
    }

    try {
      setImportStatus('Processing...');
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const importData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index] || '';
        });
        importData.push(item);
      }

      const response = await fetch(`${API_BASE}/admin/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });

      const data = await response.json();
      if (data.status === 'success') {
        setImportStatus(`✅ Successfully imported ${data.imported_count} items`);
        setCsvData('');
        loadData();
      } else {
        setImportStatus(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setImportStatus(`❌ Error processing CSV: ${error.message}`);
    }
  };

  const filteredCategories = selectedCountry 
    ? categories.filter(cat => cat.country_id === selectedCountry.id)
    : categories;

  const filteredUrls = selectedCountry && selectedCategory
    ? urls.filter(url => url.country_id === selectedCountry.id && url.category_id === selectedCategory.id)
    : selectedCountry
    ? urls.filter(url => url.country_id === selectedCountry.id)
    : urls;

  const renderOverview = () => (
    <div className="overview-section">
      <div className="admin-stats">
        <div className="stat-card">
          <h3>{countries.length}</h3>
          <p>Countries</p>
        </div>
        <div className="stat-card">
          <h3>{categories.length}</h3>
          <p>Visa Categories</p>
        </div>
        <div className="stat-card">
          <h3>{urls.length}</h3>
          <p>Immigration URLs</p>
        </div>
      </div>
      
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <button onClick={initializeFromCurrent} className="action-btn primary">
          🚀 Initialize from Current Sources
        </button>
        <button onClick={exportCsv} className="action-btn secondary">
          📥 Export All Data (CSV)
        </button>
      </div>

      <div className="recent-urls">
        <h3>Recent URLs</h3>
        <div className="url-list">
          {urls.slice(0, 10).map(url => (
            <div key={url.id} className="url-item">
              <div className="url-info">
                <strong>{url.country_name} - {url.category_name}</strong>
                <div className="url-link">{url.url}</div>
                <span className={`url-type ${url.url_type}`}>{url.url_type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCountries = () => (
    <div className="countries-section">
      <div className="form-section">
        <h3>Add New Country</h3>
        <form onSubmit={createCountry}>
          <input
            type="text"
            placeholder="Country Code (e.g., usa, canada)"
            value={newCountry.country_code}
            onChange={(e) => setNewCountry({...newCountry, country_code: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Country Name (e.g., United States)"
            value={newCountry.country_name}
            onChange={(e) => setNewCountry({...newCountry, country_name: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Flag Emoji (e.g., 🇺🇸)"
            value={newCountry.flag_emoji}
            onChange={(e) => setNewCountry({...newCountry, flag_emoji: e.target.value})}
          />
          <button type="submit">Add Country</button>
        </form>
      </div>

      <div className="list-section">
        <h3>Countries ({countries.length})</h3>
        <div className="countries-grid">
          {countries.map(country => (
            <div 
              key={country.id} 
              className={`country-card ${selectedCountry?.id === country.id ? 'selected' : ''}`}
              onClick={() => setSelectedCountry(country)}
            >
              <div className="country-flag">{country.flag_emoji}</div>
              <div className="country-info">
                <strong>{country.country_name}</strong>
                <div className="country-code">{country.country_code}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="categories-section">
      <div className="form-section">
        <h3>Add New Visa Category</h3>
        <form onSubmit={createCategory}>
          <select
            value={newCategory.country_id}
            onChange={(e) => setNewCategory({...newCategory, country_id: e.target.value})}
            required
          >
            <option value="">Select Country</option>
            {countries.map(country => (
              <option key={country.id} value={country.id}>
                {country.flag_emoji} {country.country_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Category Code (e.g., work_visas)"
            value={newCategory.category_code}
            onChange={(e) => setNewCategory({...newCategory, category_code: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Category Name (e.g., Work Visas)"
            value={newCategory.category_name}
            onChange={(e) => setNewCategory({...newCategory, category_name: e.target.value})}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newCategory.description}
            onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
          />
          <button type="submit">Add Category</button>
        </form>
      </div>

      <div className="list-section">
        <h3>Visa Categories ({filteredCategories.length})</h3>
        {selectedCountry && (
          <p className="filter-info">Showing categories for {selectedCountry.country_name}</p>
        )}
        <div className="categories-list">
          {filteredCategories.map(category => (
            <div 
              key={category.id} 
              className={`category-card ${selectedCategory?.id === category.id ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              <strong>{category.category_name}</strong>
              <div className="category-country">{category.country_name}</div>
              <div className="category-code">{category.category_code}</div>
              {category.description && <p className="category-desc">{category.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUrls = () => (
    <div className="urls-section">
      <div className="form-section">
        <h3>Add New Immigration URL</h3>
        <form onSubmit={createUrl}>
          <select
            value={newUrl.country_id}
            onChange={(e) => setNewUrl({...newUrl, country_id: e.target.value})}
            required
          >
            <option value="">Select Country</option>
            {countries.map(country => (
              <option key={country.id} value={country.id}>
                {country.flag_emoji} {country.country_name}
              </option>
            ))}
          </select>
          <select
            value={newUrl.category_id}
            onChange={(e) => setNewUrl({...newUrl, category_id: e.target.value})}
            required
          >
            <option value="">Select Visa Category</option>
            {categories
              .filter(cat => !newUrl.country_id || cat.country_id === parseInt(newUrl.country_id))
              .map(category => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
          </select>
          <select
            value={newUrl.url_type}
            onChange={(e) => setNewUrl({...newUrl, url_type: e.target.value})}
            required
          >
            <option value="guidelines">Guidelines</option>
            <option value="form">Form</option>
            <option value="portal">Portal</option>
            <option value="info">Information</option>
          </select>
          <input
            type="url"
            placeholder="URL"
            value={newUrl.url}
            onChange={(e) => setNewUrl({...newUrl, url: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Title (optional)"
            value={newUrl.title}
            onChange={(e) => setNewUrl({...newUrl, title: e.target.value})}
          />
          <textarea
            placeholder="Description (optional)"
            value={newUrl.description}
            onChange={(e) => setNewUrl({...newUrl, description: e.target.value})}
          />
          <button type="submit">Add URL</button>
        </form>
      </div>

      <div className="list-section">
        <h3>Immigration URLs ({filteredUrls.length})</h3>
        {selectedCountry && (
          <p className="filter-info">
            Showing URLs for {selectedCountry.country_name}
            {selectedCategory && ` - ${selectedCategory.category_name}`}
          </p>
        )}
        <div className="urls-list">
          {filteredUrls.map(url => (
            <div key={url.id} className="url-card">
              <div className="url-header">
                <strong>{url.title || url.url}</strong>
                <span className={`url-type ${url.url_type}`}>{url.url_type}</span>
              </div>
              <div className="url-meta">
                {url.country_name} - {url.category_name}
              </div>
              <div className="url-link">
                <a href={url.url} target="_blank" rel="noopener noreferrer">
                  {url.url}
                </a>
              </div>
              {url.description && <p className="url-desc">{url.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBulkImport = () => (
    <div className="import-section">
      <h3>Bulk Import from CSV</h3>
      <div className="import-instructions">
        <h4>CSV Format Required:</h4>
        <code>
          country_code,country_name,flag_emoji,category_code,category_name,url_type,url,title,description
        </code>
        <p>
          <strong>URL Types:</strong> guidelines, form, portal, info<br/>
          <strong>Example:</strong> usa,United States,🇺🇸,work_visas,Work Visas,form,https://uscis.gov/i-129,Form I-129,Work petition form
        </p>
      </div>
      
      <textarea
        placeholder="Paste your CSV data here..."
        value={csvData}
        onChange={(e) => setCsvData(e.target.value)}
        rows={10}
        className="csv-input"
      />
      
      <div className="import-actions">
        <button onClick={processCsvImport} className="import-btn">
          🚀 Import CSV Data
        </button>
        <button onClick={exportCsv} className="export-btn">
          📥 Download Template
        </button>
      </div>
      
      {importStatus && (
        <div className="import-status">
          {importStatus}
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🌍 Immigration Sources Admin Panel</h1>
        <p>Manage countries, visa categories, and official government URLs</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={activeTab === 'countries' ? 'active' : ''}
          onClick={() => setActiveTab('countries')}
        >
          🌍 Countries
        </button>
        <button 
          className={activeTab === 'categories' ? 'active' : ''}
          onClick={() => setActiveTab('categories')}
        >
          📋 Visa Categories
        </button>
        <button 
          className={activeTab === 'urls' ? 'active' : ''}
          onClick={() => setActiveTab('urls')}
        >
          🔗 URLs
        </button>
        <button 
          className={activeTab === 'import' ? 'active' : ''}
          onClick={() => setActiveTab('import')}
        >
          📤 Bulk Import
        </button>
      </div>

      <div className="admin-content">
        {loading && <div className="loading">Loading...</div>}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'countries' && renderCountries()}
        {activeTab === 'categories' && renderCategories()}
        {activeTab === 'urls' && renderUrls()}
        {activeTab === 'import' && renderBulkImport()}
      </div>

      {(selectedCountry || selectedCategory) && (
        <div className="admin-sidebar">
          <h3>Filters</h3>
          {selectedCountry && (
            <div className="filter-item">
              <strong>Country:</strong> {selectedCountry.flag_emoji} {selectedCountry.country_name}
              <button onClick={() => setSelectedCountry(null)}>✖</button>
            </div>
          )}
          {selectedCategory && (
            <div className="filter-item">
              <strong>Category:</strong> {selectedCategory.category_name}
              <button onClick={() => setSelectedCategory(null)}>✖</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel; 