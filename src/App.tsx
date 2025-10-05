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

interface FeedbackData {
  responseId: string;
  feedbackType: 'positive' | 'negative';
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

  useEffect(() => {
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const generateUserId = () => {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`;
  };

  const callAgentAPI = async (agentId: string, message: string): Promise<any> => {
    try {
      const userId = generateUserId();
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

      const result = await response.json();
      return parseLLMJson(result.assistant || result.response || result);
    } catch (error) {
      console.error('Agent API error:', error);
      throw error;
    }
  };

  const handleSendMessage = async (text: string, isTopic: boolean = false) => {
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
      const response = await callAgentAPI(AGENT_IDS.support, text.trim());

      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: response.response?.message || "I'm here to help you with any questions you have about our products and services.",
        isUser: false,
        timestamp: new Date(),
        suggestedTopics: response.response?.suggested_topics || [],
        confidenceScore: response.response?.confidence_score || 0.8,
        queryType: response.metadata?.query_type || 'general',
        processingTime: response.metadata?.processing_time || '0.5s',
        responseId: `resp-${Date.now()}`
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (messageId: string, feedbackType: 'positive' | 'negative') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.responseId) return;

    try {
      const response = await callAgentAPI(AGENT_IDS.feedback,
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
    handleSendMessage(`Tell me about ${topic}`, true);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-lg shadow-lg flex overflow-hidden">
        {/* Help Topics Panel */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[#21272A] mb-2">Help Topics</h2>
            <p className="text-sm text-gray-600">Quick access to common questions</p>
          </div>

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

          <div className="mt-auto pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">Session ID</div>
            <div className="text-xs text-gray-400 font-mono break-all">{sessionId}</div>
          </div>
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
                          onClick={() => handleSendMessage(topic, true)}
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
