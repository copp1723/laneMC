import { GoogleAuth } from 'google-auth-library';
import axios, { AxiosInstance } from 'axios';

export interface GoogleAdsClient {
  customerId: string;
  name: string;
  currency?: string;
  timezone?: string;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  bidStrategy?: string;
}

export interface GoogleAdsMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
}

class GoogleAdsService {
  private clientId: string;
  private clientSecret: string;
  private developerToken: string;
  private refreshToken: string;
  private loginCustomerId: string;
  private apiVersion: string = 'v15';
  private baseUrl: string = 'https://googleads.googleapis.com';
  private isMockMode: boolean;

  constructor() {
    // Fix client ID format - remove the duplicate prefix
    const rawClientId = process.env.GOOGLE_ADS_CLIENT_ID || '';
    this.clientId = rawClientId.replace('GOOGLE_ADS_CLIENT_ID=', '');
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
    this.loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
    this.isMockMode = process.env.ENVIRONMENT !== 'production';
    
    console.log('Google Ads Service initialized:', {
      isMockMode: this.isMockMode,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasDeveloperToken: !!this.developerToken,
      hasRefreshToken: !!this.refreshToken,
      hasLoginCustomerId: !!this.loginCustomerId
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.isMockMode) {
      return 'mock_access_token';
    }

    try {
      console.log('Getting access token with client ID:', this.clientId.substring(0, 20) + '...');
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });
      console.log('Access token obtained successfully');
      return response.data.access_token;
    } catch (error: any) {
      console.error('Failed to get access token:', error.response?.data || error.message);
      throw new Error(`Failed to get access token from Google OAuth: ${error.response?.data?.error_description || error.message}`);
    }
  }

  private async makeRequest(endpoint: string, data?: any, customerId?: string): Promise<any> {
    if (this.isMockMode) {
      return this.getMockResponse(endpoint, data);
    }

    const accessToken = await this.getAccessToken();
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };

    // Use login customer ID for manager account access
    if (this.loginCustomerId) {
      headers['login-customer-id'] = this.loginCustomerId;
    }

    // Override with specific customer ID if provided
    if (customerId) {
      headers['login-customer-id'] = customerId;
    }

    try {
      console.log(`Making Google Ads API request to: ${endpoint}`);
      const response = await axios({
        method: data ? 'POST' : 'GET',
        url: `${this.baseUrl}/${this.apiVersion}/${endpoint}`,
        headers,
        data,
      });
      console.log('Google Ads API request successful');
      return response.data;
    } catch (error: any) {
      console.error('Google Ads API error:', error.response?.data || error.message);
      throw new Error(`Google Ads API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  private getMockResponse(endpoint: string, data?: any): any {
    // Mock responses for development
    if (endpoint.includes('customers:listAccessibleCustomers')) {
      return {
        resourceNames: [
          'customers/123-456-7890',
          'customers/234-567-8901',
          'customers/345-678-9012',
        ],
      };
    }

    if (endpoint.includes('googleAds:search')) {
      if (data?.query?.includes('customer')) {
        return {
          results: [
            {
              customer: {
                resourceName: 'customers/123-456-7890',
                id: '1234567890',
                descriptiveName: 'Acme Corp',
                currencyCode: 'USD',
                timeZone: 'America/New_York',
              },
            },
          ],
        };
      }

      if (data?.query?.includes('campaign')) {
        return {
          results: [
            {
              campaign: {
                resourceName: 'customers/123-456-7890/campaigns/11111111',
                id: '11111111',
                name: 'Search Campaign - Brand Terms',
                status: 'ENABLED',
                advertisingChannelType: 'SEARCH',
              },
              campaignBudget: {
                amountMicros: '1000000000', // $1000 in micros
              },
            },
          ],
        };
      }

      if (data?.query?.includes('metrics')) {
        return {
          results: [
            {
              metrics: {
                impressions: '12500',
                clicks: '875',
                conversions: 42.5,
                costMicros: '284700000', // $284.70 in micros
                ctr: 0.07,
                averageCpc: '325000', // $0.325 in micros
                conversionRate: 0.0486,
              },
            },
          ],
        };
      }
    }

    return { results: [] };
  }

  async getAccessibleCustomers(): Promise<string[]> {
    const response = await this.makeRequest('customers:listAccessibleCustomers');
    return response.resourceNames || [];
  }

  async getCustomerInfo(customerId: string): Promise<GoogleAdsClient> {
    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer 
      WHERE customer.id = ${customerId}
    `;

    const response = await this.makeRequest(`customers/${customerId}/googleAds:search`, {
      query,
    }, customerId);

    if (response.results && response.results.length > 0) {
      const customer = response.results[0].customer;
      return {
        customerId: customer.id,
        name: customer.descriptiveName,
        currency: customer.currencyCode,
        timezone: customer.timeZone,
      };
    }

    throw new Error(`Customer ${customerId} not found`);
  }

  async getCampaigns(customerId: string): Promise<GoogleAdsCampaign[]> {
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
    `;

    const response = await this.makeRequest(`customers/${customerId}/googleAds:search`, {
      query,
    }, customerId);

    return (response.results || []).map((result: any) => ({
      id: result.campaign.id,
      name: result.campaign.name,
      status: result.campaign.status,
      type: result.campaign.advertisingChannelType,
      budget: parseInt(result.campaignBudget?.amountMicros || '0') / 1000000,
    }));
  }

  async getPerformanceMetrics(
    customerId: string,
    campaignId?: string,
    dateRange: string = 'LAST_7_DAYS'
  ): Promise<GoogleAdsMetrics> {
    let whereClause = '';
    if (campaignId) {
      whereClause = `WHERE campaign.id = ${campaignId}`;
    }

    const query = `
      SELECT 
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions_from_interactions_rate
      FROM campaign 
      ${whereClause}
      AND segments.date DURING ${dateRange}
    `;

    const response = await this.makeRequest(`customers/${customerId}/googleAds:search`, {
      query,
    }, customerId);

    // Aggregate metrics from all results
    const totals = (response.results || []).reduce((acc: any, result: any) => {
      const metrics = result.metrics;
      return {
        impressions: acc.impressions + parseInt(metrics.impressions || '0'),
        clicks: acc.clicks + parseInt(metrics.clicks || '0'),
        conversions: acc.conversions + parseFloat(metrics.conversions || '0'),
        cost: acc.cost + (parseInt(metrics.costMicros || '0') / 1000000),
      };
    }, { impressions: 0, clicks: 0, conversions: 0, cost: 0 });

    return {
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: totals.conversions,
      cost: totals.cost,
      ctr: totals.clicks > 0 ? (totals.clicks / totals.impressions) : 0,
      cpc: totals.clicks > 0 ? (totals.cost / totals.clicks) : 0,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) : 0,
    };
  }

  async createCampaign(
    customerId: string,
    campaignData: {
      name: string;
      type: string;
      budget: number;
      targetLocations?: string[];
      keywords?: string[];
    }
  ): Promise<string> {
    if (this.isMockMode) {
      return 'mock_campaign_id_' + Date.now();
    }

    // Implementation for creating actual campaigns would go here
    // This is a complex operation that requires proper campaign structure
    throw new Error('Campaign creation not implemented in this MVP');
  }
}

export const googleAdsService = new GoogleAdsService();
