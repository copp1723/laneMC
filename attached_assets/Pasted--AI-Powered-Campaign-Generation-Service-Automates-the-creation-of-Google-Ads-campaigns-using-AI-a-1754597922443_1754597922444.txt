"""
AI-Powered Campaign Generation Service
Automates the creation of Google Ads campaigns using AI agents
"""

import logging
import json
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum

from src.services.google_ads_agent import GoogleAdsAgent, AgentRole, create_agent
from src.services.brief_converter import brief_converter
from src.services.campaign_orchestrator import CampaignOrchestrator
from src.models.campaign import Campaign
from src.config.database import db

logger = logging.getLogger(__name__)


class GenerationPhase(Enum):
    """Campaign generation phases"""
    BRIEF_EXTRACTION = "brief_extraction"
    STRATEGY_DEVELOPMENT = "strategy_development"
    STRUCTURE_CREATION = "structure_creation"
    CONTENT_GENERATION = "content_generation"
    OPTIMIZATION_SETUP = "optimization_setup"
    REVIEW_APPROVAL = "review_approval"


class CampaignGenerator:
    """Generate complete Google Ads campaigns using AI"""
    
    def __init__(self, orchestrator: CampaignOrchestrator = None):
        self.orchestrator = orchestrator
        self.agents = {
            AgentRole.STRATEGIST: create_agent(AgentRole.STRATEGIST),
            AgentRole.CREATOR: create_agent(AgentRole.CREATOR),
            AgentRole.OPTIMIZER: create_agent(AgentRole.OPTIMIZER),
            AgentRole.ANALYST: create_agent(AgentRole.ANALYST)
        }
        self.brief_converter = brief_converter
        
    async def generate_from_conversation(self, conversation_id: str, 
                                       messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Generate complete campaign from conversation history"""
        try:
            workflow_id = str(uuid.uuid4())
            logger.info(f"Starting campaign generation workflow {workflow_id}")
            
            # Phase 1: Extract and enhance brief
            brief_result = await self._extract_and_enhance_brief(messages)
            if not brief_result['success']:
                return brief_result
            
            brief = brief_result['brief']
            
            # Phase 2: Develop strategy
            strategy_result = await self._develop_strategy(brief)
            if not strategy_result['success']:
                return strategy_result
            
            strategy = strategy_result['strategy']
            
            # Phase 3: Create campaign structure
            structure_result = await self._create_campaign_structure(strategy, brief)
            if not structure_result['success']:
                return structure_result
            
            structure = structure_result['structure']
            
            # Phase 4: Generate content
            content_result = await self._generate_content(structure, brief)
            if not content_result['success']:
                return content_result
            
            campaign_data = content_result['campaign']
            
            # Phase 5: Setup optimization
            optimization_result = await self._setup_optimization(campaign_data, brief)
            campaign_data.update(optimization_result.get('optimizations', {}))
            
            # Phase 6: Final review
            review_result = await self._review_campaign(campaign_data)
            
            # Create campaign in database
            campaign = await self._save_campaign(campaign_data, conversation_id)
            
            return {
                'success': True,
                'campaign': campaign_data,
                'campaign_id': str(campaign.id),
                'workflow_id': workflow_id,
                'review': review_result,
                'ready_to_launch': review_result.get('approved', False)
            }
            
        except Exception as e:
            logger.error(f"Campaign generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _extract_and_enhance_brief(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Extract brief from conversation and enhance with AI"""
        logger.info("Phase 1: Extracting campaign brief from conversation")
        
        # Extract brief
        brief_result = await self.brief_converter.extract_brief_from_conversation(messages)
        if not brief_result['success']:
            return brief_result
        
        # Enhance brief if confidence is low
        if brief_result['confidence'] < 0.8:
            enhanced = await self.brief_converter.enhance_brief(brief_result['brief'])
            if enhanced['success']:
                brief_result['brief'] = enhanced['brief']
        
        return {
            'success': True,
            'brief': brief_result['brief'],
            'confidence': brief_result['confidence']
        }
    
    async def _develop_strategy(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        """Develop comprehensive campaign strategy"""
        logger.info("Phase 2: Developing campaign strategy")
        
        strategist = self.agents[AgentRole.STRATEGIST]
        
        prompt = f"""Based on this campaign brief, develop a comprehensive Google Ads strategy:

{json.dumps(brief, indent=2)}

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

Return as structured JSON."""
        
        response = await strategist.chat(prompt, "strategy_development")
        
        try:
            import json
            content = response['response'].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            strategy = json.loads(content.strip())
            return {
                'success': True,
                'strategy': strategy
            }
        except:
            # Fallback strategy
            return {
                'success': True,
                'strategy': self._get_fallback_strategy(brief)
            }
    
    async def _create_campaign_structure(self, strategy: Dict[str, Any], 
                                       brief: Dict[str, Any]) -> Dict[str, Any]:
        """Create detailed campaign structure"""
        logger.info("Phase 3: Creating campaign structure")
        
        creator = self.agents[AgentRole.CREATOR]
        
        context = {
            'brief': brief,
            'strategy': strategy
        }
        
        structure_result = await creator.generate_campaign_structure(context)
        
        if not structure_result['success']:
            return structure_result
        
        return {
            'success': True,
            'structure': structure_result['campaign_structure']
        }
    
    async def _generate_content(self, structure: Dict[str, Any], 
                              brief: Dict[str, Any]) -> Dict[str, Any]:
        """Generate all campaign content"""
        logger.info("Phase 4: Generating campaign content")
        
        creator = self.agents[AgentRole.CREATOR]
        
        prompt = f"""Generate complete content for this campaign structure:

Structure:
{json.dumps(structure, indent=2)}

Brief:
{json.dumps(brief, indent=2)}

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

Return complete campaign data in JSON format."""
        
        response = await creator.chat(prompt, "content_generation")
        
        try:
            import json
            content = response['response'].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            campaign_data = json.loads(content.strip())
            
            # Merge with structure
            campaign_data.update(structure)
            
            return {
                'success': True,
                'campaign': campaign_data
            }
        except:
            # Use structure with default content
            return {
                'success': True,
                'campaign': self._add_default_content(structure)
            }
    
    async def _setup_optimization(self, campaign_data: Dict[str, Any], 
                                brief: Dict[str, Any]) -> Dict[str, Any]:
        """Setup optimization rules and monitoring"""
        logger.info("Phase 5: Setting up optimization rules")
        
        optimizer = self.agents[AgentRole.OPTIMIZER]
        
        prompt = f"""Setup optimization rules for this campaign:

Campaign Data:
{json.dumps(campaign_data, indent=2)}

Goals:
{json.dumps(brief.get('success_metrics', {}), indent=2)}

Define:
1. Automated rules:
   - Bid adjustments based on performance
   - Budget reallocation rules
   - Keyword pausing thresholds
   - Ad rotation settings

2. Monitoring alerts:
   - Performance drop alerts
   - Budget pacing issues
   - Quality score alerts
   - Conversion tracking issues

3. Optimization schedule:
   - Daily checks
   - Weekly optimizations
   - Monthly reviews

Return optimization configuration as JSON."""
        
        response = await optimizer.chat(prompt, "optimization_setup")
        
        try:
            import json
            content = response['response'].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            optimizations = json.loads(content.strip())
            
            return {
                'success': True,
                'optimizations': optimizations
            }
        except:
            return {
                'success': True,
                'optimizations': self._get_default_optimizations()
            }
    
    async def _review_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Final AI review of campaign"""
        logger.info("Phase 6: Reviewing campaign for quality and compliance")
        
        analyst = self.agents[AgentRole.ANALYST]
        
        prompt = f"""Review this Google Ads campaign for quality and compliance:

{json.dumps(campaign_data, indent=2)}

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

Return review as JSON."""
        
        response = await analyst.chat(prompt, "campaign_review")
        
        try:
            import json
            content = response['response'].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            review = json.loads(content.strip())
            return review
        except:
            return {
                'approved': True,
                'issues': [],
                'suggestions': ["Campaign meets basic requirements"],
                'risk_level': 'low'
            }
    
    async def _save_campaign(self, campaign_data: Dict[str, Any], 
                           conversation_id: str) -> Campaign:
        """Save campaign to database"""
        campaign = Campaign(
            name=campaign_data.get('campaign', {}).get('name', 'AI Generated Campaign'),
            status='draft',
            campaign_type='SEARCH',
            budget_amount=campaign_data.get('campaign', {}).get('budget', 1000),
            bidding_strategy=campaign_data.get('campaign', {}).get('bidding_strategy', 'MAXIMIZE_CONVERSIONS'),
            target_locations=campaign_data.get('campaign', {}).get('locations', ['United States']),
            created_by=1,  # TODO: Get from auth context
            google_campaign_id=f"ai_generated_{uuid.uuid4().hex[:8]}",
            settings=campaign_data
        )
        
        db.session.add(campaign)
        db.session.commit()
        
        return campaign
    
    def _get_fallback_strategy(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        """Get fallback strategy if AI fails"""
        return {
            'campaign_structure': {
                'campaigns': [{
                    'name': brief.get('campaign_name', 'Search Campaign'),
                    'type': 'SEARCH',
                    'focus': 'High-intent keywords'
                }],
                'ad_groups_per_campaign': 3
            },
            'targeting': {
                'keyword_strategy': 'Mixed match types with focus on phrase match',
                'audiences': ['In-market segments', 'Custom intent'],
                'geographic': brief.get('geographic_targeting', {})
            },
            'bidding': {
                'strategy': 'MAXIMIZE_CONVERSIONS',
                'budget_allocation': {'search': 70, 'display': 30}
            },
            'creative': {
                'themes': ['Value proposition', 'Trust signals', 'Call to action'],
                'extensions': ['Sitelinks', 'Callouts', 'Structured snippets']
            }
        }
    
    def _add_default_content(self, structure: Dict[str, Any]) -> Dict[str, Any]:
        """Add default content to campaign structure"""
        # Add default keywords, ads, and extensions
        if 'ad_groups' in structure:
            for ad_group in structure['ad_groups']:
                if 'keywords' not in ad_group:
                    ad_group['keywords'] = [
                        {'text': 'example keyword', 'match_type': 'PHRASE'},
                        {'text': 'sample keyword', 'match_type': 'BROAD'}
                    ]
                if 'ads' not in ad_group:
                    ad_group['ads'] = [{
                        'headlines': ['Great Products', 'Best Prices', 'Shop Now'],
                        'descriptions': ['Quality products at great prices', 'Free shipping available']
                    }]
        
        return structure
    
    def _get_default_optimizations(self) -> Dict[str, Any]:
        """Get default optimization settings"""
        return {
            'automated_rules': [
                {
                    'name': 'Pause low performing keywords',
                    'condition': 'CTR < 1% AND impressions > 100',
                    'action': 'pause'
                },
                {
                    'name': 'Increase bids for high performers',
                    'condition': 'conversion_rate > 5% AND cost_per_conversion < target',
                    'action': 'increase_bid_10_percent'
                }
            ],
            'monitoring_alerts': [
                {'type': 'budget_pace', 'threshold': 90},
                {'type': 'ctr_drop', 'threshold': -25},
                {'type': 'quality_score', 'threshold': 4}
            ],
            'optimization_schedule': {
                'daily': ['Check budget pacing', 'Monitor CTR'],
                'weekly': ['Adjust bids', 'Add negative keywords'],
                'monthly': ['Full performance review', 'Strategy adjustment']
            }
        }


# Global instance
campaign_generator = None

def get_campaign_generator(orchestrator: CampaignOrchestrator = None) -> CampaignGenerator:
    """Get or create campaign generator instance"""
    global campaign_generator
    if campaign_generator is None:
        campaign_generator = CampaignGenerator(orchestrator)
    return campaign_generator