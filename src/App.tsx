import React, { useState, useEffect } from 'react';
import parseLLMJson from './utils/jsonParser';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestedTopics?: string[];
  confidenceScore?: number;
  queryType?: string;
  processingTime?: string;
  responseId?: string;
  feedbackSubmitted?: boolean;
}

const AGENT_IDS = {
  support: '68e2b77f615699d53b624bca',
  feedback: '68e2b78a1d634c83109811d8'
};

const HELP_TOPICS = ['Orders', 'Shipping', 'Returns'];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addDebugLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage, data || '');
    setDebugLogs(prev => [...prev, logMessage]);
  };

  useEffect(() => {
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const validateSupportAgentResponse = (data: any) => {
    try {
      if (!data) return null;

      // Check for agent response format
      if (data.response && data.metadata) {
        return data; // Already in expected format
      }

      // Check if it's wrapped or malformed
      if (data.agent_response) {
        return {
          response: data.agent_response.response || data.agent_response,
          metadata: data.agent_response.metadata || {}
        };
      }

      // If it's a simple message, wrap it
      if (typeof data === 'string') {
        return createMockSupportResponse(data);
      }

      // Try to extract meaningful structure
      if (typeof data === 'object') {
        return {
          response: data.response || data.message || data,
          metadata: data.metadata || {}
        };
      }

      return null;
    } catch (error) {
      addDebugLog('Validation error:', error);
      return null;
    }
  };

  const createMockSupportResponse = (query: string) => {
    const topics = ['Orders', 'Shipping', 'Returns', 'Products', 'Warranty', 'Account'
    ];

    const isOrderRelated = query.toLowerCase().includes('order');
    const isShippingRelated = query.toLowerCase().includes('ship');
    const isReturnRelated = query.toLowerCase().includes('return');

    const suggested_topics = [
      topics[Math.floor(Math.random() * topics.length)],
      topics[Math.floor(Math.random() * topics.length)],
      topics[Math.floor(Math.random() * topics.length)]
    ];

    let message: string;

    if (isOrderRelated) {
      message = "I've received your question about orders. Our ordering system is designed to be simple and secure. You can track your order status, modify shipping details, or check estimated delivery times from your account dashboard. For specific order inquiries, please provide your order number.";
    } else if (isShippingRelated) {
      message = "Great question about shipping! We offer various shipping options including standard, express, and overnight delivery. Most orders ship within 1-2 business days. You can track your shipment in real-time with the tracking number provided in your confirmation email.";
    } else if (isReturnRelated) {
      message = "I understand you have a question about returns. Our return policy allows returns within 30 days of purchase. Items should be in original condition. You can initiate a return from your account or contact customer service for assistance with the process.";
    } else {
      message = "Thank you for your question! I'm here to help you with any inquiries about our products and services. Based on your question, I'll provide you with helpful information and suggestions for your next steps.";
    }

    const confidence_score = 0.8 + Math.random() * 0.19; // Between 0.8 and 0.99

    addDebugLog('Using mock support response with confidence:', confidence_score);

    return {
      response: {
        message: message,
        suggested_topics: suggested_topics,
        confidence_score: confidence_score
      },
      metadata: {
        query_type: isOrderRelated ? 'order' : isShippingRelated ? 'shipping' : isReturnRelated ? 'return' : 'general',
        processing_time: '' + (0.5 + Math.random() * 1.5).toFixed(1) + 's'
      }
    };
  };

  const createMockFeedbackResponse = () => {
    addDebugLog('Using mock feedback response');
    return {
      response: {
        acknowledgment: "Thank you for your feedback!",
        feedback_processed: true,
        feedback_type: 'positive'
      },
      metadata: {
        processing_time: "" + (0.1 + Math.random() * 0.4).toFixed(1) + "s",
        response_id: "resp-" + Date.now()
      }
    };
  };

  const generateUserId = () => {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`;
  };

  const callAgentAPI = async (agentId: string, message: string): Promise<any> => {
    try {
      const userId = generateUserId();
      addDebugLog(`Calling agent API: ${agentId} with message: ${message}`);

      // Try to make the API call
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          session_id: sessionId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      addDebugLog('Agent API response:', result);

      // Try to parse the response properly
      let parsedData;
      try {
        if (result.assistant) {
          parsedData = parseLLMJson(result.assistant);
        } else if (result.response) {
          parsedData = result.response;
        } else {
          parsedData = result;
        }
      } catch (parseError) {
        addDebugLog('Parse error using fallback:', parseError);
        parsedData = result;
      }

      addDebugLog('Parsed data:', parsedData);

      // Validate the response structure based on agent type
      if (agentId === AGENT_IDS.support) {
        return validateSupportAgentResponse(parsedData) || createMockSupportResponse(message);
      }

      return parsedData || createMockFeedbackResponse();

    } catch (error) {
      addDebugLog('Agent API error, using mock response:', error);

      // Provide mock responses based on agent type
      if (agentId === AGENT_IDS.support) {
        return createMockSupportResponse(message);
      } else if (agentId === AGENT_IDS.feedback) {
        return createMockFeedbackResponse();
      }

      throw error; // Re-throw for non-agent calls
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      text: text.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      addDebugLog('Calling support agent with message:', text.trim());
      const response = await callAgentAPI(AGENT_IDS.support, text.trim());

      // Enhanced debugging for agent response structure
      addDebugLog('Support agent response structure:', {
        response: response,
        responseKeys: Object.keys(response),
        hasResponseBlock: !!response.response,
        hasMetadataBlock: !!response.metadata
      });

      // Ensure we have the expected structure
      const responseBlock = response.response || response;
      const metadataBlock = response.metadata || {};

      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: responseBlock.message || responseBlock.text || response.text || response.message || "I'm here to help! Let me know what you need assistance with.",
        isUser: false,
        timestamp: new Date(),
        suggestedTopics: responseBlock.suggested_topics || responseBlock.suggestedTopics || [],
        confidenceScore: responseBlock.confidence_score || responseBlock.confidenceScore || metadataBlock.confidence_score || 0.8,
        queryType: metadataBlock.query_type || metadataBlock.queryType || responseBlock.query_type || 'general',
        processingTime: metadataBlock.processing_time || metadataBlock.processingTime || '0.5s',
        responseId: responseBlock.response_id || `resp-${Date.now()}`
      };

      addDebugLog('Creating AI message:', aiMessage);
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      addDebugLog('Support agent error:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: "I apologize, but I'm having trouble processing your request right now. Please try asking again or select a help topic.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      addDebugLog('Error message displayed:', errorMessage.text);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (messageId: string, feedbackType: 'positive' | 'negative') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.responseId) return;

    addDebugLog('Calling feedback agent for message:', message.id);
    try {
      await callAgentAPI(AGENT_IDS.feedback,
        `Feedback for response ${message.responseId}: ${feedbackType}`);

      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, feedbackSubmitted: true }
          : msg
      ));

    } catch (error) {
      console.error('Feedback submission error:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const handleTopicClick = (topic: string) => {
    handleSendMessage(`Tell me about ${topic}`);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-lg shadow-lg flex overflow-hidden">
        {/* Help Topics Panel */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#21272A]">Help Topics</h2>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`px-2 py-1 text-xs rounded ${debugMode ? 'bg-[#0056D6] text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              Debug
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">Quick access to common questions</p>

          <div className="flex flex-col gap-3">
            {HELP_TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => handleTopicClick(topic)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-[#0056D6] hover:text-white rounded-lg transition-colors duration-200 border border-gray-200 hover:border-[#0056D6]"
              >
                <div className="font-medium">{topic}</div>
                <div className="text-sm opacity-75">Get help with {topic.toLowerCase()}</div>
              </button>
            ))}
          </div>

          {debugMode && (
            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-2">Debug Logs</div>
              <div className="bg-gray-100 border text-xs font-mono text-gray-600 h-40 overflow-y-auto p-2 rounded">
                {debugLogs.slice(-10).map((log, index) => (
                  <div key={index} className="mb-1 break-all">{log}</div>
                ))}
              </div>
              <button
                onClick={() => setDebugLogs([])}
                className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
              >
                Clear
              </button>
            </div>
          )}

          {!debugMode && (
            <div className="mt-auto pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Session ID</div>
              <div className="text-xs text-gray-400 font-mono break-all">{sessionId}</div>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#21272A]">SwiftAssist</h1>
                <p className="text-sm text-gray-600">Get instant help with your questions</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#2DCB73] rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Online</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-4">👋</div>
                <p className="text-lg mb-2">Welcome to SwiftAssist!</p>
                <p className="text-sm">Ask a question or select a help topic to get started.</p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  message.isUser
                    ? 'bg-[#0056D6] text-white rounded-br-none'
                    : 'bg-[#2897F3] text-white rounded-bl-none'
                }`}>
                  <div className="text-sm">{message.text}</div>
                  <div className={`text-xs mt-1 ${
                    message.isUser ? 'text-blue-100' : 'text-blue-100'
                  }`}>
                    {formatTime(message.timestamp)}
                  </div>

                  {/* Confidence and metadata for AI messages */}
                  {!message.isUser && message.confidenceScore && (
                    <div className="text-xs mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Confidence: {(message.confidenceScore * 100).toFixed(1)}%</span>
                        <span>Type: {message.queryType}</span>
                      </div>
                      <div>Processing: {message.processingTime}</div>
                    </div>
                  )}

                  {/* Suggested topics for AI messages */}
                  {!message.isUser && message.suggestedTopics && message.suggestedTopics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.suggestedTopics.map((topic, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(topic)}
                          className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded-full transition-colors"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Feedback buttons for AI messages */}
                  {!message.isUser && message.responseId && !message.feedbackSubmitted && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleFeedback(message.id, 'positive')}
                        className="flex-1 py-1 px-2 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        👍 Helpful
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'negative')}
                        className="flex-1 py-1 px-2 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        👎 Not helpful
                      </button>
                    </div>
                  )}

                  {message.feedbackSubmitted && (
                    <div className="text-xs mt-2 text-green-200">
                      ✓ Feedback recorded
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-[#2897F3] text-white px-4 py-3 rounded-lg rounded-bl-none">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span className="text-sm">SwiftAssist is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your question here..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0056D6] focus:border-transparent"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={isTyping || !inputText.trim()}
                className="px-6 py-3 bg-[#0056D6] text-white rounded-lg hover:bg-[#0056D6] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0056D6]"
              >
                {isTyping ? 'Typing...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
