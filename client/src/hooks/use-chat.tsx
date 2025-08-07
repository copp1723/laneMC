import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, streamChatMessage } from '@/lib/api';
import type { ChatSession, ChatMessage, GoogleAdsAccount } from '@shared/schema';

interface UseChatProps {
  selectedClient?: GoogleAdsAccount | null;
}

export function useChat({ selectedClient }: UseChatProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get chat sessions
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ['/api/chat/sessions', selectedClient?.id],
    enabled: !!selectedClient,
  });

  // Get current session messages
  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/sessions', currentSessionId, 'messages'],
    enabled: !!currentSessionId,
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!selectedClient) throw new Error('No client selected');
      
      const response = await apiRequest('POST', '/api/chat/sessions', {
        googleAdsAccountId: selectedClient.id,
        title,
      });
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSessionId(session.id);
      queryClient.invalidateQueries({
        queryKey: ['/api/chat/sessions', selectedClient?.id]
      });
    },
  });

  // Send message function with streaming
  const sendMessage = async (content: string): Promise<void> => {
    if (!currentSessionId || isStreaming) return;

    try {
      setIsStreaming(true);
      setStreamingMessage('');

      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      await streamChatMessage(
        currentSessionId,
        content,
        (chunk) => {
          setStreamingMessage(prev => prev + chunk);
        },
        () => {
          setIsStreaming(false);
          setStreamingMessage('');
          // Refetch messages to get the complete conversation
          refetchMessages();
        },
        (error) => {
          console.error('Streaming error:', error);
          setIsStreaming(false);
          setStreamingMessage('');
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  // Auto-create session when client changes
  useEffect(() => {
    if (selectedClient && sessions.length === 0) {
      createSessionMutation.mutate(`Chat with ${selectedClient.name}`);
    } else if (sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [selectedClient, sessions.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    messages,
    isStreaming,
    streamingMessage,
    sendMessage,
    createSession: (title: string) => createSessionMutation.mutate(title),
    isCreatingSession: createSessionMutation.isPending,
  };
}
