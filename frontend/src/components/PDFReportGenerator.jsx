import React, { useState } from 'react';
import './PDFReportGenerator.css';

const PDFReportGenerator = ({ user, userProfile = {}, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedReportType, setSelectedReportType] = useState('quick-summary');

  const reportTypes = [
    {
      id: 'quick-summary',
      title: 'Quick Summary',
      description: 'Free 1-page overview of your immigration plan',
      icon: '📄',
      features: [
        'Key pathway overview',
        'Priority next steps',
        'Essential timeline',
        'Basic cost estimate',
        'Important reminders'
      ],
      tier: 'free',
      pages: '1 page',
      price: 'Free'
    },
    {
      id: 'comprehensive-report',
      title: 'Comprehensive Report',
      description: 'Complete immigration guide with all details',
      icon: '📖',
      features: [
        'Detailed immigration roadmap',
        'Complete document checklist',
        'Comprehensive cost breakdown',
        'Step-by-step application process',
        'Government resources & forms',
        'Common pitfalls & solutions',
        'Alternative pathways',
        'Professional support contacts'
      ],
      tier: 'premium',
      pages: '8-15 pages',
      price: 'Premium Only'
    }
  ];

  const generatePDF = async (reportType) => {
    setLoading(true);
    setError('');

    try {
      // Check if user is logged in
      if (!user) {
        setError('Please log in to generate reports');
        setLoading(false);
        return;
      }

      // Check if user has access to premium reports
      const report = reportTypes.find(r => r.id === reportType);
      if (report.tier === 'premium' && !['starter', 'pro', 'elite'].includes(user.tier)) {
        setError('This comprehensive report requires a paid tier account. Please upgrade to access unlimited detailed reports.');
        setLoading(false);
        return;
      }

      // Prepare consultation data from user profile
      const consultationData = {
        destination_country: userProfile.destination_country || 'Not specified',
        origin_country: userProfile.origin_country || user?.origin_country || 'Not specified',
        goal: userProfile.goal || 'general immigration',
        user_email: user?.email,
        user_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        generation_date: new Date().toISOString()
      };

      console.log('Generating PDF with data:', consultationData);

      // Get auth token for authenticated requests
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`http://localhost:8001/pdf/${reportType}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          consultation_data: consultationData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate PDF: ${errorText}`);
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Get filename from response headers or create default
      const disposition = response.headers.get('content-disposition');
      let filename = `immigration_${reportType}_${Date.now()}.pdf`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLoading(false);
      
      // Show success message
      alert(`📄 ${report.title} generated successfully!`);

    } catch (error) {
      console.error('PDF generation error:', error);
      setError(error.message || 'Failed to generate PDF report');
      setLoading(false);
    }
  };

  const isReportAvailable = (report) => {
    if (!user) return false;
    if (report.tier === 'free') return true;
    return ['starter', 'pro', 'elite'].includes(user?.tier);
  };

  const handleUpgradeClick = () => {
    alert('💎 Premium Upgrade\n\nUpgrade to Premium for unlimited comprehensive PDF reports!\n\nPremium benefits:\n✅ Unlimited AI questions\n✅ Unlimited comprehensive PDF reports\n✅ Priority support\n✅ Advanced templates\n\nContact support to upgrade your account.');
  };

  return (
    <div className="pdf-report-overlay">
      <div className="pdf-report-modal">
        <div className="pdf-report-header">
          <h2>📄 Generate Immigration Report</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="pdf-report-content">
          {error && (
            <div className="error-message">
              ⚠️ {error}
              {error.includes('Premium') && (
                <div className="upgrade-prompt">
                  <button className="upgrade-btn-small" onClick={handleUpgradeClick}>
                    Learn About Premium
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Info Summary */}
          <div className="user-info-summary">
            <h3>📋 Report Details</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Your Name:</span>
                <span className="summary-value">{`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Not specified'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">From:</span>
                <span className="summary-value">{userProfile.origin_country || user?.origin_country || 'Not specified'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">To:</span>
                <span className="summary-value">{userProfile.destination_country || 'Not specified'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Goal:</span>
                <span className="summary-value">{userProfile.goal || 'General immigration'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Your Plan:</span>
                <span className={`summary-value tier-badge ${user?.tier || 'free'}`}>
                  {user?.tier === 'premium' ? '💎 Premium' : '🆓 Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Report Types */}
          <div className="report-types-grid">
            {reportTypes.map((report) => (
              <div 
                key={report.id} 
                className={`report-type-card ${!isReportAvailable(report) ? 'locked' : ''} ${selectedReportType === report.id ? 'selected' : ''}`}
                onClick={() => isReportAvailable(report) && setSelectedReportType(report.id)}
              >
                <div className="report-header">
                  <div className="report-icon">{report.icon}</div>
                  <div className="report-info">
                    <h3>{report.title}</h3>
                    <p className="report-description">{report.description}</p>
                    <div className="report-meta">
                      <span className="report-pages">{report.pages}</span>
                      <span className={`price-tag ${report.tier}`}>{report.price}</span>
                    </div>
                  </div>
                  {!isReportAvailable(report) && (
                    <div className="lock-icon">🔒</div>
                  )}
                </div>

                <div className="report-features">
                  <h4>What's included:</h4>
                  <ul>
                    {report.features.map((feature, index) => (
                      <li key={index}>✓ {feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="report-actions">
                  {isReportAvailable(report) ? (
                    <button 
                      className={`generate-btn ${report.tier}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        generatePDF(report.id);
                      }}
                      disabled={loading}
                    >
                      {loading ? '⏳ Generating...' : `📄 Generate ${report.title}`}
                    </button>
                  ) : (
                    <button 
                      className="upgrade-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgradeClick();
                      }}
                    >
                      💎 Upgrade to Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Information Section */}
          <div className="pdf-report-info">
            <div className="info-section">
              <h4>📋 About Our Reports</h4>
              <ul>
                <li>✅ All reports are personalized based on your profile and consultation</li>
                <li>✅ Include the latest government requirements and official sources</li>
                <li>✅ Professionally formatted PDFs ready for printing or sharing</li>
                <li>✅ Generated with your name and date for official documentation</li>
              </ul>
            </div>

            {user?.tier !== 'premium' && (
              <div className="upgrade-info">
                <h4>💎 Why Upgrade to Premium?</h4>
                <div className="upgrade-benefits">
                  <div className="benefit-item">
                    <span className="benefit-icon">🚀</span>
                    <span>Unlimited AI questions per day</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">📖</span>
                    <span>Unlimited comprehensive PDF reports</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">⚡</span>
                    <span>Priority customer support</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">📋</span>
                    <span>Advanced document templates</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🔔</span>
                    <span>Real-time policy alerts</span>
                  </div>
                </div>
                <button 
                  className="upgrade-btn-large"
                  onClick={handleUpgradeClick}
                >
                  💎 Upgrade to Premium - $29/month
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFReportGenerator; 