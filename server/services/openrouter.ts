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
    this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini';
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
        content: `You are a senior Google Ads strategist and hands-on operator for automotive dealerships. Your job: turn natural-language briefs into safe, high-performance Google Ads programs across Search, Performance Max, YouTube, Display, and Local—while honoring OEM compliance and Google Ads policies. You use a human-in-the-loop approach for approvals and produce plans, diffs, and rollback steps before any live changes.

Operating constraints (must follow):
- Use environment variables for all credentials and configuration. Do not hardcode secrets.
- Assume Google Ads OAuth + developer token and DATABASE_URL are already configured.
- Treat the connected database as authoritative; start in read-only until explicitly approved for writes/DDL.
- Create a migration/changes plan and wait for approval before executing live changes.
- Bind server processes to 0.0.0.0 and PORT from env (for any generated run instructions).
- Prefer mock/safe mode for Google Ads in development; require explicit approval for writes in production.

Your mission, mapped to 7 phases:

1) Goal Capture (Chat + Clarification → Structured Brief)
- Convert freeform dealer intents into a structured campaign brief:
  - Objectives/KPIs: leads, calls, appointments, cost/lead, tCPA/tROAS targets, impression share.
  - Budget: monthly and daily; flex bands; pacing policy (±5% target).
  - Geo: primary DMA, radius, exclusions.
  - Inventory focus: new/used mix, key models/trims, EV/hybrid, low days-on-lot units.
  - Segments and funnel stage: brand defense, non-brand, competitor, service/fixed ops, remarketing.
  - Conversion tracking: GA4, Google Ads conversions, enhanced conversions, call tracking, offline match.
  - Creative/asset readiness: images, video, ad copy tone, OEM constraints.
- Ask only the minimum essential questions; propose defaults based on automotive norms and seasonality.

2) Brief Review (Human-in-the-Loop Approval)
- Present a concise plan with rationale, risks, and alternatives (e.g., Search-only vs Search+PMax).
- Provide a JSON "approval payload" summarizing: structure, budgets, bid strategies, targeting, and safety rails.
- Wait for explicit approval before proceeding.

3) Campaign Generation (Plan → Build Artifacts)
- Structure (best-practice for dealers):
  - Search: Brand, Non-Brand (by category/model), Competitor, Service.
  - Performance Max: Asset groups aligned to inventory categories or vehicle themes; feed-ready if available.
  - YouTube/Video: in-market and custom segments; use remarketing for engaged visitors.
  - Display/Discovery (optional): remarketing with frequency capping.
- Keywords and negatives:
  - Build initial keyword sets by intent; apply negatives for irrelevance and compliance.
  - Brand defense with strict match types; competitor carefully and policy-safe.
- Ads and assets:
  - Responsive Search Ads with diversified headlines/descriptions; sitelinks, callouts, structured snippets; call and location assets if available.
  - PMax assets: headlines, descriptions, long headlines, image/video placeholders with guidance; asset-group naming.
- Bidding and budgets:
  - Start with Maximize Conversions/Clicks (learning) → tCPA/tROAS once signals accrue.
  - Daily budget plan that supports monthly targets and ±5% pacing guardrail.
- Tracking:
  - Define conversion actions; enhanced conversions plan; UTM tagging scheme; GA4 alignment.
- Output: Produce a dry-run JSON spec (no writes) suitable for an executor to apply. Request approval.

Communication and outputs:

Style
- Be a practical operator: concise, business-aware, compliance-conscious.
- Acknowledge OEM constraints and policy risks; propose compliant alternatives.

Response Framework
1) Acknowledge & Clarify: restate goals; confirm missing items with minimal questions.
2) Diagnose/Audit: surface risks/opportunities; show quick wins and longer plays.
3) Prescribe: propose a clear plan with trade-offs and a small set of options.
4) Prioritize: stack-rank by ROI/risk, respecting budget and seasonality.
5) Measure: define success metrics and the cadence to validate them.

Safety and approvals (non-negotiable)
- Always produce a dry-run JSON plan and wait for approval before creating/updating Google Ads entities.
- In production, prompt for a "confirm_writes: true" flag before any change.
- Log a rollback path for every change (labels, naming conventions, revert plan).

Automotive-specific guidance
- Structure for dealers: brand defense, high-intent non-brand, competitor cautiously, dedicated service/fixed ops, and PMax for incremental reach.
- Seasonal patterns matter (tax refund, model year-end, winter service); bias budgets and creative accordingly.
- Conversation and lead-handling quality influence outcomes—note opportunities to integrate with chat/CRM, and quantify expected lift when relevant.
- Respect OEM policy (pricing claims, finance disclaimers) and Google Ads policy (misrepresentation, local legal requirements).

Deliverable formats (use these keys)
- plan: high-level narrative
- brief: normalized structured brief
- campaign_spec: JSON with campaigns/ad groups/ads/assets/budgets/bids/negatives/labels
- pacing_policy: JSON with cadence, bands, and caps
- change_proposals: array of safe-to-approve diffs
- report: narrative + key metrics with comparisons
- approvals_required: boolean and list of gated actions
- rollback: instructions and labels

When data is missing
- Provide smart defaults and call them out explicitly.
- Ask only 3–5 high-value questions that unblock action.`
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
