import axios from 'axios';
import { CacheService } from './cache';

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
  private apiVersion: string = 'v15';
  private baseUrl: string = 'https://googleads.googleapis.com';

  constructor() {
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
    
    // Require all credentials for production use - no mock mode
    if (!this.clientId || !this.clientSecret || !this.developerToken || !this.refreshToken) {
      throw new Error('Missing required Google Ads API credentials. All of CLIENT_ID, CLIENT_SECRET, DEVELOPER_TOKEN, and REFRESH_TOKEN must be provided.');
    }
    
    console.log('Google Ads service initialized with production credentials');
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });
      return response.data.access_token;
    } catch (error: any) {
      throw new Error(`Failed to get access token from Google OAuth: ${error.response?.data?.error_description || error.message}`);
    }
  }

  private async makeRequest(endpoint: string, data?: any, customerId?: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };

    if (customerId) {
      headers['login-customer-id'] = customerId;
    }

    try {
      const response = await axios({
        method: data ? 'POST' : 'GET',
        url: `${this.baseUrl}/${this.apiVersion}/${endpoint}`,
        headers,
        data,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error_description || 
                          error.message;
      throw new Error(`Google Ads API error: ${errorMessage}`);
    }
  }


  async getAccessibleCustomers(): Promise<string[]> {
    return CacheService.getCachedResult(
      'google_ads',
      'accessible_customers',
      async () => {
        // Use the specific Google Ads API endpoint for listing accessible customers
        const accessToken = await this.getAccessToken();
        const response = await axios.get(
          `${this.baseUrl}/${this.apiVersion}/customers:listAccessibleCustomers`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': this.developerToken,
              'Content-Type': 'application/json',
            }
          }
        );
        return response.data.resourceNames || [];
      },
      300 // Cache for 5 minutes
    );
  }

  async getCustomerInfo(customerId: string): Promise<GoogleAdsClient> {
    return CacheService.getCachedResult(
      'google_ads',
      `customer_info_${customerId}`,
      async () => {
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
      },
      600 // Cache for 10 minutes (customer info doesn't change often)
    );
  }

  async getCampaigns(customerId: string): Promise<GoogleAdsCampaign[]> {
    return CacheService.getCachedResult(
      'google_ads',
      `campaigns_${customerId}`,
      async () => {
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
      },
      300 // Cache for 5 minutes (campaigns may change more frequently)
    );
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

  // REMOVED: Campaign creation functionality
  // This service is READ-ONLY for Google Ads data
  // Campaign structures are generated by AI but not created in Google Ads
}

export const googleAdsService = new GoogleAdsService();
