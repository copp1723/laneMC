import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { MessageCircle, User, Trash2, Send, Rocket } from 'lucide-react';
import { CampaignBriefGenerator } from './CampaignBriefGenerator';
import type { GoogleAdsAccount } from '@shared/schema';

interface ChatInterfaceProps {
  selectedClient?: GoogleAdsAccount | null;
  onSessionChange?: (sessionId: string | null) => void;
}

const quickActions = [
  { id: 'optimize', label: 'Optimize campaigns', action: 'optimize-campaigns' },
  { id: 'analyze', label: 'Analyze performance', action: 'analyze-performance' },
  { id: 'keywords', label: 'Keyword research', action: 'keyword-research' },
  { id: 'budget', label: 'Budget recommendations', action: 'budget-recommendations' },
];

export default function ChatInterface({ selectedClient, onSessionChange }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    streamingMessage,
    sendMessage,
    currentSessionId,
  } = useChat({ selectedClient });

  // Notify parent when session changes
  useEffect(() => {
    onSessionChange?.(currentSessionId);
  }, [currentSessionId, onSessionChange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const messageText = input.trim();
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickAction = (action: string) => {
    const actionMessages: Record<string, string> = {
      'optimize-campaigns': 'Please analyze my current campaigns and provide optimization recommendations.',
      'analyze-performance': 'Can you analyze my account performance and identify areas for improvement?',
      'keyword-research': 'I need help with keyword research for my campaigns. What opportunities do you see?',
      'budget-recommendations': 'Please review my budget allocation and suggest any adjustments.',
    };

    const message = actionMessages[action];
    if (message) {
      setInput(message);
      textareaRef.current?.focus();
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes === 0 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!selectedClient) {
    return (
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Select a client to start</h3>
            <p className="text-slate-500">Choose a Google Ads account to begin your AI chat session</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Automation Assistant</h3>
            <p className="text-sm text-slate-500">Campaign optimization & strategy</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1"></div>
              Online
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%]">
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-700">
                  I'm your Google Ads automation assistant. I can help optimize campaigns, 
                  manage budgets, analyze performance, and implement AI-driven strategies. What would you like 
                  to work on for {selectedClient.name}?
                </p>
              </div>
              <div className="text-xs text-slate-500 mt-1">Just now</div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.role === 'user' ? 'justify-end' : ''
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className="max-w-[85%]">
              <div className={`rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              <div className={`text-xs text-slate-500 mt-1 ${
                message.role === 'user' ? 'text-right' : ''
              }`}>
                {formatTimestamp(message.createdAt?.toString() || '')}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message with loading indicator */}
        {isStreaming && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%]">
              <div className="bg-slate-100 rounded-lg p-4">
                {streamingMessage ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {streamingMessage}
                    <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse" />
                  </p>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span className="text-sm text-slate-500">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about your Google Ads campaigns, performance, or optimization..."
              className="min-h-[80px] max-h-[200px] resize-none"
              disabled={isStreaming}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-6 py-3 flex items-center space-x-2"
          >
            {isStreaming ? (
              <>
                <span>Sending...</span>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </>
            ) : (
              <>
                <span>Send</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Quick Actions - Compact */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="text-xs px-2 py-1 h-7"
              onClick={() => handleQuickAction(action.action)}
              disabled={isStreaming}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Campaign Brief Generator - Minimized */}
        {selectedClient && currentSessionId && messages.length >= 5 && (
          <div className="mt-3 pt-2 border-t border-slate-100">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between p-1.5 hover:bg-gray-50 rounded text-xs">
                <div className="flex items-center gap-1.5">
                  <Rocket className="w-3 h-3 text-blue-600" />
                  <span className="font-medium text-slate-700">Campaign Brief</span>
                </div>
                <div className="text-xs text-slate-400 group-open:hidden">Expand</div>
              </summary>
              <div className="mt-2 p-2 bg-gray-50 rounded border text-sm">
                <CampaignBriefGenerator
                  sessionId={currentSessionId}
                  accountId={selectedClient.id}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
