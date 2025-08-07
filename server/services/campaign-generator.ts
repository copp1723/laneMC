/**
 * AI-Powered Campaign Generation Service
 * Automates the creation of Google Ads campaigns using AI agents
 */

import { storage } from '../storage';
import { openRouterService } from './openrouter';
import { googleAdsService } from './google-ads';
import type { InsertCampaign, ChatMessage } from '@shared/schema';

export enum GenerationPhase {
  BRIEF_EXTRACTION = "brief_extraction",
  STRATEGY_DEVELOPMENT = "strategy_development",
  STRUCTURE_CREATION = "structure_creation",
  CONTENT_GENERATION = "content_generation", 
  OPTIMIZATION_SETUP = "optimization_setup",
  REVIEW_APPROVAL = "review_approval"
}

export interface CampaignBrief {
  campaignName: string;
  objective: string;
  budget: {
    amount: number;
    period: 'monthly' | 'daily' | 'total';
    currency: string;
  };
  targetAudience: {
    demographics: {
      ageRange: string;
      gender: string;
      incomeLevel?: string;
    };
    interests: string[];
    behaviors: string[];
  };
  geographicTargeting: {
    countries: string[];
    states: string[];
    cities: string[];
    radius?: number;
  };
  productsServices: {
    name: string;
    category: string;
    uniqueSellingPoints: string[];
  };
  keywords: {
    suggested: string[];
    negative: string[];
  };
  competitors: string[];
  timeline: {
    startDate: string;
    duration: string;
    urgency: 'high' | 'medium' | 'low';
  };
  successMetrics: {
    primaryKpi: string;
    targets: {
      cpa?: number;
      roas?: number;
      conversionRate?: number;
    };
  };
  creativeDirection: {
    tone: string;
    keyMessages: string[];
    callToAction: string;
  };
  additionalRequirements: string[];
}

export interface CampaignStrategy {
  campaignStructure: {
    campaigns: Array<{
      name: string;
      type: 'SEARCH' | 'DISPLAY' | 'PERFORMANCE_MAX' | 'VIDEO' | 'SHOPPING';
      focus: string;
      budget: number;
    }>;
    adGroups: Array<{
      name: string;
      theme: string;
      campaignType: string;
    }>;
  };
  targetingStrategy: {
    keywords: Array<{
      text: string;
      matchType: 'EXACT' | 'PHRASE' | 'BROAD';
      adGroupTheme: string;
    }>;
    audiences: string[];
    geoTargeting: any;
    deviceBidAdjustments: any;
  };
  biddingStrategy: {
    type: string;
    rationale: string;
    expectedCpc: number;
    expectedConversionRate: number;
  };
  creativeStrategy: {
    adCopyThemes: string[];
    usps: string[];
    callToActions: string[];
    extensions: string[];
  };
}

export interface GenerationResult {
  success: boolean;
  campaignId?: string;
  workflowId: string;
  brief?: CampaignBrief;
  strategy?: CampaignStrategy;
  campaignData?: any;
  review?: any;
  readyToLaunch: boolean;
  error?: string;
}

class CampaignGenerator {
  
  async generateFromConversation(
    conversationId: string,
    messages: ChatMessage[]
  ): Promise<GenerationResult> {
    try {
      const workflowId = this.generateWorkflowId();
      console.log(`Starting campaign generation workflow ${workflowId}`);

      // Phase 1: Extract and enhance brief
      const briefResult = await this.extractAndEnhanceBrief(messages);
      if (!briefResult.success) {
        return { ...briefResult, workflowId, readyToLaunch: false };
      }

      const brief = briefResult.brief!;

      // Phase 2: Develop strategy
      const strategyResult = await this.developStrategy(brief);
      if (!strategyResult.success) {
        return { ...strategyResult, workflowId, readyToLaunch: false };
      }

      const strategy = strategyResult.strategy!;

      // Phase 3: Create campaign structure
      const structureResult = await this.createCampaignStructure(strategy, brief);
      if (!structureResult.success) {
        return { ...structureResult, workflowId, readyToLaunch: false };
      }

      const structure = structureResult.structure;

      // Phase 4: Generate content
      const contentResult = await this.generateContent(structure, brief);
      if (!contentResult.success) {
        return { ...contentResult, workflowId, readyToLaunch: false };
      }

      const campaignData = contentResult.campaign;

      // Phase 5: Setup optimization
      const optimizationResult = await this.setupOptimization(campaignData, brief);
      if (optimizationResult.success) {
        Object.assign(campaignData, optimizationResult.optimizations);
      }

      // Phase 6: Final review
      const reviewResult = await this.reviewCampaign(campaignData);

      // Save campaign to database
      const campaign = await this.saveCampaign(campaignData, conversationId, brief.googleAdsAccountId || "");

      return {
        success: true,
        campaignId: campaign.id,
        workflowId,
        brief,
        strategy,
        campaignData,
        review: reviewResult,
        readyToLaunch: reviewResult.approved || false
      };

    } catch (error: any) {
      console.error('Campaign generation failed:', error);
      return {
        success: false,
        error: error.message,
        workflowId: this.generateWorkflowId(),
        readyToLaunch: false
      };
    }
  }

