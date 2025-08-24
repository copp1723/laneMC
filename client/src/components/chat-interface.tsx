import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { Bot, User, Trash2, Send } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

interface ChatInterfaceProps {
  selectedClient?: GoogleAdsAccount | null;
}

const quickActions = [
  { id: 'optimize', label: 'Optimize campaigns', action: 'optimize-campaigns' },
  { id: 'analyze', label: 'Analyze performance', action: 'analyze-performance' },
  { id: 'keywords', label: 'Keyword research', action: 'keyword-research' },
  { id: 'budget', label: 'Budget recommendations', action: 'budget-recommendations' },
];

export default function ChatInterface({ selectedClient }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    streamingMessage,
    sendMessage,
  } = useChat({ selectedClient });

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

  const formatTimestamp = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
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
            <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
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
            <h3 className="text-lg font-semibold text-slate-900">AI Assistant</h3>
            <p className="text-sm text-slate-500">Google Ads automation and optimization</p>
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
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%]">
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-700">
                  Hello! I'm your Google Ads AI assistant. I can help you with campaign optimization, 
                  budget management, keyword research, and performance analysis. What would you like 
                  to work on today for {selectedClient.name}?
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
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
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
                {formatTimestamp(message.createdAt!)}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%]">
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {streamingMessage}
                  <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse" />
                </p>
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
            <span>Send</span>
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleQuickAction(action.action)}
              disabled={isStreaming}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
