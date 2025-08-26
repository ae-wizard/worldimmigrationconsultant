import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ConversationalChat.css';
import ApiService from '../services/api.js';

// Global flag to prevent React.StrictMode double initialization
let globalConversationStarted = false;

const ConversationalChat = ({ onShowLeadForm, onAvatarStateChange, showAvatar = true }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userProfile, setUserProfile] = useState({});
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [profileComplete, setProfileComplete] = useState(false);
  const conversationStartedRef = useRef(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Sync typing state with avatar
  useEffect(() => {
    if (onAvatarStateChange) {
      onAvatarStateChange(isTyping, false);
    }
  }, [isTyping, onAvatarStateChange]);

  // ONE-TIME initialization that survives React.StrictMode
  useEffect(() => {
    if (!globalConversationStarted && !conversationStartedRef.current) {
      globalConversationStarted = true;
      conversationStartedRef.current = true;
      console.log('Starting conversation (StrictMode-safe)');
      
      setTimeout(() => {
        startConversation();
      }, 1500);
    }
  }, []);

  // Debug log for waitingForUser state
  useEffect(() => {
    console.log('waitingForUser changed to:', waitingForUser);
  }, [waitingForUser]);

  // Basic profile collection steps - minimal hardcoding
  const profileSteps = {
    welcome: {
      message: "Hello! I'm Sarah, your personal immigration consultant. I'm here to help you navigate U.S. immigration - completely free.",
      nextMessage: "I use the latest USCIS data, updated every hour, to give you the most current guidance. Let's start - what country are you from?",
      inputType: "select",
      placeholder: "Select your country",
      options: [
        { text: "India", value: "India" },
        { text: "China", value: "China" },
        { text: "Mexico", value: "Mexico" },
        { text: "Canada", value: "Canada" },
        { text: "United Kingdom", value: "United Kingdom" },
        { text: "Germany", value: "Germany" },
        { text: "Philippines", value: "Philippines" },
        { text: "Brazil", value: "Brazil" },
        { text: "Nigeria", value: "Nigeria" },
        { text: "Peru", value: "Peru" },
        { text: "South Korea", value: "South Korea" },
        { text: "Japan", value: "Japan" },
        { text: "Australia", value: "Australia" },
        { text: "Other country", value: "other" }
      ]
    },
    visa_goal: {
      message: "Perfect! What's your main immigration goal?",
      inputType: "select",
      placeholder: "Select your goal",
      options: [
        { text: "Work in the US", value: "work" },
        { text: "Study in the US", value: "study" },
        { text: "Join family in the US", value: "family" },
        { text: "Invest in the US", value: "invest" },
        { text: "Visit/Tourism", value: "visit" },
        { text: "Permanent residence", value: "permanent_residence" },
        { text: "Other/Not sure", value: "other" }
      ]
    }
  };

  const addMessage = (text, isUser = false, hasOptions = false, options = null, inputType = null, placeholder = null) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      text,
      isUser,
      hasOptions,
      options,
      inputType,
      placeholder,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const simulateTyping = async (delay = 1000) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, delay));
    setIsTyping(false);
  };

  const handleUserChoice = async (choice) => {
    console.log('User chose:', choice, 'Current step:', currentStep);
    
    setWaitingForUser(false);
    
    // Find the selected option text for display
    const lastMessage = messages[messages.length - 1];
    let selectedOptionText = choice;
    
    if (lastMessage?.options) {
      const selectedOption = lastMessage.options.find(opt => opt.value === choice);
      if (selectedOption) {
        selectedOptionText = selectedOption.text;
      }
    }
    
    addMessage(selectedOptionText, true);

    // Update user profile
    if (currentStep === 'welcome') {
      setUserProfile(prev => ({ ...prev, country: choice }));
      
      if (choice === 'other') {
        await simulateTyping(800);
        addMessage("Please tell me which country you're from:");
        setShowInputField(true);
        setInputPlaceholder("Enter your country...");
        setWaitingForUser(true);
        setCurrentStep('country_input');
        return;
      } else {
        await simulateTyping(800);
        addMessage(`Great! As someone from ${choice}, let me understand your goals better.`);
        await simulateTyping(1000);
        
        const goalStep = profileSteps.visa_goal;
        addMessage(goalStep.message);
        await simulateTyping(500);
        addMessage("", false, true, goalStep.options, goalStep.inputType, goalStep.placeholder);
        setWaitingForUser(true);
        setCurrentStep('visa_goal');
      }
    } else if (currentStep === 'visa_goal') {
      setUserProfile(prev => ({ ...prev, goal: choice }));
      
      // Profile is now complete - switch to AI-driven conversation
      setProfileComplete(true);
      await simulateTyping(1000);
      
      await handleAIResponse(`I'm from ${userProfile.country} and I want to ${choice}. What should I know?`);
    }
  };

  const handleTextInput = async (text) => {
    addMessage(text, true);
    setShowInputField(false);
    
    if (currentStep === 'country_input') {
      setUserProfile(prev => ({ ...prev, country: text }));
      await simulateTyping(1000);
      addMessage(`Thank you! As someone from ${text}, let me understand your goals better.`);
      await simulateTyping(1000);
      
      const goalStep = profileSteps.visa_goal;
      addMessage(goalStep.message);
      await simulateTyping(500);
      addMessage("", false, true, goalStep.options, goalStep.inputType, goalStep.placeholder);
      setWaitingForUser(true);
      setCurrentStep('visa_goal');
    } else if (profileComplete) {
      // Use AI for all responses once profile is complete
      await handleAIResponse(text);
    }
  };

  // Function to extract the last question from AI response
  const extractQuestionFromResponse = (responseText) => {
    // Split by sentences and find the last question
    const sentences = responseText.split(/[.!]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Look for the last sentence that is a valid question
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      
      // Check if it's a valid question (not just text ending with ?)
      if (sentence.includes('?')) {
        // Validate it's actually a question, not just incomplete text
        const questionWords = ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'are', 'is', 'will'];
        const sentenceLower = sentence.toLowerCase();
        
        // Check if it starts with a question word or contains question patterns
        const startsWithQuestionWord = questionWords.some(word => sentenceLower.startsWith(word + ' '));
        const hasQuestionPattern = sentenceLower.includes('can you') ||
                                 sentenceLower.includes('would you like') ||
                                 sentenceLower.includes('what specific') ||
                                 sentenceLower.includes('which') ||
                                 sentenceLower.includes('do you have') ||
                                 sentenceLower.includes('are you') ||
                                 sentenceLower.includes('is there');
        
        // Also check if it's a reasonable length (not too short to be incomplete)
        const isReasonableLength = sentence.length > 10;
        
        if ((startsWithQuestionWord || hasQuestionPattern) && isReasonableLength) {
          // Clean up and return the question
          let question = sentence.trim();
          
          // Remove only transitional words at the beginning, but preserve question words
          question = question.replace(/^(Also,?|So,?|Additionally,?|Furthermore,?|However,?)\s*/i, '');
          
          // Ensure it ends with a question mark
          if (!question.endsWith('?')) {
            question += '?';
          }
          
          // Make sure the question starts with a capital letter
          if (question.length > 0) {
            question = question.charAt(0).toUpperCase() + question.slice(1);
          }
          
          return question;
        }
      }
    }
    
    // If response contains form links, offer form completion help
    if (responseText.includes('uscis.gov') || responseText.includes('ceac.state.gov')) {
      return "Do you need help completing any of these forms or have questions about the required documents?";
    }
    
    // Fallback for when no valid question is found or conversation reaches dead end
    return "Is there anything else you would like to know?";
  };

  const handleAIResponse = async (question) => {
    try {
      addMessage("Let me analyze your situation and provide personalized guidance...");
      await simulateTyping(1000);
      
      // Build complete user profile for context
      const profileData = {
        current_country: userProfile.country || 'unknown',
        current_status: 'none', // Basic status for now
        goal: userProfile.goal || 'unknown'
      };
      
      // Get intelligent response from AI backend
      const response = await ApiService.askQuestion(question, profileData);
      
      // Extract the question from Sarah's response first
      const followUpQuestion = extractQuestionFromResponse(response);
      
      // Remove the question from the main response to separate information from question
      let cleanResponse = response;
      if (followUpQuestion && followUpQuestion !== "Is there anything else you would like to know?") {
        // Remove the question sentence from the main response
        const questionSentences = response.split(/[.!]+/).map(s => s.trim()).filter(s => s.length > 0);
        const responseWithoutQuestion = questionSentences.filter(sentence => {
          const sentenceLower = sentence.toLowerCase();
          return !sentence.includes('?') && 
                 !sentenceLower.includes('can you tell me') &&
                 !sentenceLower.includes('what would you like to know') &&
                 !sentenceLower.includes('what specific') &&
                 !sentenceLower.includes('which') &&
                 !sentenceLower.includes('do you have') &&
                 !sentenceLower.includes('are you') &&
                 !sentenceLower.includes('is there');
        }).join('. ');
        
        if (responseWithoutQuestion.trim()) {
          cleanResponse = responseWithoutQuestion + '.';
        }
      }
      
      // Replace loading message with cleaned AI response (without question)
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && !lastMessage.isUser && lastMessage.text.includes("Let me analyze")) {
          lastMessage.text = cleanResponse;
        }
        return newMessages;
      });
      
      // Always add the extracted question as a separate follow-up message
      await simulateTyping(1500);
      addMessage(followUpQuestion);
      
      // If response contains form links, also offer quick help options
      if (cleanResponse.includes('uscis.gov') || cleanResponse.includes('ceac.state.gov')) {
        await simulateTyping(1000);
        addMessage("I can also help you with:", false, true, [
          { text: "Required documents", value: "required_documents", icon: "📄" },
          { text: "Form completion tips", value: "form_tips", icon: "✍️" },
          { text: "Common mistakes to avoid", value: "common_mistakes", icon: "⚠️" },
          { text: "Filing fees", value: "filing_fees", icon: "💰" }
        ]);
        setWaitingForUser(true);
        return;
      }
      
      setShowInputField(true);
      setInputPlaceholder("Ask me anything about immigration...");
      setWaitingForUser(true);
      
    } catch (error) {
      console.error('AI response failed:', error);
      addMessage("I apologize, but I'm having trouble accessing my knowledge base right now. Please try asking your question again, or I can connect you with our assessment team for personalized help.");
      
      await simulateTyping(1000);
      addMessage("", false, true, [
        { text: "Try again", value: "retry", icon: "🔄" },
        { text: "Get personalized assessment", value: "get_assessment", icon: "📋" }
      ]);
      setWaitingForUser(true);
    }
  };

  const handleRetryOrAssessment = async (choice) => {
    setWaitingForUser(false);
    addMessage(choice === 'retry' ? "Try again" : "Get personalized assessment", true);
    
    if (choice === 'retry') {
      addMessage("Please ask me your immigration question:");
      setShowInputField(true);
      setInputPlaceholder("Ask me anything about immigration...");
      setWaitingForUser(true);
    } else if (choice === 'get_assessment') {
      addMessage("I'd be happy to connect you with our assessment team for detailed guidance specific to your situation!");
      
      if (onShowLeadForm) {
        setTimeout(() => {
          onShowLeadForm();
        }, 1000);
      }
    }
  };

  const startConversation = async () => {
    // StrictMode-safe check to prevent duplicates
    if (messages.length > 0 || !globalConversationStarted || !conversationStartedRef.current) {
      console.log('Conversation already started or not properly initialized, skipping...');
      return;
    }
    
    console.log('Starting conversation (final safety check passed)...');
    
    const welcomeStep = profileSteps.welcome;
    
    // Add first message
    addMessage(welcomeStep.message);
    
    // Add second message after delay
    await simulateTyping(2000);
    addMessage(welcomeStep.nextMessage);
    
    // Add dropdown options after another delay
    await simulateTyping(1500);
    addMessage("", false, true, welcomeStep.options, welcomeStep.inputType, welcomeStep.placeholder);
    setWaitingForUser(true);
    
    console.log('Conversation started successfully');
  };

  // Handle special button choices (retry/assessment)
  const handleSpecialChoice = async (choice) => {
    if (choice === 'retry' || choice === 'get_assessment') {
      await handleRetryOrAssessment(choice);
    } else if (choice === 'required_documents' || choice === 'form_tips' || choice === 'common_mistakes' || choice === 'filing_fees') {
      // Handle form completion assistance
      setWaitingForUser(false);
      const selectedOption = messages[messages.length - 1]?.options?.find(opt => opt.value === choice);
      const questionText = selectedOption ? selectedOption.text : choice;
      addMessage(questionText, true);
      
      // Create specific questions for form help
      let formQuestion = "";
      switch(choice) {
        case 'required_documents':
          formQuestion = "What documents do I need to submit with my immigration form?";
          break;
        case 'form_tips':
          formQuestion = "What are the most important tips for completing immigration forms correctly?";
          break;
        case 'common_mistakes':
          formQuestion = "What are the most common mistakes people make on immigration forms and how can I avoid them?";
          break;
        case 'filing_fees':
          formQuestion = "What are the current filing fees for immigration forms and how do I pay them?";
          break;
        default:
          formQuestion = questionText;
      }
      
      await handleAIResponse(formQuestion);
    } else if (profileComplete) {
      // For any other choices after profile completion, treat as a question to AI
      setWaitingForUser(false);
      const selectedOption = messages[messages.length - 1]?.options?.find(opt => opt.value === choice);
      const questionText = selectedOption ? selectedOption.text : choice;
      addMessage(questionText, true);
      await handleAIResponse(questionText);
    } else {
      // Profile collection phase
      await handleUserChoice(choice);
    }
  };

  return (
    <div className="conversational-chat">
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.isUser ? 'user' : 'assistant'}`}>
            <div className="message-content">
              {message.text && (
                <div className="message-text">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              )}
              
              {message.hasOptions && message.options && (
                <div className="message-options">
                  {message.inputType === 'select' ? (
                    <select
                      className="dropdown-select"
                      onChange={(e) => {
                        if (waitingForUser && e.target.value) {
                          handleSpecialChoice(e.target.value);
                        }
                      }}
                      disabled={!waitingForUser}
                      defaultValue=""
                    >
                      <option value="" disabled>{message.placeholder || "Select an option"}</option>
                      {message.options.map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.text}
                        </option>
                      ))}
                    </select>
                  ) : (
                    message.options.map((option, index) => (
                      <button
                        key={index}
                        className={`option-button ${!waitingForUser ? 'disabled' : ''}`}
                        onClick={() => {
                          console.log('Button clicked:', option.value);
                          if (waitingForUser) {
                            handleSpecialChoice(option.value);
                          }
                        }}
                        disabled={!waitingForUser}
                      >
                        <span className="option-icon">{option.icon}</span>
                        <span className="option-text">{option.text}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        {showInputField && (
          <div className="text-input-container">
            <input
              type="text"
              placeholder={inputPlaceholder}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleTextInput(e.target.value.trim());
                  e.target.value = '';
                }
              }}
              autoFocus
              className="text-input"
            />
            <button
              className="send-button"
              onClick={(e) => {
                const input = e.target.previousSibling;
                if (input.value.trim()) {
                  handleTextInput(input.value.trim());
                  input.value = '';
                }
              }}
            >
              Send
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ConversationalChat; 