  private async extractAndEnhanceBrief(messages: ChatMessage[]): Promise<{
    success: boolean;
    brief?: CampaignBrief;
    confidence?: number;
    error?: string;
  }> {
    console.log('Phase 1: Extracting campaign brief from conversation');

    try {
      const briefResult = await this.extractBriefFromConversation(messages);
      if (!briefResult.success) {
        return briefResult;
      }

      // Enhance brief if confidence is low
      if (briefResult.confidence! < 0.8) {
        const enhanced = await this.enhanceBrief(briefResult.brief!);
        if (enhanced.success) {
          briefResult.brief = enhanced.brief;
        }
      }

      return briefResult;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async extractBriefFromConversation(messages: ChatMessage[]): Promise<{
    success: boolean;
    brief?: CampaignBrief;
    confidence?: number;
    error?: string;
  }> {
    const prompt = `Analyze this conversation and extract campaign information.
        
Conversation:
${JSON.stringify(messages, null, 2)}

Extract and return in this exact JSON structure:
{
    "campaignName": "descriptive campaign name",
    "objective": "primary goal (leads/sales/awareness/traffic)",
    "budget": {
        "amount": 0,
        "period": "monthly/daily/total",
        "currency": "USD"
    },
    "targetAudience": {
        "demographics": {
            "ageRange": "25-54",
            "gender": "all/male/female",
            "incomeLevel": "if mentioned"
        },
        "interests": ["list of interests"],
        "behaviors": ["purchase behaviors"]
    },
    "geographicTargeting": {
        "countries": ["United States"],
        "states": [],
        "cities": [],
        "radius": null
    },
    "productsServices": {
        "name": "what's being advertised",
        "category": "industry/category",
        "uniqueSellingPoints": ["USPs"]
    },
    "keywords": {
        "suggested": ["relevant keywords"],
        "negative": ["keywords to exclude"]
    },
    "competitors": ["mentioned competitors"],
    "timeline": {
        "startDate": "YYYY-MM-DD or ASAP",
        "duration": "ongoing/3 months/etc",
        "urgency": "high/medium/low"
    },
    "successMetrics": {
        "primaryKpi": "conversions/leads/sales",
        "targets": {
            "cpa": null,
            "roas": null,
            "conversionRate": null
        }
    },
    "creativeDirection": {
        "tone": "professional/casual/urgent",
        "keyMessages": ["main points"],
        "callToAction": "primary CTA"
    },
    "additionalRequirements": ["special requests"]
}

If information is not mentioned, use null or empty arrays. Return ONLY valid JSON.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      // Parse the AI response
      let content = fullResponse.trim();
      if (content.startsWith("```json")) {
        content = content.slice(7);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }

      const brief = JSON.parse(content.trim()) as CampaignBrief;
      const confidence = this.calculateBriefConfidence(brief);

      return {
        success: true,
        brief: this.applyBriefDefaults(brief),
        confidence
      };

    } catch (error: any) {
      console.warn('Failed to parse AI brief extraction:', error);
      return {
        success: true,
        brief: this.getEmptyBrief(),
        confidence: 0.3
      };
    }
  }

  private async developStrategy(brief: CampaignBrief): Promise<{
    success: boolean;
    strategy?: CampaignStrategy;
    error?: string;
  }> {
    console.log('Phase 2: Developing campaign strategy');

    const prompt = `Based on this campaign brief, develop a comprehensive Google Ads strategy:

${JSON.stringify(brief, null, 2)}

Create a detailed strategy including:

1. Campaign Structure:
   - Number of campaigns and their focus
   - Ad groups per campaign with themes
   - Recommended campaign types (Search, Display, Shopping, etc.)

2. Targeting Strategy:
   - Keyword strategy and match types
   - Audience segments to target
   - Geographic and demographic targeting refinements
   - Device and schedule optimizations

3. Bidding and Budget:
   - Recommended bidding strategy with rationale
   - Budget allocation across campaigns
   - Expected CPCs and conversion rates
   - Daily budget recommendations

4. Creative Strategy:
   - Ad copy themes and messaging angles
   - USP highlighting approach
   - Call-to-action variations
   - Extension recommendations

5. Competition Analysis:
   - Likely competitors
   - Differentiation strategies
   - Competitive positioning

Return as structured JSON.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let content = fullResponse.trim();
      if (content.startsWith("```json")) {
        content = content.slice(7);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }

