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
    // Use client ID directly from environment
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID || '';
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
      console.log('Attempting OAuth token refresh...');
      console.log('Client ID configured:', !!this.clientId);
      console.log('Client Secret configured:', !!this.clientSecret);
      console.log('Refresh Token configured:', !!this.refreshToken);
      
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });
      console.log('✅ Access token obtained successfully');
      return response.data.access_token;
    } catch (error: any) {
      console.error('❌ OAuth token refresh failed:', error.response?.data || error.message);
      if (error.response?.data?.error === 'invalid_client') {
        console.error('💡 Suggestion: Verify OAuth Client ID/Secret in Google Cloud Console');
      } else if (error.response?.data?.error === 'invalid_grant') {
        console.error('💡 Suggestion: Refresh token may be expired - regenerate using OAuth Playground');
      }
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
      bidStrategy?: string;
    }
  ): Promise<string> {
    if (this.isMockMode) {
      return 'mock_campaign_id_' + Date.now();
    }

    // Create campaign budget first
    const budgetId = await this.createCampaignBudget(customerId, campaignData.budget);
    
    // Create the campaign
    const campaign = {
      operations: [
        {
          create: {
            name: campaignData.name,
            advertisingChannelType: this.mapCampaignType(campaignData.type),
            status: 'PAUSED', // Start paused for review
            campaignBudget: `customers/${customerId}/campaignBudgets/${budgetId}`,
            bidStrategy: this.mapBidStrategy(campaignData.bidStrategy || 'MAXIMIZE_CLICKS'),
            geoTargetTypeSetting: {
              positiveGeoTargetType: 'PRESENCE_OR_INTEREST',
              negativeGeoTargetType: 'PRESENCE'
            }
          }
        }
      ]
    };

    const response = await this.makeRequest(
      `customers/${customerId}/campaigns:mutate`,
      campaign,
      customerId
    );

    if (response.results && response.results.length > 0) {
      const campaignResourceName = response.results[0].resourceName;
      const campaignId = campaignResourceName.split('/').pop();
      
      // Add location targeting if specified
      if (campaignData.targetLocations && campaignData.targetLocations.length > 0) {
        await this.addLocationTargeting(customerId, campaignId, campaignData.targetLocations);
      }
      
      return campaignId;
    }

    throw new Error('Failed to create campaign');
  }

  private async createCampaignBudget(customerId: string, budgetAmount: number): Promise<string> {
    const budget = {
      operations: [
        {
          create: {
            name: `Budget_${Date.now()}`,
            amountMicros: Math.round(budgetAmount * 1000000), // Convert to micros
            deliveryMethod: 'STANDARD'
          }
        }
      ]
    };

    const response = await this.makeRequest(
      `customers/${customerId}/campaignBudgets:mutate`,
      budget,
      customerId
    );

    if (response.results && response.results.length > 0) {
      const budgetResourceName = response.results[0].resourceName;
      return budgetResourceName.split('/').pop();
    }

    throw new Error('Failed to create campaign budget');
  }

  private mapCampaignType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'search': 'SEARCH',
      'display': 'DISPLAY',
      'shopping': 'SHOPPING',
      'video': 'VIDEO',
      'discovery': 'DISCOVERY',
      'local': 'LOCAL',
      'smart': 'SMART'
    };
    return typeMap[type.toLowerCase()] || 'SEARCH';
  }

  private mapBidStrategy(strategy: string): any {
    const strategyMap: { [key: string]: any } = {
      'MAXIMIZE_CLICKS': { maximizeClicks: {} },
      'MAXIMIZE_CONVERSIONS': { maximizeConversions: {} },
      'TARGET_CPA': { targetCpa: { targetCpaMicros: 5000000 } }, // $5 default
      'TARGET_ROAS': { targetRoas: { targetRoas: 4.0 } }, // 400% default
      'MANUAL_CPC': { manualCpc: { enhancedCpcEnabled: true } }
    };
    return strategyMap[strategy] || strategyMap['MAXIMIZE_CLICKS'];
  }

  private async addLocationTargeting(customerId: string, campaignId: string, locations: string[]): Promise<void> {
    // Implementation for adding geo-targeting
    // This would require location criteria mapping
    console.log(`Adding location targeting for campaign ${campaignId}:`, locations);
  }

  async updateCampaignBudget(customerId: string, campaignId: string, newBudget: number): Promise<void> {
    if (this.isMockMode) {
      console.log(`Mock: Updated campaign ${campaignId} budget to $${newBudget}`);
      return;
    }

    // Get campaign budget resource name first
    const campaignQuery = `
      SELECT campaign.campaign_budget
      FROM campaign 
      WHERE campaign.id = ${campaignId}
    `;

    const campaignResponse = await this.makeRequest(
      `customers/${customerId}/googleAds:search`,
      { query: campaignQuery },
      customerId
    );

    if (campaignResponse.results && campaignResponse.results.length > 0) {
      const budgetResourceName = campaignResponse.results[0].campaign.campaignBudget;
      
      const budgetUpdate = {
        operations: [
          {
            update: {
              resourceName: budgetResourceName,
              amountMicros: Math.round(newBudget * 1000000)
            },
            updateMask: 'amount_micros'
          }
        ]
      };

      await this.makeRequest(
        `customers/${customerId}/campaignBudgets:mutate`,
        budgetUpdate,
        customerId
      );
    }
  }

  // Quality Score and Issue Detection Methods
  async getQualityScoreMetrics(customerId: string, campaignId: string): Promise<any[]> {
    if (this.isDevelopmentMode()) {
      // Mock data for development
      return [
        {
          keywordId: 'mock-keyword-1',
          keyword: 'toyota dealership',
          qualityScore: 4,
          adRelevance: 'BELOW_AVERAGE',
          landingPageExperience: 'AVERAGE',
          expectedCtr: 'ABOVE_AVERAGE'
        },
        {
          keywordId: 'mock-keyword-2', 
          keyword: 'car financing',
          qualityScore: 7,
          adRelevance: 'ABOVE_AVERAGE',
          landingPageExperience: 'ABOVE_AVERAGE',
          expectedCtr: 'AVERAGE'
        }
      ];
    }

    try {
      const response = await this.makeRequest(
        customerId, 
        `/googleAds/v15/customers/${customerId}/googleAds:searchStream`,
        'POST',
        {
          query: `
            SELECT 
              ad_group.id,
              ad_group_criterion.keyword.text,
              ad_group_criterion.quality_info.quality_score,
              ad_group_criterion.quality_info.creative_quality_score,
              ad_group_criterion.quality_info.landing_page_quality_score,
              ad_group_criterion.quality_info.search_predicted_ctr
            FROM ad_group_criterion 
            WHERE campaign.id = ${campaignId}
              AND ad_group_criterion.type = KEYWORD
              AND ad_group_criterion.quality_info.quality_score IS NOT NULL
          `
        }
      );

      return response.results?.map((row: any) => ({
        keywordId: row.adGroupCriterion?.resourceName,
        keyword: row.adGroupCriterion?.keyword?.text,
        qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore || 1,
        adRelevance: row.adGroupCriterion?.qualityInfo?.creativeQualityScore || 'UNKNOWN',
        landingPageExperience: row.adGroupCriterion?.qualityInfo?.landingPageQualityScore || 'UNKNOWN',
        expectedCtr: row.adGroupCriterion?.qualityInfo?.searchPredictedCtr || 'UNKNOWN'
      })) || [];

    } catch (error) {
      console.error('Failed to get quality score metrics:', error);
      return [];
    }
  }

  async getAdDisapprovals(customerId: string, campaignId: string): Promise<any[]> {
    if (this.isDevelopmentMode()) {
      // Mock disapproval for development
      return [
        {
          adId: 'mock-ad-1',
          headline: 'Best Car Deals in Town!',
          status: 'DISAPPROVED',
          policyTopic: 'MISLEADING_CONTENT',
          reason: 'Unsubstantiated claims about being "best"'
        }
      ];
    }

    try {
      const response = await this.makeRequest(
        customerId,
        `/googleAds/v15/customers/${customerId}/googleAds:searchStream`,
        'POST',
        {
          query: `
            SELECT
              ad_group_ad.ad.id,
              ad_group_ad.ad.text_ad.headline1,
              ad_group_ad.policy_summary.approval_status,
              ad_group_ad.policy_summary.policy_topic_entries
            FROM ad_group_ad
            WHERE campaign.id = ${campaignId}
              AND ad_group_ad.policy_summary.approval_status = DISAPPROVED
          `
        }
      );

      return response.results?.map((row: any) => ({
        adId: row.adGroupAd?.ad?.id,
        headline: row.adGroupAd?.ad?.textAd?.headline1,
        status: row.adGroupAd?.policySummary?.approvalStatus,
        policyTopic: row.adGroupAd?.policySummary?.policyTopicEntries?.[0]?.topic || 'UNKNOWN',
        reason: row.adGroupAd?.policySummary?.policyTopicEntries?.[0]?.type || 'Policy violation'
      })) || [];

    } catch (error) {
      console.error('Failed to get ad disapprovals:', error);
      return [];
    }
  }
}

export const googleAdsService = new GoogleAdsService();
