import { openRouterService } from './openrouter';
import { storage } from '../storage';
import type { CampaignBrief } from '@shared/schema';

export interface CampaignGeneratorService {
  generateCampaignFromBrief(briefId: string): Promise<any>;
  generateCampaignStructure(brief: CampaignBrief): Promise<any>;
  // REMOVED: createGoogleAdsCampaign - This service is READ-ONLY
  // Generated campaigns should be provided as structures for manual implementation
}

class CampaignGeneratorServiceImpl implements CampaignGeneratorService {
  
  async generateCampaignFromBrief(briefId: string): Promise<any> {
    const brief = await storage.getCampaignBrief(briefId);
    if (!brief) {
      throw new Error('Campaign brief not found');
    }

    const generatedCampaign = await this.generateCampaignStructure(brief);
    
    // Update the brief with the generated campaign
    await storage.updateCampaignBrief(briefId, {
      generatedCampaign,
      status: 'pending_approval'
    });

    return generatedCampaign;
  }

  async generateCampaignStructure(brief: CampaignBrief): Promise<any> {
    const prompt = `
Generate a comprehensive Google Ads campaign structure based on the following brief:

Title: ${brief.title}
Objectives: ${JSON.stringify(brief.objectives)}
Target Audience: ${JSON.stringify(brief.targetAudience)}
Budget: $${brief.budget}
Timeline: ${JSON.stringify(brief.timeline)}

Please generate:
1. Campaign name and type (SEARCH, DISPLAY, etc.)
2. Ad groups with relevant themes
3. Keyword suggestions with match types
4. Ad copy variations (headlines and descriptions)
5. Bidding strategy recommendations
6. Target locations (if not specified, suggest based on audience)
7. Budget allocation across ad groups

Format the response as a structured JSON object that can be used to create the actual Google Ads campaign.
`;

    const messages = [
      { role: 'system', content: 'You are an expert Google Ads campaign strategist. Generate detailed, actionable campaign structures.' },
      { role: 'user', content: prompt }
    ];

    let fullResponse = '';
    
    return new Promise((resolve, reject) => {
      openRouterService.streamChatCompletion(
        messages as any,
        (chunk) => {
          fullResponse += chunk;
        },
        (_complete) => {
          try {
            // Try to extract JSON from the response
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const campaignData = JSON.parse(jsonMatch[0]);
              resolve(campaignData);
            } else {
              // Fallback: create a basic structure from the text response
              const basicCampaign = {
                name: brief.title,
                type: 'SEARCH',
                budget: brief.budget,
                generatedContent: fullResponse,
                adGroups: [],
                keywords: [],
                ads: []
              };
              resolve(basicCampaign);
            }
          } catch (error) {
            reject(new Error('Failed to parse generated campaign data'));
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  // REMOVED: createGoogleAdsCampaign method
  // This service is READ-ONLY and should not create actual campaigns in Google Ads
  // Generated campaigns are provided as structures for users to implement manually
}

export const campaignGeneratorService = new CampaignGeneratorServiceImpl();