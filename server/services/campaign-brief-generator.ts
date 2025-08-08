import { openRouterService } from "./openrouter";
import { storage } from "../storage";
import type { ChatMessage, InsertCampaignBrief } from "@shared/schema";

export interface CampaignGoals {
  primaryGoal: string; // leads, sales, traffic, awareness
  businessType: string; // automotive, retail, service, etc.
  targetAudience: string;
  geographicTargeting: string[];
  budgetRange: {
    min: number;
    max: number;
    period: 'daily' | 'monthly';
  };
  timeframe: string;
  specificProducts?: string[];
  competitorMentions?: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface GeneratedCampaignBrief {
  id: string;
  title: string;
  campaignType: 'SEARCH' | 'DISPLAY' | 'VIDEO' | 'SHOPPING';
  objectives: string[];
  targetAudience: {
    demographics: string[];
    interests: string[];
    behaviors: string[];
    locations: string[];
  };
  budget: {
    daily: number;
    monthly: number;
    bidStrategy: string;
  };
  keywords: {
    primary: string[];
    secondary: string[];
    negative: string[];
  };
  adCopy: {
    headlines: string[];
    descriptions: string[];
    callsToAction: string[];
  };
  landingPageRequirements: string[];
  expectedMetrics: {
    estimatedClicks: number;
    estimatedCTR: number;
    estimatedCPC: number;
    projectedConversions: number;
  };
  confidenceScore: number;
  recommendations: string[];
  reviewNotes: string[];
}

class CampaignBriefGeneratorService {
  private readonly AUTOMOTIVE_EXPERTISE_PROMPT = `
You are an expert Google Ads strategist specializing in automotive dealerships and car sales. 
You have deep expertise in:
- Automotive customer journey and buying patterns
- Seasonal trends in car sales (year-end clearance, spring buying season, etc.)
- Local market dynamics for auto dealers
- Google Ads best practices for automotive campaigns
- Lead generation and sales funnel optimization for car dealerships

Your responses should reflect this automotive expertise and provide industry-specific insights.
`;

