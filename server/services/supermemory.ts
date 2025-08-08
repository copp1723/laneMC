import axios from 'axios';
import { 
  SupermemoryConnection, 
  SupermemoryMemory,
  InsertSupermemoryConnection,
  InsertSupermemoryMemory 
} from '@shared/schema';

interface SupermemoryConfig {
  apiKey: string;
  baseUrl: string;
}

interface AddMemoryRequest {
  content: string;
  customId?: string;
  title?: string;
  type?: string;
  connectionId?: string;
  spaces?: string[];
  containerTags?: string[];
  url?: string;
  summary?: string;
}

interface GetMemoryResponse {
  id: string;
  content: string;
  title?: string;
  summary?: string;
  source?: string;
  url?: string;
  og_image?: string;
  type: string;
  status: string;
  custom_id?: string;
  connection_id?: string;
  spaces?: string[];
  container_tags?: string[];
  created_at: string;
  updated_at: string;
}

interface ConnectionRequest {
  provider: string; // "notion" | "google-drive" | "onedrive"
  accessToken: string;
  refreshToken?: string;
  containerTags?: string[];
  documentLimit?: number;
}

interface ConnectionResponse {
  id: string;
  provider: string;
  email?: string;
  document_limit?: number;
  container_tags?: string[];
  expires_at?: string;
  created_at: string;
}

export class SupermemoryService {
  private config: SupermemoryConfig;

  constructor() {
    this.config = {
      apiKey: process.env.SUPERMEMORY_API_KEY || '',
      baseUrl: process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios({
        method,
        url: `${this.config.baseUrl}${endpoint}`,
        headers,
        data,
        timeout: 30000
      });

      return response.data;
    } catch (error: any) {
      console.error('Supermemory API error:', error.response?.data || error.message);
      throw new Error(`Supermemory API error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Memory Management
  async addMemory(request: AddMemoryRequest): Promise<string> {
    console.log('Adding memory to Supermemory:', request.title || 'Untitled');
    
    const response = await this.makeRequest<{ id: string }>('/v1/add', 'POST', {
      content: request.content,
      custom_id: request.customId,
      title: request.title,
      type: request.type || 'text',
      connection_id: request.connectionId,
      spaces: request.spaces,
      container_tags: request.containerTags,
      url: request.url,
      summary: request.summary
    });

    return response.id;
  }

  async getMemory(memoryId: string): Promise<GetMemoryResponse> {
    console.log('Retrieving memory from Supermemory:', memoryId);
    
    return await this.makeRequest<GetMemoryResponse>(`/v1/get/${memoryId}`);
  }

  async searchMemories(query: string, containerTags?: string[]): Promise<GetMemoryResponse[]> {
    console.log('Searching memories in Supermemory:', query);
    
    const params = new URLSearchParams({ q: query });
    if (containerTags && containerTags.length > 0) {
      params.append('container_tags', containerTags.join(','));
    }

    return await this.makeRequest<GetMemoryResponse[]>(`/v1/search?${params}`);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    console.log('Deleting memory from Supermemory:', memoryId);
    
    await this.makeRequest(`/v1/delete/${memoryId}`, 'DELETE');
  }

  // Connection Management
  async createConnection(request: ConnectionRequest): Promise<string> {
    console.log('Creating Supermemory connection for provider:', request.provider);
    
    const response = await this.makeRequest<{ id: string }>('/v1/connections', 'POST', {
      provider: request.provider,
      access_token: request.accessToken,
      refresh_token: request.refreshToken,
      container_tags: request.containerTags,
      document_limit: request.documentLimit
    });

    return response.id;
  }

  async listConnections(containerTags?: string[]): Promise<ConnectionResponse[]> {
    console.log('Listing Supermemory connections');
    
    const params = containerTags && containerTags.length > 0 
      ? `?container_tags=${containerTags.join(',')}` 
      : '';

    return await this.makeRequest<ConnectionResponse[]>(`/v1/connections${params}`);
  }

  async deleteConnection(connectionId: string, containerTags?: string[]): Promise<void> {
    console.log('Deleting Supermemory connection:', connectionId);
    
    const params = containerTags && containerTags.length > 0 
      ? `?container_tags=${containerTags.join(',')}` 
      : '';

    await this.makeRequest(`/v1/connections/${connectionId}${params}`, 'DELETE');
  }

  // Google Ads specific memory operations
  async addCampaignMemory(
    campaignData: any, 
    accountId: string, 
    customerId: string
  ): Promise<string> {
    const content = JSON.stringify(campaignData, null, 2);
    const containerTags = ['google-ads', accountId, customerId];
    
    return await this.addMemory({
      content,
      title: `Google Ads Campaign: ${campaignData.name || 'Untitled'}`,
      type: 'campaign',
      containerTags,
      summary: `Campaign data for ${campaignData.name} in account ${customerId}`
    });
  }

  async addPerformanceMemory(
    metricsData: any, 
    accountId: string, 
    customerId: string, 
    campaignId?: string
  ): Promise<string> {
    const content = JSON.stringify(metricsData, null, 2);
    const containerTags = ['google-ads', 'performance', accountId, customerId];
    if (campaignId) containerTags.push(campaignId);
    
    return await this.addMemory({
      content,
      title: `Performance Data: ${new Date().toISOString().split('T')[0]}`,
      type: 'performance',
      containerTags,
      summary: `Performance metrics for account ${customerId}${campaignId ? ` campaign ${campaignId}` : ''}`
    });
  }

  async addChatMemory(
    chatData: any, 
    accountId: string, 
    sessionId: string
  ): Promise<string> {
    const content = JSON.stringify(chatData, null, 2);
    const containerTags = ['google-ads', 'chat', accountId, sessionId];
    
    return await this.addMemory({
      content,
      title: `Chat Session: ${new Date().toISOString()}`,
      type: 'chat',
      containerTags,
      summary: `Chat conversation data for session ${sessionId}`
    });
  }

  async searchCampaignMemories(accountId: string, customerId: string): Promise<GetMemoryResponse[]> {
    return await this.searchMemories('campaign', ['google-ads', accountId, customerId]);
  }

  async searchPerformanceMemories(accountId: string, customerId: string): Promise<GetMemoryResponse[]> {
    return await this.searchMemories('performance', ['google-ads', 'performance', accountId, customerId]);
  }
}

export const supermemoryService = new SupermemoryService();