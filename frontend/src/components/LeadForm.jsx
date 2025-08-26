import { useState, useEffect } from 'react'
import './LeadForm.css'

function LeadForm({ onClose, user, initialData = {} }) {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: '',
    origin_country: user?.origin_country || initialData.origin_country || '',
    destination_country: initialData.destination_country || '',
    visa_type: initialData.goal || '',
    timeline: '',
    budget: '',
    additional_info: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [originCountries, setOriginCountries] = useState([])
  const [destinationCountries, setDestinationCountries] = useState([])
  const [error, setError] = useState('')

  // Load countries from backend
  useEffect(() => {
    const loadCountries = async () => {
      try {
        // Load origin countries
        const originResponse = await fetch('http://localhost:8001/origin-countries');
        const originData = await originResponse.json();
        if (originData.status === 'success') {
          setOriginCountries(originData.countries);
        }

        // Load destination countries  
        const destResponse = await fetch('http://localhost:8001/destination-countries');
        const destData = await destResponse.json();
        if (destData.status === 'success') {
          setDestinationCountries(destData.countries);
        }
      } catch (error) {
        console.error('Error loading countries:', error);
      }
    };

    loadCountries();
  }, []);

  const visaTypeOptions = [
    'work',
    'study', 
    'family',
    'business',
    'investment',
    'permanent_residence',
    'citizenship',
    'visit_tourism',
    'other'
  ]

  const timelineOptions = [
    'ASAP',
    '3-6 months',
    '6-12 months',
    '1-2 years',
    '2+ years',
    'Just exploring'
  ]

  const budgetOptions = [
    'Under $5,000',
    '$5,000 - $10,000',
    '$10,000 - $25,000',
    '$25,000 - $50,000',
    '$50,000+',
    'Not sure yet'
  ]

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('') // Clear errors when user types
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('http://localhost:8001/leads/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setIsSubmitted(true)
        setTimeout(() => {
          onClose()
        }, 4000)
      } else {
        setError(result.message || 'Failed to submit your information')
      }
    } catch (error) {
      console.error('Error submitting lead:', error)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="lead-form-overlay">
        <div className="lead-form">
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h3>Thank You!</h3>
            <p>We've received your information and our visa advisors will contact you within 24 hours.</p>
            <div className="next-steps">
              <p><strong>What happens next:</strong></p>
              <ul>
                <li>📞 Personal consultation call within 24 hours</li>
                <li>📋 Review of your specific immigration situation</li>
                <li>🗺️ Custom immigration strategy and pathway</li>
                <li>💰 Detailed timeline and cost estimate</li>
                <li>📄 Document preparation guidance</li>
              </ul>
            </div>
            <p className="contact-info">
              <strong>Need immediate assistance?</strong><br />
              Email: advisors@worldimmigrationconsultant.com<br />
              Phone: +1 (555) 123-VISA
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lead-form-overlay">
      <div className="lead-form">
        <div className="form-header">
          <h3>👨‍💼 Connect with a Visa Advisor</h3>
          <p>Get personalized immigration guidance from our certified visa specialists. Free consultation to review your case and provide expert recommendations.</p>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="form-content">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="John"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="Doe"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="john.doe@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="origin_country">From Country *</label>
              <select
                id="origin_country"
                name="origin_country"
                value={formData.origin_country}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">Select your current country</option>
                {originCountries.map((country, index) => (
                  <option key={index} value={country.name}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="destination_country">To Country *</label>
              <select
                id="destination_country"
                name="destination_country"
                value={formData.destination_country}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">Select destination country</option>
                {destinationCountries.map((country, index) => (
                  <option key={index} value={country.name}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="visa_type">Visa/Immigration Type *</label>
            <select
              id="visa_type"
              name="visa_type"
              value={formData.visa_type}
              onChange={handleChange}
              required
              className="form-select"
            >
              <option value="">Select visa type</option>
              <option value="work">💼 Work Visa</option>
              <option value="study">🎓 Study Visa</option>
              <option value="family">👨‍👩‍👧‍👦 Family Reunion</option>
              <option value="business">🏢 Business Visa</option>
              <option value="investment">💰 Investment Visa</option>
              <option value="permanent_residence">🏠 Permanent Residence</option>
              <option value="citizenship">🛂 Citizenship</option>
              <option value="visit_tourism">✈️ Visit/Tourism</option>
              <option value="other">🌟 Other</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="timeline">Desired Timeline</label>
              <select
                id="timeline"
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select timeline</option>
                {timelineOptions.map(timeline => (
                  <option key={timeline} value={timeline}>{timeline}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budget">Budget Range</label>
              <select
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select budget range</option>
                {budgetOptions.map(budget => (
                  <option key={budget} value={budget}>{budget}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="additional_info">Additional Information</label>
            <textarea
              id="additional_info"
              name="additional_info"
              value={formData.additional_info}
              onChange={handleChange}
              placeholder="Tell us about your specific situation, concerns, or questions. Include details about your background, current status, family situation, etc."
              rows="4"
              className="form-textarea"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.origin_country || !formData.destination_country || !formData.visa_type || isSubmitting}
            >
              {isSubmitting ? '⏳ Submitting...' : '🚀 Connect with Advisor'}
            </button>
          </div>
        </form>

        <div className="form-footer">
          <div className="advisor-info">
            <h4>👨‍💼 About Our Visa Advisors</h4>
            <ul>
              <li>✅ Certified immigration specialists with 10+ years experience</li>
              <li>✅ Successfully helped 2,000+ clients worldwide</li>
              <li>✅ Expertise in 132+ countries and all visa types</li>
              <li>✅ Multilingual support available</li>
            </ul>
          </div>
          <p className="privacy-note">
            <small>
              🔒 Your information is secure and confidential. We follow strict privacy policies 
              and will only use your data to provide immigration assistance.
            </small>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LeadForm 