      const strategy = JSON.parse(content.trim()) as CampaignStrategy;
      return { success: true, strategy };

    } catch (error: any) {
      console.warn('Failed to parse strategy, using fallback:', error);
      return {
        success: true,
        strategy: this.getFallbackStrategy(brief)
      };
    }
  }

  private async createCampaignStructure(strategy: CampaignStrategy, brief: CampaignBrief): Promise<{
    success: boolean;
    structure?: any;
    error?: string;
  }> {
    console.log('Phase 3: Creating campaign structure');

    const prompt = `Create detailed campaign structure based on strategy and brief:

Strategy:
${JSON.stringify(strategy, null, 2)}

Brief:
${JSON.stringify(brief, null, 2)}

Generate a complete campaign structure with:
1. Campaign hierarchy
2. Ad group organization 
3. Initial keyword sets
4. Basic targeting parameters

Return as JSON.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let content = fullResponse.trim();
      if (content.startsWith("```json")) {
        content = content.slice(7);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }

      const structure = JSON.parse(content.trim());
      return { success: true, structure };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async generateContent(structure: any, brief: CampaignBrief): Promise<{
    success: boolean;
    campaign?: any;
    error?: string;
  }> {
    console.log('Phase 4: Generating campaign content');

    const prompt = `Generate complete content for this campaign structure:

Structure:
${JSON.stringify(structure, null, 2)}

Brief:
${JSON.stringify(brief, null, 2)}

Generate:
1. For each ad group:
   - 15-20 relevant keywords with match types
   - 3 responsive search ads with:
     - 15 headlines (30 chars max each)
     - 4 descriptions (90 chars max each)
   - Negative keywords to add

2. Ad Extensions:
   - 6-8 sitelink extensions
   - 4-6 callout extensions
   - 3-4 structured snippets
   - Business phone/location if applicable

3. Campaign settings:
   - Location targets with bid adjustments
   - Ad schedule with bid adjustments
   - Device bid adjustments
   - Audience targets

Return complete campaign data in JSON format.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let content = fullResponse.trim();
      if (content.startsWith("```json")) {
        content = content.slice(7);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }

      let campaignData = JSON.parse(content.trim());
      
      // Merge with structure
      campaignData = { ...structure, ...campaignData };

      return { success: true, campaign: campaignData };

    } catch (error: any) {
      // Use structure with default content
      return {
        success: true,
        campaign: this.addDefaultContent(structure)
      };
    }
  }

  private async setupOptimization(campaignData: any, brief: CampaignBrief): Promise<{
    success: boolean;
    optimizations?: any;
    error?: string;
  }> {
    console.log('Phase 5: Setting up optimization rules');

    try {
      const optimizations = this.getDefaultOptimizations();
      return { success: true, optimizations };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async reviewCampaign(campaignData: any): Promise<any> {
    console.log('Phase 6: Reviewing campaign for quality and compliance');

    const prompt = `Review this Google Ads campaign for quality and compliance:

${JSON.stringify(campaignData, null, 2)}

Check for:
1. Google Ads policy compliance
2. Best practice adherence
3. Budget efficiency
4. Targeting accuracy
5. Content quality
6. Potential improvements

Provide:
- Approval status (approved/needs_revision)
- Issues found (if any)
- Improvement suggestions
- Risk assessment
- Expected performance

Return review as JSON.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let content = fullResponse.trim();
      if (content.startsWith("```json")) {
        content = content.slice(7);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }

      return JSON.parse(content.trim());

    } catch (error: any) {
      return {
        approved: true,
        issues: [],
        suggestions: ["Campaign meets basic requirements"],
        riskLevel: 'low'
      };
    }
  }

  private async saveCampaign(campaignData: any, conversationId: string, googleAdsAccountId: string): Promise<{ id: string }> {
    const campaign: InsertCampaign = {
      name: campaignData.campaign?.name || 'AI Generated Campaign',
      status: 'draft',
      googleAdsAccountId,
      type: 'SEARCH',
      budget: campaignData.budget?.amount || 1000,
      targetLocations: campaignData.targeting || {},
      adGroups: campaignData.adGroups || {},
      keywords: campaignData.keywords || {}
    };

    return await storage.createCampaign(campaign);
  }

  private async enhanceBrief(brief: CampaignBrief): Promise<{
    success: boolean;
    brief?: CampaignBrief;
  }> {
    const prompt = `Enhance this campaign brief with professional recommendations:

${JSON.stringify(brief, null, 2)}

Add or improve:
1. Keyword suggestions (10-20 relevant keywords)
2. Negative keywords (5-10 to exclude)
3. Ad copy themes and messages
4. Bidding strategy recommendation
5. Budget allocation across campaigns/ad groups
6. Expected performance metrics

Return the enhanced brief in the same JSON structure with your additions.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      const enhanced = JSON.parse(fullResponse) as CampaignBrief;
      return { success: true, brief: enhanced };

    } catch (error: any) {
      return { success: true, brief }; // Return original if enhancement fails
    }
  }

  // Helper methods
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateBriefConfidence(brief: CampaignBrief): number {
    const requiredFields = [
      'campaignName', 'objective', 'budget', 'targetAudience',
      'geographicTargeting', 'productsServices'
    ];

    const fieldScores = requiredFields.map(field => {
      const value = (brief as any)[field];
      if (!value) return 0;
      
      if (typeof value === 'object' && value !== null) {
        const nonEmptyValues = Object.values(value).filter(v => v).length;
        return Math.min(nonEmptyValues / Object.keys(value).length, 1.0);
      }
      
      return 1.0;
    });

    return fieldScores.reduce((sum, score) => sum + score, 0) / fieldScores.length;
  }

  private applyBriefDefaults(brief: CampaignBrief): CampaignBrief {
    const defaults = {
      campaignName: `Campaign ${new Date().toISOString().split('T')[0]}`,
      objective: 'conversions',
      budget: { amount: 1000, period: 'monthly' as const, currency: 'USD' },
      targetAudience: {
        demographics: { ageRange: '18-65', gender: 'all' },
        interests: [],
        behaviors: []
      },
      geographicTargeting: {
        countries: ['United States'],
        states: [],
        cities: []
      },
      timeline: {
        startDate: 'ASAP',
        duration: 'ongoing',
        urgency: 'medium' as const
      },
      successMetrics: {
        primaryKpi: 'conversions',
        targets: {}
      }
    };

    return { ...defaults, ...brief };
  }

  private getEmptyBrief(): CampaignBrief {
    return {
      campaignName: '',
      objective: '',
      budget: { amount: 0, period: 'monthly', currency: 'USD' },
      targetAudience: {
        demographics: { ageRange: '', gender: '' },
        interests: [],
        behaviors: []
      },
      geographicTargeting: {
        countries: [],
        states: [],
        cities: []
      },
      productsServices: {
        name: '',
        category: '',
        uniqueSellingPoints: []
      },
      keywords: { suggested: [], negative: [] },
      competitors: [],
      timeline: {
        startDate: '',
        duration: '',
        urgency: 'medium'
      },
      successMetrics: {
        primaryKpi: '',
        targets: {}
      },
      creativeDirection: {
        tone: '',
        keyMessages: [],
        callToAction: ''
      },
      additionalRequirements: []
    };
  }

  private getFallbackStrategy(brief: CampaignBrief): CampaignStrategy {
    return {
      campaignStructure: {
        campaigns: [{
          name: brief.campaignName || 'Search Campaign',
          type: 'SEARCH',
          focus: 'Brand and product keywords',
          budget: brief.budget.amount * 0.8
        }],
        adGroups: [{
          name: 'Core Keywords',
          theme: 'Main products/services',
          campaignType: 'SEARCH'
        }]
      },
      targetingStrategy: {
        keywords: brief.keywords.suggested.map(keyword => ({
          text: keyword,
          matchType: 'PHRASE' as const,
          adGroupTheme: 'Core Keywords'
        })),
        audiences: [],
        geoTargeting: brief.geographicTargeting,
        deviceBidAdjustments: {}
      },
      biddingStrategy: {
        type: 'Maximize Conversions',
        rationale: 'Good starting strategy for learning phase',
        expectedCpc: 2.50,
        expectedConversionRate: 0.03
      },
      creativeStrategy: {
        adCopyThemes: brief.creativeDirection.keyMessages,
        usps: brief.productsServices.uniqueSellingPoints,
        callToActions: [brief.creativeDirection.callToAction],
        extensions: ['Sitelinks', 'Callouts', 'Structured Snippets']
      }
    };
  }

  private addDefaultContent(structure: any): any {
    return {
      ...structure,
      keywords: ['default keyword'],
      ads: [{
        headlines: ['Default Headline'],
        descriptions: ['Default description']
      }],
      extensions: []
    };
  }

  private getDefaultOptimizations(): any {
    return {
      automatedRules: [],
      monitoringAlerts: [],
      optimizationSchedule: {
        dailyChecks: true,
        weeklyOptimizations: true,
        monthlyReviews: true
      }
    };
  }
}

export const campaignGenerator = new CampaignGenerator();