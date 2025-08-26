// API service for World Immigration Consultant
// Use localhost during development, will be updated for production

// Determine which API URL to use based on environment
const API_URL = import.meta.env.PROD 
  ? 'https://worldimmigration-lb-347178547.us-east-1.elb.amazonaws.com'
  : 'http://127.0.0.1:8001';

class ApiService {
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${API_URL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Get personalized guidance based on user profile
  async getGuidance(userProfile) {
    try {
      const response = await this.makeRequest('/get-guidance', {
        method: 'POST',
        body: JSON.stringify({
          current_country: userProfile.country || 'unknown',
          current_status: userProfile.status || 'none',
          goal: userProfile.goal || 'unknown',
          education_level: userProfile.education,
          has_job_offer: userProfile.hasJobOffer,
          family_in_us: userProfile.familyInUs
        }),
      });
      return response;
    } catch (error) {
      console.error('Failed to get guidance:', error);
      return this.getFallbackGuidance(userProfile);
    }
  }

  // Ask a follow-up question
  async askQuestion(question, userProfile = null) {
    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          user_profile: userProfile ? {
            current_country: userProfile.country || 'unknown',
            current_status: userProfile.status || 'none',
            goal: userProfile.goal || 'unknown',
            education_level: userProfile.education,
            has_job_offer: userProfile.hasJobOffer,
            family_in_us: userProfile.familyInUs
          } : null
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const word = line.slice(6);
            if (word.trim()) {
              result += word + ' ';
            }
          }
        }
      }

      return result.trim();
    } catch (error) {
      console.error('Failed to ask question:', error);
      return "I apologize, but I'm having trouble connecting to my knowledge base right now. Please try again in a moment.";
    }
  }

  // Submit lead information
  async submitLead(leadData) {
    try {
      const response = await this.makeRequest('/lead', {
        method: 'POST',
        body: JSON.stringify({
          email: leadData.email,
          phone: leadData.phone,
          current_country: leadData.country,
          goal: leadData.goal,
          timeline: leadData.timeline,
          additional_info: leadData.additionalInfo
        }),
      });
      return response;
    } catch (error) {
      console.error('Failed to submit lead:', error);
      return { status: 'error', message: 'Failed to submit information. Please try again.' };
    }
  }

  // Get available visa types
  async getVisaTypes() {
    try {
      const response = await this.makeRequest('/visa-types');
      return response.visa_types;
    } catch (error) {
      console.error('Failed to get visa types:', error);
      return this.getFallbackVisaTypes();
    }
  }

  // Check API health
  async checkHealth() {
    try {
      const response = await this.makeRequest('/health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'offline' };
    }
  }

  // Fallback guidance when API is unavailable
  getFallbackGuidance(userProfile) {
    return {
      recommended_visa: 'Please connect with our team',
      next_steps: [
        'Our system is currently being updated',
        'Please submit your information below for personalized guidance',
        'We\'ll respond within 24 hours with detailed recommendations'
      ],
      country_specific: [],
      estimated_timeline: 'Varies by case'
    };
  }

  // Fallback visa types
  getFallbackVisaTypes() {
    return {
      tourist: { name: "Tourist/Visitor Visa (B-1/B-2)", processing_time: "2 weeks to 2 months" },
      work: { name: "Work Visas (H-1B, L-1, O-1, etc.)", processing_time: "3-8 months" },
      student: { name: "Student Visa (F-1/M-1)", processing_time: "2-12 weeks" },
      family: { name: "Family-Based Immigration", processing_time: "8 months to several years" },
      green_card: { name: "Permanent Residence (Green Card)", processing_time: "1-3 years depending on category" },
      citizenship: { name: "Naturalization/Citizenship", processing_time: "10-13 months" }
    };
  }
}

export default new ApiService(); 