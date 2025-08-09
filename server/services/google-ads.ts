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
  private readOnly: boolean;

  constructor() {
    // Use client ID directly from environment
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
    this.loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
    this.isMockMode = false; // Always use real Google Ads API
    this.readOnly = (process.env.GOOGLE_ADS_READ_ONLY || 'true').toLowerCase() === 'true';

    console.log('Google Ads Service initialized:', {
      isMockMode: this.isMockMode,
      readOnly: this.readOnly,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasDeveloperToken: !!this.developerToken,
      hasRefreshToken: !!this.refreshToken,
      hasLoginCustomerId: !!this.loginCustomerId
    });
  }

  public isReadOnly(): boolean {
    return this.readOnly;
  }


  private async getAccessToken(): Promise<string> {
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

  private async makeRequest(endpoint: string, data?: any): Promise<any> {
    // Enforce read-only permissible use: disallow mutate endpoints when enabled
    if (this.readOnly) {
      const isMutate = /:mutate($|\?|#)/.test(endpoint) || endpoint.includes(':mutate');
      if (isMutate) {
        throw new Error('Google Ads API is in read-only mode. Mutation requests are disabled.');
      }
    }

    const accessToken = await this.getAccessToken();
    const headers: Record<string,string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };
    if (this.loginCustomerId) headers['login-customer-id'] = this.loginCustomerId; // manager stays here

    const url = `${this.baseUrl}/${endpoint}`;
    const max = 5;
    for (let i = 0; i < max; i++) {
      try {
        const resp = await axios({
          method: data ? 'POST' : 'GET',
          url,
          headers,
          data,
          timeout: 20000
        });
        return resp.data;
      } catch (e: any) {
        const status = e?.response?.status;
        const retryable = [429,500,502,503,504].includes(status);
        if (!retryable || i === max - 1) {
          console.error('Google Ads API error:', e.response?.data || e.message);
          throw new Error(`Google Ads API error: ${e.response?.data?.error?.message || e.message}`);
        }
        await new Promise(r => setTimeout(r, 250 * Math.pow(2,i) + Math.random()*200));
      }
    }
  }



  async getAccessibleCustomers(): Promise<string[]> {

    try {
      // Use the correct Google Ads API URL format for listing accessible customers
      const accessToken = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/${this.apiVersion}/customers:listAccessibleCustomers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Accessible customers response:', response.data);

      // Extract customer IDs from resource names
      const customerIds = (response.data.resourceNames || []).map((resourceName: string) => {
        return resourceName.replace('customers/', '');
      });

      console.log('Extracted customer IDs:', customerIds);
      return customerIds;
    } catch (error: any) {
      console.error('Failed to get accessible customers:', error.response?.data || error.message);
      return [];
    }
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

    const response = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, {
      query,
    });

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

    const response = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, { query });

    return (response.results || []).map((result: any) => ({
      id: result.campaign.id,
      name: result.campaign.name,
      status: result.campaign.status,
      type: result.campaign.advertisingChannelType,
      budget: parseInt(result.campaignBudget?.amountMicros || '0') / 1000000,
    }));
  }

  async getPerformanceMetrics(customerId: string, campaignId?: string, dateRange: string = 'LAST_7_DAYS'): Promise<GoogleAdsMetrics> {
    const filters: string[] = [`segments.date DURING ${dateRange}`];
    if (campaignId) filters.unshift(`campaign.id = ${campaignId}`);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
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
      ${where}
    `;
    const response = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, { query });

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
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0,
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
      `${this.apiVersion}/customers/${customerId}/campaigns:mutate`,
      campaign
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
      `${this.apiVersion}/customers/${customerId}/campaignBudgets:mutate`,
      budget
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

    // Get campaign budget resource name first
    const campaignQuery = `
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `;

    const campaignResponse = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, { query: campaignQuery });

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

      await this.makeRequest(`${this.apiVersion}/customers/${customerId}/campaignBudgets:mutate`, budgetUpdate);
    }
  }

  // Quality Score and Issue Detection Methods
  async getQualityScoreMetrics(customerId: string, campaignId: string): Promise<any[]> {
    try {
      const query = `
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
      `;

      const response = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, { query });

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
    try {
      const query = `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.text_ad.headline1,
          ad_group_ad.policy_summary.approval_status,
          ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE campaign.id = ${campaignId}
          AND ad_group_ad.policy_summary.approval_status = DISAPPROVED
      `;

      const response = await this.makeRequest(`${this.apiVersion}/customers/${customerId}/googleAds:search`, { query });

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
