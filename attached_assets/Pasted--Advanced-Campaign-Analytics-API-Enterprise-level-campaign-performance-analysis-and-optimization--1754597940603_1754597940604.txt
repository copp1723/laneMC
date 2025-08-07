"""
Advanced Campaign Analytics API
Enterprise-level campaign performance analysis and optimization
"""

import logging
import os
import json
import random
import numpy as np
from typing import Dict, List, Any, Optional
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from collections import defaultdict
import math

from src.auth.auth import login_required, get_current_user
from src.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)

campaign_analytics_bp = Blueprint('campaign_analytics', __name__)


class CampaignIntelligenceEngine:
    """Advanced campaign analytics and optimization engine"""
    
    def __init__(self):
        self.industry_benchmarks = {
            'search': {
                'avg_ctr': 3.17,
                'avg_cpc': 2.69,
                'avg_conversion_rate': 3.75,
                'quality_score_benchmark': 7.0
            },
            'display': {
                'avg_ctr': 0.46,
                'avg_cpc': 0.63,
                'avg_conversion_rate': 0.77,
                'quality_score_benchmark': 6.0
            },
            'video': {
                'avg_ctr': 0.84,
                'avg_cpc': 1.85,
                'avg_conversion_rate': 1.84,
                'quality_score_benchmark': 6.5
            }
        }
    
    def analyze_campaign_performance(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive campaign performance analysis"""
        
        performance = campaign_data.get('performance', {})
        channel_type = campaign_data.get('channel_type', 'search').lower()
        
        # Calculate key metrics
        metrics = self._calculate_enhanced_metrics(performance)
        
        # Benchmark against industry standards
        benchmarks = self._benchmark_performance(metrics, channel_type)
        
        # Performance scoring
        performance_score = self._calculate_performance_score(metrics, benchmarks)
        
        # Optimization opportunities
        opportunities = self._identify_optimization_opportunities(metrics, benchmarks, campaign_data)
        
        # Trend analysis
        trend_analysis = self._analyze_performance_trends(campaign_data)
        
        return {
            'campaign_id': campaign_data.get('id'),
            'enhanced_metrics': metrics,
            'industry_benchmarks': benchmarks,
            'performance_score': performance_score,
            'optimization_opportunities': opportunities,
            'trend_analysis': trend_analysis,
            'recommendations': self._generate_recommendations(metrics, opportunities)
        }
    
    def forecast_performance(self, campaign_data: Dict[str, Any], days_ahead: int = 30) -> Dict[str, Any]:
        """Forecast campaign performance using trend analysis"""
        
        performance = campaign_data.get('performance', {})
        budget = campaign_data.get('budget_amount', 0)
        
        # Calculate current daily metrics
        current_daily_cost = performance.get('cost', 0) / 30  # Assume 30 days
        current_daily_clicks = performance.get('clicks', 0) / 30
        current_daily_conversions = performance.get('conversions', 0) / 30
        
        # Apply growth/decline trends (simplified model)
        growth_factor = self._calculate_growth_factor(campaign_data)
        
        # Forecast metrics
        forecast = {
            'forecast_period_days': days_ahead,
            'projected_metrics': {
                'cost': round(current_daily_cost * days_ahead * growth_factor, 2),
                'clicks': round(current_daily_clicks * days_ahead * growth_factor),
                'conversions': round(current_daily_conversions * days_ahead * growth_factor),
                'impressions': round(performance.get('impressions', 0) / 30 * days_ahead * growth_factor)
            },
            'budget_utilization': {
                'projected_spend': round(current_daily_cost * days_ahead * growth_factor, 2),
                'remaining_budget': max(0, budget - (current_daily_cost * days_ahead * growth_factor)),
                'days_until_budget_exhausted': self._calculate_budget_runway(current_daily_cost * growth_factor, budget, performance.get('cost', 0))
            },
            'confidence_level': self._calculate_forecast_confidence(campaign_data),
            'assumptions': [
                f"Growth factor: {growth_factor:.2f}x",
                "Historical trend continuation",
                "No major market changes",
                "Consistent ad spend pattern"
            ]
        }
        
        # Add recommendations based on forecast
        forecast['recommendations'] = self._generate_forecast_recommendations(forecast, campaign_data)
        
        return forecast
    
    def optimize_budget_allocation(self, campaigns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Optimize budget allocation across campaigns"""
        
        total_budget = sum(camp.get('budget_amount', 0) for camp in campaigns)
        
        # Calculate performance efficiency for each campaign
        campaign_efficiency = []
        for campaign in campaigns:
            efficiency = self._calculate_campaign_efficiency(campaign)
            campaign_efficiency.append({
                'campaign_id': campaign.get('id'),
                'campaign_name': campaign.get('name'),
                'current_budget': campaign.get('budget_amount', 0),
                'efficiency_score': efficiency['score'],
                'roas': efficiency['roas'],
                'cost_per_conversion': efficiency['cost_per_conversion'],
                'opportunity_score': efficiency['opportunity_score']
            })
        
        # Sort by efficiency
        campaign_efficiency.sort(key=lambda x: x['efficiency_score'], reverse=True)
        
        # Generate optimal allocation
        optimal_allocation = self._calculate_optimal_allocation(campaign_efficiency, total_budget)
        
        # Calculate impact
        impact_analysis = self._calculate_reallocation_impact(campaign_efficiency, optimal_allocation)
        
        return {
            'current_allocation': {
                'total_budget': total_budget,
                'campaigns': len(campaigns),
                'allocation_efficiency': np.mean([ce['efficiency_score'] for ce in campaign_efficiency])
            },
            'optimal_allocation': optimal_allocation,
            'reallocation_recommendations': self._generate_reallocation_recommendations(campaign_efficiency, optimal_allocation),
            'projected_impact': impact_analysis,
            'implementation_plan': self._create_implementation_plan(optimal_allocation)
        }
    
    def detect_anomalies(self, campaign_data: Dict[str, Any], historical_data: List[Dict] = None) -> Dict[str, Any]:
        """Detect performance anomalies and unusual patterns"""
        
        current_performance = campaign_data.get('performance', {})
        anomalies = []
        
        # Check for unusual CTR
        if 'clicks' in current_performance and 'impressions' in current_performance:
            ctr = (current_performance['clicks'] / current_performance['impressions']) * 100
            channel_type = campaign_data.get('channel_type', 'search').lower()
            expected_ctr = self.industry_benchmarks.get(channel_type, {}).get('avg_ctr', 3.0)
            
            if ctr < expected_ctr * 0.5:
                anomalies.append({
                    'type': 'low_ctr',
                    'severity': 'high',
                    'metric': 'click_through_rate',
                    'current_value': round(ctr, 2),
                    'expected_range': f"{expected_ctr * 0.8:.2f} - {expected_ctr * 1.2:.2f}",
                    'description': 'CTR significantly below industry benchmark',
                    'potential_causes': ['Poor ad copy', 'Irrelevant keywords', 'Low ad position'],
                    'recommended_actions': ['Review and optimize ad copy', 'Refine keyword targeting', 'Increase bids for better positioning']
                })
            elif ctr > expected_ctr * 2:
                anomalies.append({
                    'type': 'high_ctr',
                    'severity': 'medium',
                    'metric': 'click_through_rate',
                    'current_value': round(ctr, 2),
                    'expected_range': f"{expected_ctr * 0.8:.2f} - {expected_ctr * 1.2:.2f}",
                    'description': 'CTR unusually high - monitor for click fraud',
                    'potential_causes': ['Exceptional ad performance', 'Click fraud', 'Seasonal demand spike'],
                    'recommended_actions': ['Monitor for invalid clicks', 'Verify traffic quality', 'Consider scaling successful elements']
                })
        
        # Check for unusual conversion rates
        if 'conversions' in current_performance and 'clicks' in current_performance:
            conversion_rate = (current_performance['conversions'] / current_performance['clicks']) * 100
            channel_type = campaign_data.get('channel_type', 'search').lower()
            expected_cr = self.industry_benchmarks.get(channel_type, {}).get('avg_conversion_rate', 3.0)
            
            if conversion_rate < expected_cr * 0.3:
                anomalies.append({
                    'type': 'low_conversion_rate',
                    'severity': 'high',
                    'metric': 'conversion_rate',
                    'current_value': round(conversion_rate, 2),
                    'expected_range': f"{expected_cr * 0.7:.2f} - {expected_cr * 1.3:.2f}",
                    'description': 'Conversion rate significantly below expectations',
                    'potential_causes': ['Landing page issues', 'Poor traffic quality', 'Misaligned targeting'],
                    'recommended_actions': ['Audit landing pages', 'Review keyword targeting', 'Analyze user journey']
                })
        
        # Check for budget pacing issues
        if 'cost' in current_performance:
            budget = campaign_data.get('budget_amount', 0)
            current_spend_rate = current_performance['cost'] / budget if budget > 0 else 0
            
            if current_spend_rate > 0.9:  # 90% of budget spent
                anomalies.append({
                    'type': 'budget_exhaustion',
                    'severity': 'medium',
                    'metric': 'budget_utilization',
                    'current_value': f"{current_spend_rate * 100:.1f}%",
                    'expected_range': "60% - 85%",
                    'description': 'Campaign approaching budget limit',
                    'potential_causes': ['High competition', 'Aggressive bidding', 'Increased demand'],
                    'recommended_actions': ['Consider budget increase', 'Optimize bidding strategy', 'Pause low-performing keywords']
                })
        
        return {
            'anomalies_detected': len(anomalies),
            'overall_health_status': 'healthy' if len(anomalies) == 0 else 'needs_attention' if len(anomalies) <= 2 else 'critical',
            'anomalies': anomalies,
            'monitoring_recommendations': self._generate_monitoring_recommendations(anomalies)
        }
    
    def generate_ab_test_recommendations(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate A/B test recommendations for campaign optimization"""
        
        performance = campaign_data.get('performance', {})
        channel_type = campaign_data.get('channel_type', 'search').lower()
        
        test_opportunities = []
        
        # CTR optimization tests
        if performance.get('clicks', 0) > 100:  # Sufficient traffic for testing
            test_opportunities.append({
                'test_type': 'ad_copy_optimization',
                'priority': 'high',
                'objective': 'Improve CTR',
                'hypothesis': 'New ad copy variations will increase click-through rate',
                'test_elements': ['Headlines', 'Descriptions', 'Call-to-action'],
                'duration_estimate': '14-21 days',
                'sample_size_needed': max(400, performance.get('impressions', 0) // 10),
                'expected_impact': '10-25% CTR improvement',
                'success_metrics': ['CTR', 'Quality Score', 'Ad Relevance']
            })
        
        # Landing page tests
        if performance.get('conversions', 0) > 10:
            test_opportunities.append({
                'test_type': 'landing_page_optimization',
                'priority': 'high',
                'objective': 'Improve conversion rate',
                'hypothesis': 'Optimized landing page will increase conversion rate',
                'test_elements': ['Headlines', 'Form placement', 'Value proposition', 'CTA buttons'],
                'duration_estimate': '21-30 days',
                'sample_size_needed': max(200, performance.get('clicks', 0) // 5),
                'expected_impact': '15-35% conversion rate improvement',
                'success_metrics': ['Conversion Rate', 'Cost per Conversion', 'ROAS']
            })
        
        # Bidding strategy tests
        test_opportunities.append({
            'test_type': 'bidding_strategy_optimization',
            'priority': 'medium',
            'objective': 'Optimize cost efficiency',
            'hypothesis': 'Alternative bidding strategy will improve cost per conversion',
            'test_elements': ['Manual CPC vs Target CPA', 'Bid adjustments', 'Smart bidding strategies'],
            'duration_estimate': '30-45 days',
            'sample_size_needed': 'Full campaign',
            'expected_impact': '10-20% cost efficiency improvement',
            'success_metrics': ['Cost per Conversion', 'ROAS', 'Volume']
        })
        
        # Audience targeting tests
        if channel_type == 'display':
            test_opportunities.append({
                'test_type': 'audience_targeting_optimization',
                'priority': 'medium',
                'objective': 'Improve targeting precision',
                'hypothesis': 'Refined audience targeting will improve performance',
                'test_elements': ['Demographics', 'Interests', 'Behaviors', 'Custom audiences'],
                'duration_estimate': '21-30 days',
                'sample_size_needed': max(1000, performance.get('impressions', 0) // 20),
                'expected_impact': '20-40% targeting efficiency improvement',
                'success_metrics': ['CTR', 'Conversion Rate', 'Audience Quality']
            })
        
        return {
            'recommended_tests': test_opportunities,
            'testing_strategy': self._create_testing_strategy(test_opportunities),
            'resource_requirements': self._calculate_testing_resources(test_opportunities),
            'implementation_timeline': self._create_testing_timeline(test_opportunities)
        }
    
    def _calculate_enhanced_metrics(self, performance: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate enhanced performance metrics"""
        
        metrics = {}
        
        # Basic metrics
        impressions = performance.get('impressions', 0)
        clicks = performance.get('clicks', 0)
        cost = performance.get('cost', 0)
        conversions = performance.get('conversions', 0)
        
        # Calculate rates
        metrics['ctr'] = (clicks / impressions * 100) if impressions > 0 else 0
        metrics['cpc'] = (cost / clicks) if clicks > 0 else 0
        metrics['conversion_rate'] = (conversions / clicks * 100) if clicks > 0 else 0
        metrics['cost_per_conversion'] = (cost / conversions) if conversions > 0 else 0
        metrics['cost_per_impression'] = (cost / impressions * 1000) if impressions > 0 else 0
        
        # Advanced metrics
        metrics['efficiency_score'] = self._calculate_efficiency_score(performance)
        metrics['quality_score_estimate'] = self._estimate_quality_score(metrics)
        metrics['opportunity_score'] = self._calculate_opportunity_score(metrics)
        
        return {k: round(v, 2) for k, v in metrics.items()}
    
    def _benchmark_performance(self, metrics: Dict[str, Any], channel_type: str) -> Dict[str, Any]:
        """Compare metrics against industry benchmarks"""
        
        benchmarks = self.industry_benchmarks.get(channel_type, self.industry_benchmarks['search'])
        
        comparison = {}
        for metric, value in metrics.items():
            if metric in ['ctr', 'cpc', 'conversion_rate']:
                benchmark_key = f"avg_{metric}"
                if benchmark_key in benchmarks:
                    benchmark_value = benchmarks[benchmark_key]
                    comparison[metric] = {
                        'value': value,
                        'benchmark': benchmark_value,
                        'performance': 'above' if value > benchmark_value else 'below',
                        'percentage_diff': round((value - benchmark_value) / benchmark_value * 100, 1) if benchmark_value > 0 else 0
                    }
        
        return comparison
    
    def _calculate_performance_score(self, metrics: Dict[str, Any], benchmarks: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall performance score"""
        
        scores = []
        
        # CTR score (0-25 points)
        if 'ctr' in benchmarks:
            ctr_ratio = metrics['ctr'] / benchmarks['ctr']['benchmark'] if benchmarks['ctr']['benchmark'] > 0 else 0
            ctr_score = min(25, ctr_ratio * 20)
            scores.append(ctr_score)
        
        # Conversion rate score (0-25 points)
        if 'conversion_rate' in benchmarks:
            cr_ratio = metrics['conversion_rate'] / benchmarks['conversion_rate']['benchmark'] if benchmarks['conversion_rate']['benchmark'] > 0 else 0
            cr_score = min(25, cr_ratio * 20)
            scores.append(cr_score)
        
        # Cost efficiency score (0-25 points)
        if 'cpc' in benchmarks:
            # Lower CPC is better, so inverse the ratio
            cpc_ratio = benchmarks['cpc']['benchmark'] / metrics['cpc'] if metrics['cpc'] > 0 else 0
            cpc_score = min(25, cpc_ratio * 20)
            scores.append(cpc_score)
        
        # Quality score (0-25 points)
        quality_score = metrics.get('quality_score_estimate', 0)
        quality_points = (quality_score / 10) * 25
        scores.append(quality_points)
        
        total_score = sum(scores)
        
        # Grade assignment
        if total_score >= 90:
            grade = 'A+'
        elif total_score >= 80:
            grade = 'A'
        elif total_score >= 70:
            grade = 'B+'
        elif total_score >= 60:
            grade = 'B'
        elif total_score >= 50:
            grade = 'C'
        else:
            grade = 'D'
        
        return {
            'total_score': round(total_score, 1),
            'grade': grade,
            'component_scores': {
                'ctr_score': round(scores[0] if len(scores) > 0 else 0, 1),
                'conversion_score': round(scores[1] if len(scores) > 1 else 0, 1),
                'cost_efficiency_score': round(scores[2] if len(scores) > 2 else 0, 1),
                'quality_score': round(scores[3] if len(scores) > 3 else 0, 1)
            }
        }
    
    def _identify_optimization_opportunities(self, metrics: Dict[str, Any], benchmarks: Dict[str, Any], campaign_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify specific optimization opportunities"""
        
        opportunities = []
        
        # Low CTR opportunity
        if 'ctr' in benchmarks and benchmarks['ctr']['performance'] == 'below':
            opportunities.append({
                'type': 'ctr_optimization',
                'priority': 'high',
                'impact_potential': 'high',
                'description': 'Click-through rate is below industry benchmark',
                'current_value': metrics['ctr'],
                'target_value': benchmarks['ctr']['benchmark'],
                'potential_improvement': abs(benchmarks['ctr']['percentage_diff']),
                'actions': [
                    'Improve ad copy relevance',
                    'Test new headlines and descriptions',
                    'Optimize keyword match types',
                    'Review ad extensions'
                ]
            })
        
        # High CPC opportunity
        if 'cpc' in benchmarks and benchmarks['cpc']['performance'] == 'above':
            opportunities.append({
                'type': 'cost_optimization',
                'priority': 'high',
                'impact_potential': 'medium',
                'description': 'Cost per click is above industry benchmark',
                'current_value': metrics['cpc'],
                'target_value': benchmarks['cpc']['benchmark'],
                'potential_improvement': abs(benchmarks['cpc']['percentage_diff']),
                'actions': [
                    'Optimize bidding strategy',
                    'Improve Quality Score',
                    'Add negative keywords',
                    'Refine targeting'
                ]
            })
        
        # Low conversion rate opportunity
        if 'conversion_rate' in benchmarks and benchmarks['conversion_rate']['performance'] == 'below':
            opportunities.append({
                'type': 'conversion_optimization',
                'priority': 'high',
                'impact_potential': 'high',
                'description': 'Conversion rate is below industry benchmark',
                'current_value': metrics['conversion_rate'],
                'target_value': benchmarks['conversion_rate']['benchmark'],
                'potential_improvement': abs(benchmarks['conversion_rate']['percentage_diff']),
                'actions': [
                    'Optimize landing pages',
                    'Improve call-to-action',
                    'Enhance user experience',
                    'Test different offers'
                ]
            })
        
        return opportunities
    
    def _analyze_performance_trends(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance trends (simplified)"""
        
        # In a real implementation, this would analyze historical data
        # For now, we'll simulate trend analysis
        
        trends = {
            'overall_trend': np.random.choice(['improving', 'stable', 'declining'], p=[0.4, 0.4, 0.2]),
            'ctr_trend': np.random.choice(['up', 'stable', 'down'], p=[0.3, 0.5, 0.2]),
            'cost_trend': np.random.choice(['up', 'stable', 'down'], p=[0.2, 0.5, 0.3]),
            'conversion_trend': np.random.choice(['up', 'stable', 'down'], p=[0.4, 0.4, 0.2]),
            'momentum': np.random.choice(['strong', 'moderate', 'weak'], p=[0.3, 0.5, 0.2])
        }
        
        return trends
    
    def _generate_recommendations(self, metrics: Dict[str, Any], opportunities: List[Dict[str, Any]]) -> List[str]:
        """Generate actionable recommendations"""
        
        recommendations = []
        
        # Priority recommendations based on opportunities
        high_priority_ops = [op for op in opportunities if op['priority'] == 'high']
        
        if high_priority_ops:
            for op in high_priority_ops[:3]:  # Top 3 high priority
                recommendations.append(f"🎯 {op['description']} - Focus on: {op['actions'][0]}")
        
        # General recommendations
        if metrics.get('ctr', 0) < 2:
            recommendations.append("📝 Ad copy needs improvement - Test new headlines and CTAs")
        
        if metrics.get('conversion_rate', 0) < 2:
            recommendations.append("🎯 Landing page optimization recommended - Focus on user experience")
        
        if metrics.get('cost_per_conversion', 0) > 50:
            recommendations.append("💰 Cost per conversion is high - Consider bidding optimization")
        
        return recommendations[:5]  # Limit to top 5 recommendations
    
    def _calculate_growth_factor(self, campaign_data: Dict[str, Any]) -> float:
        """Calculate growth factor for forecasting"""
        # Simplified growth calculation
        return np.random.uniform(0.95, 1.15)  # -5% to +15% growth
    
    def _calculate_budget_runway(self, daily_spend: float, total_budget: float, current_spend: float) -> int:
        """Calculate days until budget is exhausted"""
        if daily_spend <= 0:
            return 999
        
        remaining_budget = total_budget - current_spend
        return max(0, int(remaining_budget / daily_spend))
    
    def _calculate_forecast_confidence(self, campaign_data: Dict[str, Any]) -> float:
        """Calculate confidence level for forecast"""
        # Simplified confidence calculation
        performance = campaign_data.get('performance', {})
        
        # More data = higher confidence
        data_points = sum(1 for v in performance.values() if v > 0)
        base_confidence = min(0.9, data_points / 6)  # Max 90% confidence
        
        return round(base_confidence, 2)
    
    def _generate_forecast_recommendations(self, forecast: Dict[str, Any], campaign_data: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on forecast"""
        
        recommendations = []
        
        budget_util = forecast['budget_utilization']
        
        if budget_util['days_until_budget_exhausted'] < 10:
            recommendations.append("⚠️ Budget will be exhausted soon - Consider increasing budget or optimizing spend")
        
        if budget_util['projected_spend'] < campaign_data.get('budget_amount', 0) * 0.7:
            recommendations.append("📈 Under-spending detected - Consider increasing bids or expanding targeting")
        
        return recommendations
    
    def _calculate_campaign_efficiency(self, campaign: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate campaign efficiency metrics"""
        
        performance = campaign.get('performance', {})
        
        # Calculate ROAS (assuming conversion value)
        conversions = performance.get('conversions', 0)
        cost = performance.get('cost', 0)
        assumed_conversion_value = 50  # Placeholder
        roas = (conversions * assumed_conversion_value / cost) if cost > 0 else 0
        
        # Cost per conversion
        cost_per_conversion = cost / conversions if conversions > 0 else float('inf')
        
        # Efficiency score (0-100)
        efficiency_score = min(100, (roas * 20) + (50 / max(1, cost_per_conversion)) * 10)
        
        # Opportunity score
        opportunity_score = np.random.randint(60, 95)  # Simplified
        
        return {
            'score': round(efficiency_score, 1),
            'roas': round(roas, 2),
            'cost_per_conversion': round(cost_per_conversion, 2),
            'opportunity_score': opportunity_score
        }
    
    def _calculate_optimal_allocation(self, campaign_efficiency: List[Dict[str, Any]], total_budget: float) -> List[Dict[str, Any]]:
        """Calculate optimal budget allocation"""
        
        # Allocate based on efficiency scores
        total_efficiency = sum(ce['efficiency_score'] for ce in campaign_efficiency)
        
        optimal_allocation = []
        for ce in campaign_efficiency:
            optimal_percentage = ce['efficiency_score'] / total_efficiency
            optimal_budget = total_budget * optimal_percentage
            
            optimal_allocation.append({
                'campaign_id': ce['campaign_id'],
                'campaign_name': ce['campaign_name'],
                'current_budget': ce['current_budget'],
                'optimal_budget': round(optimal_budget, 2),
                'budget_change': round(optimal_budget - ce['current_budget'], 2),
                'percentage_change': round((optimal_budget - ce['current_budget']) / ce['current_budget'] * 100, 1) if ce['current_budget'] > 0 else 0
            })
        
        return optimal_allocation
    
    def _calculate_reallocation_impact(self, campaign_efficiency: List[Dict[str, Any]], optimal_allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate impact of budget reallocation"""
        
        # Simplified impact calculation
        current_weighted_efficiency = np.mean([ce['efficiency_score'] for ce in campaign_efficiency])
        
        # Simulate improved efficiency after reallocation
        projected_efficiency = current_weighted_efficiency * 1.15  # 15% improvement
        
        return {
            'current_efficiency': round(current_weighted_efficiency, 1),
            'projected_efficiency': round(projected_efficiency, 1),
            'efficiency_improvement': round(projected_efficiency - current_weighted_efficiency, 1),
            'estimated_performance_lift': '10-20%',
            'estimated_cost_savings': '5-15%'
        }
    
    def _generate_reallocation_recommendations(self, campaign_efficiency: List[Dict[str, Any]], optimal_allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate budget reallocation recommendations"""
        
        recommendations = []
        
        for allocation in optimal_allocation:
            if abs(allocation['percentage_change']) > 10:  # Significant change
                action = 'increase' if allocation['budget_change'] > 0 else 'decrease'
                recommendations.append({
                    'campaign_name': allocation['campaign_name'],
                    'action': action,
                    'amount': abs(allocation['budget_change']),
                    'percentage': abs(allocation['percentage_change']),
                    'reason': f"{'High' if action == 'increase' else 'Low'} efficiency score justifies budget {action}"
                })
        
        return recommendations
    
    def _create_implementation_plan(self, optimal_allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create implementation plan for budget changes"""
        
        plan = []
        
        # Group by action type
        increases = [a for a in optimal_allocation if a['budget_change'] > 0]
        decreases = [a for a in optimal_allocation if a['budget_change'] < 0]
        
        # Phase 1: Implement decreases
        if decreases:
            plan.append({
                'phase': 1,
                'description': 'Reduce budgets for underperforming campaigns',
                'timeline': '1-2 days',
                'actions': [f"Reduce {d['campaign_name']} budget by ${abs(d['budget_change'])}" for d in decreases[:3]]
            })
        
        # Phase 2: Implement increases
        if increases:
            plan.append({
                'phase': 2,
                'description': 'Increase budgets for high-performing campaigns',
                'timeline': '3-5 days',
                'actions': [f"Increase {i['campaign_name']} budget by ${i['budget_change']}" for i in increases[:3]]
            })
        
        # Phase 3: Monitor and adjust
        plan.append({
            'phase': 3,
            'description': 'Monitor performance and fine-tune',
            'timeline': '1-2 weeks',
            'actions': ['Track performance changes', 'Make minor adjustments', 'Document results']
        })
        
        return plan
    
    def _generate_monitoring_recommendations(self, anomalies: List[Dict[str, Any]]) -> List[str]:
        """Generate monitoring recommendations based on anomalies"""
        
        recommendations = []
        
        if any(a['severity'] == 'high' for a in anomalies):
            recommendations.append("🚨 Set up daily performance alerts for critical metrics")
        
        recommendations.extend([
            "📊 Monitor CTR and conversion rate trends weekly",
            "💰 Set up budget pacing alerts at 80% utilization",
            "🎯 Review keyword performance monthly",
            "📈 Conduct A/B tests quarterly"
        ])
        
        return recommendations
    
    def _create_testing_strategy(self, test_opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create comprehensive testing strategy"""
        
        return {
            'testing_approach': 'Sequential testing to avoid interference',
            'priority_order': [t['test_type'] for t in sorted(test_opportunities, key=lambda x: {'high': 3, 'medium': 2, 'low': 1}[x['priority']], reverse=True)],
            'testing_schedule': 'One test per month to ensure statistical significance',
            'success_criteria': 'Minimum 95% confidence level for test results'
        }
    
    def _calculate_testing_resources(self, test_opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate resource requirements for testing"""
        
        return {
            'time_investment': '2-4 hours per test setup',
            'budget_requirements': '20-30% additional budget for test variations',
            'team_involvement': ['Marketing manager', 'Designer', 'Developer'],
            'tools_needed': ['A/B testing platform', 'Analytics tracking', 'Statistical analysis tools']
        }
    
    def _create_testing_timeline(self, test_opportunities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create testing timeline"""
        
        timeline = []
        start_date = datetime.now()
        
        for i, test in enumerate(test_opportunities):
            timeline.append({
                'test_name': test['test_type'],
                'start_date': (start_date + timedelta(days=i*30)).strftime('%Y-%m-%d'),
                'duration': test['duration_estimate'],
                'milestone': f"Test {i+1}: {test['objective']}"
            })
        
        return timeline
    
    def _calculate_efficiency_score(self, performance: Dict[str, Any]) -> float:
        """Calculate efficiency score"""
        # Simplified efficiency calculation
        conversions = performance.get('conversions', 0)
        cost = performance.get('cost', 0)
        clicks = performance.get('clicks', 0)
        
        if cost == 0:
            return 0
        
        conversion_efficiency = (conversions / cost * 1000) if cost > 0 else 0
        click_efficiency = (clicks / cost * 100) if cost > 0 else 0
        
        return min(100, (conversion_efficiency * 2 + click_efficiency) / 3)
    
    def _estimate_quality_score(self, metrics: Dict[str, Any]) -> float:
        """Estimate Quality Score based on performance metrics"""
        # Simplified Quality Score estimation
        ctr = metrics.get('ctr', 0)
        
        if ctr >= 5:
            return 9.0
        elif ctr >= 3:
            return 7.5
        elif ctr >= 2:
            return 6.0
        elif ctr >= 1:
            return 4.5
        else:
            return 3.0
    
    def _calculate_opportunity_score(self, metrics: Dict[str, Any]) -> float:
        """Calculate opportunity score"""
        # Simplified opportunity scoring
        ctr = metrics.get('ctr', 0)
        conversion_rate = metrics.get('conversion_rate', 0)
        cpc = metrics.get('cpc', 0)
        
        # Higher CTR and conversion rate = higher opportunity
        # Lower CPC = higher opportunity
        opportunity = (ctr * 2 + conversion_rate * 3) - (cpc * 0.5)
        
        return max(0, min(100, opportunity * 5))


# Initialize engine
campaign_engine = CampaignIntelligenceEngine()


@campaign_analytics_bp.route('/performance-analysis', methods=['GET', 'POST'])
def analyze_campaign_performance():
    """Comprehensive campaign performance analysis"""
    try:
        data = request.get_json() or {}
        
        # If no data provided, return demo data
        if not data.get('campaign_data'):
            return jsonify({
                "success": True,
                "data": {
                    "summary": {
                        "total_campaigns": random.randint(10, 50),
                        "active_campaigns": random.randint(5, 20),
                        "total_spend": round(random.uniform(5000, 20000), 2),
                        "average_ctr": round(random.uniform(2.5, 5.5), 2),
                        "average_conversion_rate": round(random.uniform(1.5, 4.5), 2)
                    },
                    "top_performers": [
                        {
                            "campaign_name": f"Campaign {i}",
                            "impressions": random.randint(10000, 100000),
                            "clicks": random.randint(500, 5000),
                            "conversions": random.randint(50, 500),
                            "spend": round(random.uniform(500, 5000), 2),
                            "roas": round(random.uniform(2.0, 8.0), 2)
                        }
                        for i in range(5)
                    ],
                    "recommendations": [
                        "Increase budget for Campaign 1 - showing strong ROAS",
                        "Pause Campaign 8 - CTR below threshold",
                        "Add negative keywords to Campaign 3"
                    ]
                }
            })
        
        campaign_data = data['campaign_data']
        analysis = campaign_engine.analyze_campaign_performance(campaign_data)
        
        return success_response(
            data=analysis,
            message="Campaign performance analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Error in performance analysis: {str(e)}")
        return error_response('Performance analysis failed', 500)


@campaign_analytics_bp.route('/forecast', methods=['POST'])
@login_required
def forecast_performance():
    """Forecast campaign performance"""
    try:
        data = request.get_json()
        
        if not data or not data.get('campaign_data'):
            return error_response('Campaign data is required', 400)
        
        campaign_data = data['campaign_data']
        days_ahead = data.get('days_ahead', 30)
        
        forecast = campaign_engine.forecast_performance(campaign_data, days_ahead)
        
        return success_response(
            data=forecast,
            message=f"Performance forecast generated for {days_ahead} days"
        )
        
    except Exception as e:
        logger.error(f"Error in performance forecasting: {str(e)}")
        return error_response('Performance forecasting failed', 500)


@campaign_analytics_bp.route('/budget-optimization', methods=['POST'])
@login_required
def optimize_budget_allocation():
    """Optimize budget allocation across campaigns"""
    try:
        data = request.get_json()
        
        if not data or not data.get('campaigns'):
            return error_response('Campaigns data is required', 400)
        
        campaigns = data['campaigns']
        optimization = campaign_engine.optimize_budget_allocation(campaigns)
        
        return success_response(
            data=optimization,
            message="Budget optimization analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Error in budget optimization: {str(e)}")
        return error_response('Budget optimization failed', 500)


@campaign_analytics_bp.route('/anomaly-detection', methods=['POST'])
@login_required
def detect_anomalies():
    """Detect performance anomalies"""
    try:
        data = request.get_json()
        
        if not data or not data.get('campaign_data'):
            return error_response('Campaign data is required', 400)
        
        campaign_data = data['campaign_data']
        historical_data = data.get('historical_data', [])
        
        anomalies = campaign_engine.detect_anomalies(campaign_data, historical_data)
        
        return success_response(
            data=anomalies,
            message="Anomaly detection completed"
        )
        
    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}")
        return error_response('Anomaly detection failed', 500)


@campaign_analytics_bp.route('/ab-test-recommendations', methods=['POST'])
@login_required
def generate_ab_test_recommendations():
    """Generate A/B test recommendations"""
    try:
        data = request.get_json()
        
        if not data or not data.get('campaign_data'):
            return error_response('Campaign data is required', 400)
        
        campaign_data = data['campaign_data']
        recommendations = campaign_engine.generate_ab_test_recommendations(campaign_data)
        
        return success_response(
            data=recommendations,
            message="A/B test recommendations generated"
        )
        
    except Exception as e:
        logger.error(f"Error generating A/B test recommendations: {str(e)}")
        return error_response('A/B test recommendation generation failed', 500)


@campaign_analytics_bp.route('/comprehensive-analysis', methods=['POST'])
@login_required
def comprehensive_campaign_analysis():
    """Perform comprehensive campaign analysis"""
    try:
        data = request.get_json()
        
        if not data or not data.get('campaigns'):
            return error_response('Campaigns data is required', 400)
        
        campaigns = data['campaigns']
        include_forecast = data.get('include_forecast', True)
        include_budget_optimization = data.get('include_budget_optimization', True)
        
        results = {}
        
        # Analyze each campaign
        campaign_analyses = []
        for campaign in campaigns:
            analysis = campaign_engine.analyze_campaign_performance(campaign)
            
            # Add forecast if requested
            if include_forecast:
                analysis['forecast'] = campaign_engine.forecast_performance(campaign)
            
            # Add anomaly detection
            analysis['anomalies'] = campaign_engine.detect_anomalies(campaign)
            
            # Add A/B test recommendations
            analysis['ab_test_recommendations'] = campaign_engine.generate_ab_test_recommendations(campaign)
            
            campaign_analyses.append(analysis)
        
        results['campaign_analyses'] = campaign_analyses
        
        # Portfolio-level budget optimization
        if include_budget_optimization and len(campaigns) > 1:
            results['budget_optimization'] = campaign_engine.optimize_budget_allocation(campaigns)
        
        # Portfolio summary
        results['portfolio_summary'] = {
            'total_campaigns': len(campaigns),
            'campaigns_needing_attention': len([c for c in campaign_analyses if c.get('anomalies', {}).get('overall_health_status') != 'healthy']),
            'average_performance_score': np.mean([c['performance_score']['total_score'] for c in campaign_analyses]),
            'total_optimization_opportunities': sum(len(c['optimization_opportunities']) for c in campaign_analyses)
        }
        
        return success_response(
            data=results,
            message="Comprehensive campaign analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Error in comprehensive analysis: {str(e)}")
        return error_response('Comprehensive analysis failed', 500)