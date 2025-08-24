export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const headers: HeadersInit = {};
  
  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Add content type for POST/PUT/PATCH requests
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  return response;
}

export async function streamChatMessage(
  sessionId: string,
  content: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`/api/chat/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process any remaining buffer content
        if (buffer.length > 0) {
          onChunk(buffer);
        }
        onComplete();
        break;
      }

      // Decode the chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // For streaming text, we want to send each character as it comes
      // but we need to handle partial UTF-8 sequences properly
      let processed = '';
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        // Only send complete characters (avoid breaking in middle of multi-byte sequences)
        if (char !== '\uFFFD') { // Replacement character indicates incomplete sequence
          processed += char;
        } else {
          // Keep incomplete sequences in buffer
          buffer = buffer.slice(i);
          break;
        }
      }
      
      if (processed) {
        onChunk(processed);
        // Remove processed characters from buffer
        if (processed.length === buffer.length) {
          buffer = '';
        } else {
          buffer = buffer.slice(processed.length);
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown streaming error'));
  }
}
