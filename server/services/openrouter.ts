import axios from 'axios';
import { EventEmitter } from 'events';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamResponse {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

class OpenRouterService extends EventEmitter {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor() {
    super();
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3-sonnet';
  }

  async streamChatCompletion(
    messages: ChatMessage[],
    onChunk: (content: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: `You are an expert Google Ads automation assistant. You help users with:
- Campaign strategy and optimization
- Keyword research and bidding strategies
- Budget management and pacing recommendations
- Performance analysis and reporting
- Ad copy creation and testing
- Audience targeting and segmentation

Always provide actionable, specific advice based on Google Ads best practices. When discussing campaigns, be specific about metrics, targeting options, and optimization tactics.

Keep responses concise but comprehensive. If you need more information to provide better advice, ask specific questions.`
      };

      const fullMessages = [systemPrompt, ...messages];

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/chat/completions`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          model: this.defaultModel,
          messages: fullMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000,
        },
        responseType: 'stream',
      });

      let fullResponse = '';

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              onComplete(fullResponse);
              return;
            }
            
            try {
              const parsed: StreamResponse = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
              
              if (parsed.choices[0]?.finish_reason) {
                onComplete(fullResponse);
                return;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      });

      response.data.on('error', (error: Error) => {
        onError(error);
      });

      response.data.on('end', () => {
        onComplete(fullResponse);
      });

    } catch (error: any) {
      onError(new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`));
    }
  }

  async generateCampaignBrief(
    businessInfo: {
      industry: string;
      targetAudience: string;
      goals: string[];
      budget: number;
      timeline: string;
    }
  ): Promise<any> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Generate a comprehensive Google Ads campaign brief for:
- Industry: ${businessInfo.industry}
- Target Audience: ${businessInfo.targetAudience}
- Goals: ${businessInfo.goals.join(', ')}
- Budget: $${businessInfo.budget}
- Timeline: ${businessInfo.timeline}

Provide a structured campaign plan with:
1. Campaign structure (Search, Display, Video recommendations)
2. Budget allocation across campaign types
3. Keyword themes and suggestions
4. Ad group organization
5. Targeting recommendations
6. Bidding strategy suggestions
7. Key performance indicators to track

Format as JSON with clear sections.`
      }
    ];

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      
      this.streamChatCompletion(
        messages,
        (chunk) => {
          fullResponse += chunk;
        },
        (complete) => {
          try {
            // Try to parse as JSON, fallback to text if not valid JSON
            const jsonMatch = complete.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ content: complete });
            }
          } catch {
            resolve({ content: complete });
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}

export const openRouterService = new OpenRouterService();
