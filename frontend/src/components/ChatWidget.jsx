import { useState, useEffect, useRef } from 'react'
import './ChatWidget.css'

function ChatWidget({ onMessageSent }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Welcome to your AI Immigration Consultant! I\'ll help you find the best immigration path based on your specific situation.',
      timestamp: new Date()
    }
  ])
  const [currentStep, setCurrentStep] = useState('welcome') // 'welcome', 'questionnaire', 'guidance', 'chat'
  const [userProfile, setUserProfile] = useState({
    current_country: '',
    current_status: '',
    goal: '',
    education_level: '',
    has_job_offer: null,
    family_in_us: ''
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const countries = [
    'India', 'China', 'Mexico', 'Philippines', 'Vietnam', 'Nigeria', 'Brazil', 'Canada',
    'United Kingdom', 'Germany', 'France', 'Australia', 'Japan', 'South Korea', 'Other'
  ]

  const statusOptions = [
    { value: 'none', label: 'Outside the US' },
    { value: 'visitor', label: 'Visitor/Tourist in US' },
    { value: 'student', label: 'Student in US' },
    { value: 'worker', label: 'Working in US' },
    { value: 'resident', label: 'Permanent Resident' }
  ]

  const goalOptions = [
    { value: 'work', label: 'Work in the US' },
    { value: 'study', label: 'Study in the US' },
    { value: 'family', label: 'Join family in US' },
    { value: 'visit', label: 'Visit/Tourism' },
    { value: 'permanent_residence', label: 'Get Green Card' },
    { value: 'citizenship', label: 'Become US Citizen' }
  ]

  const familyOptions = [
    { value: 'none', label: 'No family in US' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' }
  ]

  const startQuestionnaire = () => {
    setCurrentStep('questionnaire')
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '📋 Let me ask you a few questions to provide personalized guidance for your immigration journey.',
      timestamp: new Date()
    }])
  }

  const handleProfileSubmit = async () => {
    setIsLoading(true)
    
    try {
      // Send profile to get guidance
      const response = await fetch('http://localhost:8000/get-guidance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userProfile),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const guidance = await response.json()
      
      // Display guidance
      let guidanceText = `✅ **Recommended Path: ${guidance.recommended_visa ? guidance.recommended_visa.toUpperCase() : 'Custom Consultation'}**\n\n`
      
      if (guidance.estimated_timeline) {
        guidanceText += `⏱️ **Estimated Timeline:** ${guidance.estimated_timeline}\n\n`
      }
      
      guidanceText += `📋 **Your Next Steps:**\n`
      guidance.next_steps.forEach((step, index) => {
        guidanceText += `${index + 1}. ${step}\n`
      })
      
      if (guidance.country_specific && guidance.country_specific.length > 0) {
        guidanceText += `\n🌍 **Special Notes for ${userProfile.current_country}:**\n`
        guidance.country_specific.forEach(note => {
          guidanceText += `• ${note}\n`
        })
      }
      
      guidanceText += `\n💬 Ask me specific questions about costs, documents, timelines, or next steps!`

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: guidanceText,
        timestamp: new Date()
      }])
      
      setCurrentStep('chat')
      
      // Call the callback
      if (onMessageSent) {
        onMessageSent()
      }

    } catch (error) {
      console.error('Error getting guidance:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || isLoading) return

    // Add user message
    const userMessage = {
      role: 'user',
      content: question,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Call the FastAPI streaming endpoint
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question,
          user_profile: userProfile
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Create assistant message placeholder
      const assistantMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }
      
      setMessages(prev => [...prev, assistantMessage])

      // Read the streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let assistantContent = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const content = line.slice(6) // Remove 'data: ' prefix
              if (content.trim()) {
                assistantContent += content
                
                // Update the assistant message
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = assistantContent
                  }
                  return newMessages
                })
              }
            }
          }
        }
      } finally {
        // Mark streaming as complete
        setMessages(prev => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.isStreaming = false
          }
          return newMessages
        })
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message
      const errorMessage = {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
        isError: true
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isProfileComplete = () => {
    return userProfile.current_country && userProfile.current_status && userProfile.goal
  }

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <h2>🧭 Immigration Guidance</h2>
        <div className="chat-status">
          {isLoading ? '🟡 Processing...' : currentStep === 'questionnaire' ? '📋 Questionnaire' : '🟢 Ready'}
        </div>
      </div>
      
      <div className="messages-container">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}>
              <div className="message-content">
                <div className="message-text">
                  {msg.content.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  {msg.isStreaming && <span className="typing-cursor">▋</span>}
                </div>
                <div className="message-time">
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {currentStep === 'welcome' && (
        <div className="questionnaire-section">
          <button onClick={startQuestionnaire} className="start-button">
            🚀 Start Your Immigration Assessment
          </button>
        </div>
      )}

      {currentStep === 'questionnaire' && (
        <div className="questionnaire-section">
          <div className="form-group">
            <label>What country are you from?</label>
            <select 
              value={userProfile.current_country} 
              onChange={(e) => setUserProfile({...userProfile, current_country: e.target.value})}
            >
              <option value="">Select your country</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>What's your current status?</label>
            <select 
              value={userProfile.current_status} 
              onChange={(e) => setUserProfile({...userProfile, current_status: e.target.value})}
            >
              <option value="">Select your status</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>What's your immigration goal?</label>
            <select 
              value={userProfile.goal} 
              onChange={(e) => setUserProfile({...userProfile, goal: e.target.value})}
            >
              <option value="">Select your goal</option>
              {goalOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {(userProfile.goal === 'work' || userProfile.goal === 'permanent_residence') && (
            <div className="form-group">
              <label>Do you have a US job offer?</label>
              <div className="radio-group">
                <label>
                  <input 
                    type="radio" 
                    name="job_offer" 
                    checked={userProfile.has_job_offer === true}
                    onChange={() => setUserProfile({...userProfile, has_job_offer: true})}
                  />
                  Yes
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="job_offer" 
                    checked={userProfile.has_job_offer === false}
                    onChange={() => setUserProfile({...userProfile, has_job_offer: false})}
                  />
                  No
                </label>
              </div>
            </div>
          )}

          {(userProfile.goal === 'family' || userProfile.goal === 'permanent_residence') && (
            <div className="form-group">
              <label>Do you have family in the US?</label>
              <select 
                value={userProfile.family_in_us} 
                onChange={(e) => setUserProfile({...userProfile, family_in_us: e.target.value})}
              >
                <option value="">Select family relationship</option>
                {familyOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={handleProfileSubmit} 
            disabled={!isProfileComplete() || isLoading}
            className="submit-profile-button"
          >
            {isLoading ? 'Analyzing...' : '📊 Get My Immigration Plan'}
          </button>
        </div>
      )}
      
      {currentStep === 'chat' && (
        <div className="input-area">
          <div className="input-container">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about costs, documents, timelines, or next steps..."
              disabled={isLoading}
              rows="2"
              className="message-input"
            />
            <button 
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="send-button"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
          <div className="input-hint">
            Common questions: "How much does it cost?" • "How long does it take?" • "What documents do I need?"
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatWidget 