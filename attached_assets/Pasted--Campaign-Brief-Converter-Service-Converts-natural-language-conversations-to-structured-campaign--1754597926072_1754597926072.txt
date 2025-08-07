"""
Campaign Brief Converter Service
Converts natural language conversations to structured campaign briefs
"""

import logging
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from src.services.google_ads_agent import GoogleAdsAgent, AgentRole, create_agent

logger = logging.getLogger(__name__)


class BriefConverter:
    """Convert natural language to structured campaign briefs"""
    
    def __init__(self):
        self.strategist = create_agent(AgentRole.STRATEGIST)
        self.patterns = self._initialize_patterns()
        
    def _initialize_patterns(self) -> Dict[str, re.Pattern]:
        """Initialize regex patterns for information extraction"""
        return {
            'budget': re.compile(r'\$?([\d,]+)\s*(?:per\s*)?(month|monthly|day|daily|week|weekly)', re.I),
            'location': re.compile(r'(?:in|target|targeting|location[s]?)\s*[:=]?\s*([A-Za-z\s,]+)', re.I),
            'objective': re.compile(r'(?:goal|objective|purpose|aim)\s*[:=]?\s*([^.!?]+)', re.I),
            'product': re.compile(r'(?:sell|selling|promote|promoting|product|service)\s*[:=]?\s*([^.!?]+)', re.I),
            'audience': re.compile(r'(?:audience|target|customers?|demographic)\s*[:=]?\s*([^.!?]+)', re.I),
            'timeline': re.compile(r'(?:start|begin|launch|run for|duration)\s*[:=]?\s*([^.!?]+)', re.I)
        }
    
    async def extract_brief_from_conversation(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Extract structured brief from conversation history"""
        try:
            # First, use AI to analyze the conversation
            ai_analysis = await self._ai_extract_brief(messages)
            
            # Then extract additional information using patterns
            pattern_data = self._extract_with_patterns(messages)
            
            # Merge and validate the data
            brief = self._merge_and_validate(ai_analysis, pattern_data)
            
            return {
                'success': True,
                'brief': brief,
                'confidence': self._calculate_confidence(brief),
                'missing_fields': self._get_missing_fields(brief)
            }
            
        except Exception as e:
            logger.error(f"Brief extraction error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _ai_extract_brief(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Use AI to extract brief information"""
        prompt = f"""Analyze this conversation and extract campaign information.
        
Conversation:
{json.dumps(messages, indent=2)}

Extract and return in this exact JSON structure:
{{
    "campaign_name": "descriptive campaign name",
    "objective": "primary goal (leads/sales/awareness/traffic)",
    "budget": {{
        "amount": 0,
        "period": "monthly/daily/total",
        "currency": "USD"
    }},
    "target_audience": {{
        "demographics": {{
            "age_range": "25-54",
            "gender": "all/male/female",
            "income_level": "if mentioned"
        }},
        "interests": ["list of interests"],
        "behaviors": ["purchase behaviors"]
    }},
    "geographic_targeting": {{
        "countries": ["United States"],
        "states": [],
        "cities": [],
        "radius": null
    }},
    "products_services": {{
        "name": "what's being advertised",
        "category": "industry/category",
        "unique_selling_points": ["USPs"]
    }},
    "keywords": {{
        "suggested": ["relevant keywords"],
        "negative": ["keywords to exclude"]
    }},
    "competitors": ["mentioned competitors"],
    "timeline": {{
        "start_date": "YYYY-MM-DD or ASAP",
        "duration": "ongoing/3 months/etc",
        "urgency": "high/medium/low"
    }},
    "success_metrics": {{
        "primary_kpi": "conversions/leads/sales",
        "targets": {{
            "cpa": null,
            "roas": null,
            "conversion_rate": null
        }}
    }},
    "creative_direction": {{
        "tone": "professional/casual/urgent",
        "key_messages": ["main points"],
        "call_to_action": "primary CTA"
    }},
    "additional_requirements": ["special requests"]
}}

If information is not mentioned, use null or empty arrays. Return ONLY valid JSON."""
        
        response = await self.strategist.chat(prompt, "brief_extraction")
        
        try:
            # Parse the AI response
            content = response['response'].strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
                
            return json.loads(content.strip())
        except json.JSONDecodeError:
            logger.warning("Failed to parse AI brief extraction")
            return {}
    
    def _extract_with_patterns(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Extract information using regex patterns"""
        extracted = {
            'budget_mentions': [],
            'location_mentions': [],
            'objective_mentions': [],
            'product_mentions': [],
            'audience_mentions': [],
            'timeline_mentions': []
        }
        
        # Combine all user messages
        user_text = ' '.join([msg['content'] for msg in messages if msg['role'] == 'user'])
        
        # Extract budget information
        for match in self.patterns['budget'].finditer(user_text):
            amount = match.group(1).replace(',', '')
            period = match.group(2).lower()
            extracted['budget_mentions'].append({
                'amount': float(amount),
                'period': 'monthly' if 'month' in period else 'daily' if 'day' in period else period
            })
        
        # Extract locations
        for match in self.patterns['location'].finditer(user_text):
            locations = [loc.strip() for loc in match.group(1).split(',')]
            extracted['location_mentions'].extend(locations)
        
        # Extract other information
        for field in ['objective', 'product', 'audience', 'timeline']:
            pattern = self.patterns[field]
            for match in pattern.finditer(user_text):
                extracted[f'{field}_mentions'].append(match.group(1).strip())
        
        return extracted
    
    def _merge_and_validate(self, ai_brief: Dict[str, Any], pattern_data: Dict[str, Any]) -> Dict[str, Any]:
        """Merge AI-extracted brief with pattern-extracted data"""
        # Start with AI brief as base
        final_brief = ai_brief.copy() if ai_brief else self._get_empty_brief()
        
        # Enhance with pattern data
        if pattern_data['budget_mentions'] and not final_brief.get('budget', {}).get('amount'):
            budget_info = pattern_data['budget_mentions'][0]
            final_brief['budget'] = {
                'amount': budget_info['amount'],
                'period': budget_info['period'],
                'currency': 'USD'
            }
        
        if pattern_data['location_mentions'] and not final_brief.get('geographic_targeting', {}).get('countries'):
            final_brief['geographic_targeting'] = {
                'countries': pattern_data['location_mentions'][:5],  # Limit to 5
                'states': [],
                'cities': [],
                'radius': None
            }
        
        # Validate and set defaults
        final_brief = self._apply_defaults(final_brief)
        
        return final_brief
    
    def _apply_defaults(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        """Apply sensible defaults to missing fields"""
        defaults = {
            'campaign_name': f"Campaign {datetime.now().strftime('%Y%m%d')}",
            'objective': 'conversions',
            'budget': {'amount': 1000, 'period': 'monthly', 'currency': 'USD'},
            'target_audience': {
                'demographics': {'age_range': '18-65', 'gender': 'all'},
                'interests': [],
                'behaviors': []
            },
            'geographic_targeting': {
                'countries': ['United States'],
                'states': [],
                'cities': [],
                'radius': None
            },
            'timeline': {
                'start_date': 'ASAP',
                'duration': 'ongoing',
                'urgency': 'medium'
            },
            'success_metrics': {
                'primary_kpi': 'conversions',
                'targets': {}
            }
        }
        
        # Deep merge with defaults
        for key, default_value in defaults.items():
            if key not in brief or not brief[key]:
                brief[key] = default_value
            elif isinstance(default_value, dict) and isinstance(brief.get(key), dict):
                for sub_key, sub_default in default_value.items():
                    if sub_key not in brief[key] or not brief[key][sub_key]:
                        brief[key][sub_key] = sub_default
        
        return brief
    
    def _calculate_confidence(self, brief: Dict[str, Any]) -> float:
        """Calculate confidence score for the brief completeness"""
        required_fields = [
            'campaign_name', 'objective', 'budget', 'target_audience',
            'geographic_targeting', 'products_services'
        ]
        
        field_scores = []
        
        for field in required_fields:
            if field in brief and brief[field]:
                if isinstance(brief[field], dict):
                    # Check if dict has meaningful values
                    non_empty_values = sum(1 for v in brief[field].values() if v)
                    score = min(non_empty_values / len(brief[field]), 1.0)
                else:
                    score = 1.0
            else:
                score = 0.0
            
            field_scores.append(score)
        
        return sum(field_scores) / len(field_scores)
    
    def _get_missing_fields(self, brief: Dict[str, Any]) -> List[str]:
        """Identify missing or incomplete fields"""
        missing = []
        
        # Check required fields
        checks = {
            'budget_amount': brief.get('budget', {}).get('amount'),
            'target_audience': brief.get('target_audience', {}).get('demographics'),
            'product_details': brief.get('products_services', {}).get('name'),
            'geographic_targeting': brief.get('geographic_targeting', {}).get('countries'),
            'keywords': brief.get('keywords', {}).get('suggested'),
            'success_metrics': brief.get('success_metrics', {}).get('primary_kpi')
        }
        
        for field, value in checks.items():
            if not value:
                missing.append(field)
        
        return missing
    
    def _get_empty_brief(self) -> Dict[str, Any]:
        """Get empty brief template"""
        return {
            'campaign_name': '',
            'objective': '',
            'budget': {},
            'target_audience': {},
            'geographic_targeting': {},
            'products_services': {},
            'keywords': {'suggested': [], 'negative': []},
            'competitors': [],
            'timeline': {},
            'success_metrics': {},
            'creative_direction': {},
            'additional_requirements': []
        }
    
    async def enhance_brief(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance brief with AI-generated suggestions"""
        prompt = f"""Enhance this campaign brief with professional recommendations:

{json.dumps(brief, indent=2)}

Add or improve:
1. Keyword suggestions (10-20 relevant keywords)
2. Negative keywords (5-10 to exclude)
3. Ad copy themes and messages
4. Bidding strategy recommendation
5. Budget allocation across campaigns/ad groups
6. Expected performance metrics

Return the enhanced brief in the same JSON structure with your additions."""
        
        response = await self.strategist.chat(prompt, "brief_enhancement")
        
        try:
            enhanced = json.loads(response['response'])
            return {
                'success': True,
                'brief': enhanced
            }
        except:
            return {
                'success': True,
                'brief': brief  # Return original if enhancement fails
            }


# Global instance
brief_converter = BriefConverter()