  async generateFromConversation(
    conversationId: string,
    messages: ChatMessage[],
    accountId: string
  ): Promise<{
    success: boolean;
    brief?: GeneratedCampaignBrief;
    confidence?: number;
    missingInfo?: string[];
    followUpQuestions?: string[];
    error?: string;
  }> {
    try {
      // Step 1: Extract goals and intent from conversation
      const goals = await this.extractCampaignGoals(messages);
      if (!goals) {
        return {
          success: false,
          error: 'Could not extract clear campaign goals from conversation'
        };
      }

      // Step 2: Validate completeness and identify missing information
      const validation = this.validateGoalsCompleteness(goals);
      if (!validation.isComplete) {
        return {
          success: false,
          missingInfo: validation.missing,
          followUpQuestions: await this.generateFollowUpQuestions(goals, validation.missing)
        };
      }

      // Step 3: Generate structured campaign brief
      const brief = await this.generateStructuredBrief(goals, conversationId);
      
      // Step 4: Save to database for review workflow
      const savedBrief = await this.saveBriefForReview(brief, accountId, conversationId);

      return {
        success: true,
        brief,
        confidence: brief.confidenceScore
      };

    } catch (error: any) {
      console.error('Campaign brief generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async extractCampaignGoals(messages: ChatMessage[]): Promise<CampaignGoals | null> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const extractionPrompt = `${this.AUTOMOTIVE_EXPERTISE_PROMPT}

Analyze this conversation and extract campaign goals and requirements. Focus on automotive industry context.

Conversation:
${conversationText}

Extract the following information in JSON format:
{
  "primaryGoal": "leads|sales|traffic|awareness",
  "businessType": "automotive|dealership|service|parts|finance",
  "targetAudience": "description of target audience",
  "geographicTargeting": ["city", "state", "radius"],
  "budgetRange": {
    "min": number,
    "max": number,
    "period": "daily|monthly"
  },
  "timeframe": "campaign duration or urgency",
  "specificProducts": ["vehicle types, services, or products mentioned"],
  "competitorMentions": ["competitors mentioned"],
  "urgency": "low|medium|high"
}

If critical information is missing or unclear, return null.
Only extract information that was explicitly stated or strongly implied.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: extractionPrompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      // Clean and parse JSON response
      let cleanedResponse = fullResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      const goals = JSON.parse(cleanedResponse.trim());
      return goals;

    } catch (error) {
      console.error('Goal extraction failed:', error);
      return null;
    }
  }

  private validateGoalsCompleteness(goals: CampaignGoals): {
    isComplete: boolean;
    missing: string[];
    criticalMissing: string[];
  } {
    const missing: string[] = [];
    const criticalMissing: string[] = [];

    // Critical requirements
    if (!goals.primaryGoal) {
      criticalMissing.push('primary campaign goal');
    }
    if (!goals.businessType) {
      criticalMissing.push('business type');
    }
    if (!goals.budgetRange?.min && !goals.budgetRange?.max) {
      criticalMissing.push('budget range');
    }

    // Important but not critical
    if (!goals.targetAudience || goals.targetAudience.length < 10) {
      missing.push('detailed target audience description');
    }
    if (!goals.geographicTargeting?.length) {
      missing.push('geographic targeting preferences');
    }
    if (!goals.timeframe) {
      missing.push('campaign timeframe or urgency');
    }

    return {
      isComplete: criticalMissing.length === 0 && missing.length <= 1,
      missing: [...criticalMissing, ...missing],
      criticalMissing
    };
  }

  private async generateFollowUpQuestions(
    goals: CampaignGoals,
    missingInfo: string[]
  ): Promise<string[]> {
    const questionPrompt = `${this.AUTOMOTIVE_EXPERTISE_PROMPT}

Based on these partial campaign goals and missing information, generate 2-3 specific follow-up questions to gather the missing details.

Current Goals: ${JSON.stringify(goals, null, 2)}
Missing Information: ${missingInfo.join(', ')}

Generate questions that are:
1. Specific and actionable
2. Focused on automotive industry context
3. Easy for a business owner to answer
4. Designed to gather the most critical missing information first

Return as a JSON array of question strings.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: questionPrompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let cleanedResponse = fullResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      return JSON.parse(cleanedResponse.trim());

    } catch (error) {
      console.error('Follow-up question generation failed:', error);
      return [
        'What is your primary goal for this campaign?',
        'What is your monthly advertising budget range?',
        'Who is your target audience for this campaign?'
      ];
    }
  }

  private async generateStructuredBrief(
    goals: CampaignGoals,
    conversationId: string
  ): Promise<GeneratedCampaignBrief> {
    const briefPrompt = `${this.AUTOMOTIVE_EXPERTISE_PROMPT}

Create a comprehensive Google Ads campaign brief based on these goals:

${JSON.stringify(goals, null, 2)}

Generate a complete campaign strategy with automotive industry best practices.

Return a detailed JSON structure with:
{
  "id": "generated-brief-${Date.now()}",
  "title": "descriptive campaign title",
  "campaignType": "SEARCH|DISPLAY|VIDEO|SHOPPING",
  "objectives": ["specific campaign objectives"],
  "targetAudience": {
    "demographics": ["age, income, life stage"],
    "interests": ["automotive interests"],
    "behaviors": ["in-market behaviors"],
    "locations": ["specific targeting locations"]
  },
  "budget": {
    "daily": number,
    "monthly": number,
    "bidStrategy": "recommended bidding strategy"
  },
  "keywords": {
    "primary": ["high-intent primary keywords"],
    "secondary": ["supporting keywords"],
    "negative": ["negative keywords to exclude"]
  },
  "adCopy": {
    "headlines": ["compelling headlines"],
    "descriptions": ["persuasive descriptions"],
    "callsToAction": ["strong CTAs"]
  },
  "landingPageRequirements": ["landing page recommendations"],
  "expectedMetrics": {
    "estimatedClicks": number,
    "estimatedCTR": number,
    "estimatedCPC": number,
    "projectedConversions": number
  },
  "confidenceScore": number (0-100),
  "recommendations": ["strategic recommendations"],
  "reviewNotes": ["items for human review"]
}

Focus on automotive industry best practices, seasonal considerations, and local market dynamics.`;

    try {
      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: briefPrompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let cleanedResponse = fullResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      const brief = JSON.parse(cleanedResponse.trim());
      
      // Ensure all required fields are present with defaults
      return {
        id: brief.id || `brief-${Date.now()}`,
        title: brief.title || 'AI Generated Campaign',
        campaignType: brief.campaignType || 'SEARCH',
        objectives: brief.objectives || [],
        targetAudience: brief.targetAudience || {
          demographics: [],
          interests: [],
          behaviors: [],
          locations: []
        },
        budget: brief.budget || {
          daily: goals.budgetRange?.min || 50,
          monthly: (goals.budgetRange?.min || 50) * 30,
          bidStrategy: 'MAXIMIZE_CLICKS'
        },
        keywords: brief.keywords || {
          primary: [],
          secondary: [],
          negative: []
        },
        adCopy: brief.adCopy || {
          headlines: [],
          descriptions: [],
          callsToAction: []
        },
        landingPageRequirements: brief.landingPageRequirements || [],
        expectedMetrics: brief.expectedMetrics || {
          estimatedClicks: 100,
          estimatedCTR: 2.5,
          estimatedCPC: 1.50,
          projectedConversions: 5
        },
        confidenceScore: brief.confidenceScore || 75,
        recommendations: brief.recommendations || [],
        reviewNotes: brief.reviewNotes || []
      };

    } catch (error) {
      console.error('Brief generation failed:', error);
      throw new Error('Failed to generate campaign brief');
    }
  }

  private async saveBriefForReview(
    brief: GeneratedCampaignBrief,
    accountId: string,
    conversationId: string
  ): Promise<string> {
    const briefData: InsertCampaignBrief = {
      googleAdsAccountId: accountId,
      title: brief.title,
      objectives: brief.objectives as any,
      targetAudience: brief.targetAudience as any,
      budget: brief.budget.daily as any,
      status: 'draft',
      generatedCampaign: {
        keywords: brief.keywords,
        adCopy: brief.adCopy,
      } as any,
      chatSessionId: conversationId
    };

    const savedBrief = await storage.createCampaignBrief(briefData);
    return savedBrief.id;
  }

  // Public methods for external use
  async generateFollowUpFromMissing(
    missingInfo: string[],
    currentGoals: Partial<CampaignGoals>
  ): Promise<string[]> {
    return await this.generateFollowUpQuestions(currentGoals as CampaignGoals, missingInfo);
  }

  async reviewAndRefineBreif(
    briefId: string,
    feedback: string,
    requestedChanges: string[]
  ): Promise<{
    success: boolean;
    refinedBrief?: GeneratedCampaignBrief;
    error?: string;
  }> {
    try {
      const brief = await storage.getCampaignBrief(briefId);
      if (!brief) {
        throw new Error('Campaign brief not found');
      }

      const refinementPrompt = `${this.AUTOMOTIVE_EXPERTISE_PROMPT}

Refine this campaign brief based on user feedback:

Current Brief: ${JSON.stringify(brief, null, 2)}
User Feedback: ${feedback}
Requested Changes: ${requestedChanges.join(', ')}

Return the refined brief in the same JSON structure, incorporating the feedback while maintaining automotive industry best practices.`;

      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: refinementPrompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      let cleanedResponse = fullResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      const refinedBrief = JSON.parse(cleanedResponse.trim());

      return {
        success: true,
        refinedBrief
      };

    } catch (error: any) {
      console.error('Brief refinement failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const campaignBriefGeneratorService = new CampaignBriefGeneratorService();