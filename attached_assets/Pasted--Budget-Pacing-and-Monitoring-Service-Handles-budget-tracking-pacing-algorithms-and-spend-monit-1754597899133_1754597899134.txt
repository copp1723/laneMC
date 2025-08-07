"""
Budget Pacing and Monitoring Service
Handles budget tracking, pacing algorithms, and spend monitoring for Google Ads campaigns
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass, field
import json
from sqlalchemy import func
from src.config.database import db
from src.models.campaign import Campaign

logger = logging.getLogger(__name__)


class BudgetStatus(Enum):
    """Budget health status"""
    ON_TRACK = "on_track"
    UNDERSPENDING = "underspending"
    OVERSPENDING = "overspending"
    AT_RISK = "at_risk"
    EXHAUSTED = "exhausted"


class PacingStrategy(Enum):
    """Budget pacing strategies"""
    LINEAR = "linear"
    ACCELERATED = "accelerated"
    CONSERVATIVE = "conservative"
    ADAPTIVE = "adaptive"


@dataclass
class BudgetAlert:
    """Budget alert notification"""
    id: str
    campaign_id: str
    alert_type: str
    severity: str  # low, medium, high, critical
    message: str
    current_spend: float
    budget_limit: float
    projected_spend: float
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PacingResult:
    """Budget pacing calculation result"""
    current_spend: float
    daily_budget: float
    recommended_budget: float
    pacing_status: BudgetStatus
    days_remaining: int
    projected_spend: float
    adjustment_factor: float
    confidence_score: float


class BudgetPacingService:
    """Service for budget pacing and monitoring"""
    
    def __init__(self):
        self.monitoring_interval = 7200  # 2 hours in seconds
        self.monitoring_task = None
        self.alert_callbacks = []
        self.pacing_history = {}
        
        # Pacing thresholds
        self.thresholds = {
            'overspend_warning': 0.95,  # 95% of budget
            'overspend_critical': 1.0,   # 100% of budget
            'underspend_warning': 0.70,  # 70% of expected spend
            'at_risk_threshold': 0.90,   # 90% of budget with time remaining
        }
        
        # ML model parameters (simplified for now)
        self.ml_params = {
            'seasonality_weight': 0.2,
            'trend_weight': 0.3,
            'volatility_weight': 0.2,
            'historical_weight': 0.3
        }
    
    async def start_monitoring(self):
        """Start the budget monitoring service"""
        if self.monitoring_task:
            return
        
        logger.info("Starting budget pacing monitoring service")
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
    
    async def stop_monitoring(self):
        """Stop the budget monitoring service"""
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
            self.monitoring_task = None
        
        logger.info("Budget pacing monitoring service stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop that runs every 2 hours"""
        while True:
            try:
                await self._check_all_budgets()
                await asyncio.sleep(self.monitoring_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in budget monitoring loop: {str(e)}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    async def _check_all_budgets(self):
        """Check all active campaign budgets"""
        try:
            # Get all active campaigns
            active_campaigns = Campaign.query.filter_by(
                status='active'
            ).all()
            
            for campaign in active_campaigns:
                await self.check_campaign_budget(campaign.id)
            
            logger.info(f"Checked budgets for {len(active_campaigns)} active campaigns")
            
        except Exception as e:
            logger.error(f"Error checking campaign budgets: {str(e)}")
    
    async def check_campaign_budget(self, campaign_id: str) -> PacingResult:
        """Check and analyze budget for a specific campaign"""
        try:
            campaign = Campaign.query.get(campaign_id)
            if not campaign:
                raise ValueError(f"Campaign {campaign_id} not found")
            
            # Calculate current metrics
            current_spend = await self._get_current_spend(campaign_id)
            days_remaining = self._calculate_days_remaining(campaign)
            daily_budget = campaign.budget_amount / 30  # Monthly to daily
            
            # Calculate pacing
            pacing_result = self._calculate_pacing(
                current_spend=current_spend,
                total_budget=campaign.budget_amount,
                days_elapsed=30 - days_remaining,
                days_remaining=days_remaining,
                strategy=PacingStrategy(campaign.pacing_strategy or 'linear')
            )
            
            # Check for alerts
            alerts = self._check_budget_alerts(campaign, pacing_result)
            
            # Process alerts
            for alert in alerts:
                await self._process_alert(alert)
            
            # Update campaign pacing info
            campaign.last_pacing_check = datetime.utcnow()
            campaign.pacing_status = pacing_result.pacing_status.value
            campaign.projected_spend = pacing_result.projected_spend
            db.session.commit()
            
            # Store in history
            self._update_pacing_history(campaign_id, pacing_result)
            
            return pacing_result
            
        except Exception as e:
            logger.error(f"Error checking budget for campaign {campaign_id}: {str(e)}")
            raise
    
    def _calculate_pacing(self, current_spend: float, total_budget: float,
                         days_elapsed: int, days_remaining: int,
                         strategy: PacingStrategy) -> PacingResult:
        """Calculate budget pacing based on strategy"""
        if days_elapsed == 0:
            days_elapsed = 1
        
        total_days = days_elapsed + days_remaining
        expected_spend_ratio = days_elapsed / total_days
        actual_spend_ratio = current_spend / total_budget if total_budget > 0 else 0
        
        # Calculate daily budget based on strategy
        if strategy == PacingStrategy.LINEAR:
            daily_budget = total_budget / total_days
            recommended_budget = (total_budget - current_spend) / max(days_remaining, 1)
        
        elif strategy == PacingStrategy.ACCELERATED:
            # Front-load spending
            daily_budget = total_budget / total_days * 1.2
            recommended_budget = (total_budget - current_spend) / max(days_remaining, 1) * 0.8
        
        elif strategy == PacingStrategy.CONSERVATIVE:
            # Back-load spending
            daily_budget = total_budget / total_days * 0.8
            recommended_budget = (total_budget - current_spend) / max(days_remaining, 1) * 1.2
        
        else:  # ADAPTIVE
            # Use ML-based adjustment
            adjustment = self._calculate_ml_adjustment(
                current_spend, total_budget, days_elapsed, days_remaining
            )
            daily_budget = total_budget / total_days
            recommended_budget = daily_budget * adjustment
        
        # Calculate projected spend
        projected_spend = current_spend + (recommended_budget * days_remaining)
        
        # Determine pacing status
        status = self._determine_pacing_status(
            actual_spend_ratio, expected_spend_ratio, projected_spend, total_budget
        )
        
        # Calculate confidence score
        confidence = self._calculate_confidence_score(
            days_elapsed, total_days, current_spend, total_budget
        )
        
        return PacingResult(
            current_spend=current_spend,
            daily_budget=daily_budget,
            recommended_budget=recommended_budget,
            pacing_status=status,
            days_remaining=days_remaining,
            projected_spend=projected_spend,
            adjustment_factor=recommended_budget / daily_budget if daily_budget > 0 else 1.0,
            confidence_score=confidence
        )
    
    def _calculate_ml_adjustment(self, current_spend: float, total_budget: float,
                                days_elapsed: int, days_remaining: int) -> float:
        """Calculate ML-based budget adjustment factor"""
        # Simplified ML adjustment - in production, this would use actual ML models
        
        # Base adjustment on spend velocity
        if days_elapsed > 0:
            daily_velocity = current_spend / days_elapsed
            expected_daily = total_budget / (days_elapsed + days_remaining)
            velocity_factor = expected_daily / daily_velocity if daily_velocity > 0 else 1.0
        else:
            velocity_factor = 1.0
        
        # Seasonality adjustment (simplified)
        day_of_week = datetime.utcnow().weekday()
        seasonality_factor = 1.0
        if day_of_week in [5, 6]:  # Weekend
            seasonality_factor = 0.8
        elif day_of_week in [1, 2, 3]:  # Mid-week
            seasonality_factor = 1.1
        
        # Combine factors
        adjustment = (
            velocity_factor * (1 - self.ml_params['seasonality_weight']) +
            seasonality_factor * self.ml_params['seasonality_weight']
        )
        
        # Clamp adjustment to reasonable range
        return max(0.5, min(2.0, adjustment))
    
    def _determine_pacing_status(self, actual_ratio: float, expected_ratio: float,
                               projected_spend: float, total_budget: float) -> BudgetStatus:
        """Determine the budget pacing status"""
        if actual_ratio >= 1.0:
            return BudgetStatus.EXHAUSTED
        
        if projected_spend > total_budget * self.thresholds['overspend_critical']:
            return BudgetStatus.OVERSPENDING
        
        if projected_spend > total_budget * self.thresholds['overspend_warning']:
            return BudgetStatus.AT_RISK
        
        if actual_ratio < expected_ratio * self.thresholds['underspend_warning']:
            return BudgetStatus.UNDERSPENDING
        
        return BudgetStatus.ON_TRACK
    
    def _calculate_confidence_score(self, days_elapsed: int, total_days: int,
                                  current_spend: float, total_budget: float) -> float:
        """Calculate confidence score for pacing prediction"""
        # More data = higher confidence
        data_confidence = min(days_elapsed / 7, 1.0)  # Full confidence after 7 days
        
        # Consistent spending = higher confidence
        if days_elapsed > 0:
            daily_avg = current_spend / days_elapsed
            expected_daily = total_budget / total_days
            consistency = 1.0 - abs(daily_avg - expected_daily) / expected_daily
            consistency = max(0, min(1, consistency))
        else:
            consistency = 0.5
        
        # Combine factors
        return (data_confidence * 0.7 + consistency * 0.3)
    
    def _check_budget_alerts(self, campaign, pacing_result: PacingResult) -> List[BudgetAlert]:
        """Check for budget alerts that need to be raised"""
        alerts = []
        
        # Overspend alerts
        if pacing_result.pacing_status == BudgetStatus.EXHAUSTED:
            alerts.append(BudgetAlert(
                id=f"{campaign.id}_exhausted_{datetime.utcnow().isoformat()}",
                campaign_id=campaign.id,
                alert_type="budget_exhausted",
                severity="critical",
                message=f"Campaign '{campaign.name}' has exhausted its budget",
                current_spend=pacing_result.current_spend,
                budget_limit=campaign.budget_amount,
                projected_spend=pacing_result.projected_spend,
                recommended_action="Pause campaign or increase budget immediately"
            ))
        
        elif pacing_result.pacing_status == BudgetStatus.OVERSPENDING:
            alerts.append(BudgetAlert(
                id=f"{campaign.id}_overspend_{datetime.utcnow().isoformat()}",
                campaign_id=campaign.id,
                alert_type="overspending",
                severity="high",
                message=f"Campaign '{campaign.name}' is overspending",
                current_spend=pacing_result.current_spend,
                budget_limit=campaign.budget_amount,
                projected_spend=pacing_result.projected_spend,
                recommended_action=f"Reduce daily budget to ${pacing_result.recommended_budget:.2f}"
            ))
        
        # Underspend alerts
        elif pacing_result.pacing_status == BudgetStatus.UNDERSPENDING:
            alerts.append(BudgetAlert(
                id=f"{campaign.id}_underspend_{datetime.utcnow().isoformat()}",
                campaign_id=campaign.id,
                alert_type="underspending",
                severity="medium",
                message=f"Campaign '{campaign.name}' is underspending",
                current_spend=pacing_result.current_spend,
                budget_limit=campaign.budget_amount,
                projected_spend=pacing_result.projected_spend,
                recommended_action=f"Increase daily budget to ${pacing_result.recommended_budget:.2f} or adjust targeting"
            ))
        
        # At risk alerts
        elif pacing_result.pacing_status == BudgetStatus.AT_RISK:
            alerts.append(BudgetAlert(
                id=f"{campaign.id}_atrisk_{datetime.utcnow().isoformat()}",
                campaign_id=campaign.id,
                alert_type="at_risk",
                severity="medium",
                message=f"Campaign '{campaign.name}' is at risk of overspending",
                current_spend=pacing_result.current_spend,
                budget_limit=campaign.budget_amount,
                projected_spend=pacing_result.projected_spend,
                recommended_action="Monitor closely and consider budget adjustment"
            ))
        
        return alerts
    
    async def _process_alert(self, alert: BudgetAlert):
        """Process a budget alert"""
        # Log the alert
        logger.warning(f"Budget Alert: {alert.alert_type} - {alert.message}")
        
        # Store alert in database
        from src.models.budget_alert import BudgetAlertModel
        
        db_alert = BudgetAlertModel(
            campaign_id=alert.campaign_id,
            alert_type=alert.alert_type,
            severity=alert.severity,
            message=alert.message,
            current_spend=alert.current_spend,
            budget_limit=alert.budget_limit,
            projected_spend=alert.projected_spend,
            recommended_action=alert.recommended_action
        )
        db.session.add(db_alert)
        db.session.commit()
        
        # Notify callbacks
        for callback in self.alert_callbacks:
            try:
                await callback(alert)
            except Exception as e:
                logger.error(f"Error in alert callback: {str(e)}")
    
    def register_alert_callback(self, callback):
        """Register a callback for budget alerts"""
        self.alert_callbacks.append(callback)
    
    async def _get_current_spend(self, campaign_id: str) -> float:
        """Get current spend for a campaign"""
        # In production, this would fetch from Google Ads API
        # For now, return mock data
        campaign = Campaign.query.get(campaign_id)
        return campaign.current_spend if campaign and campaign.current_spend else 0.0
    
    def _calculate_days_remaining(self, campaign) -> int:
        """Calculate days remaining in the billing period"""
        if campaign.billing_period_end:
            remaining = (campaign.billing_period_end - datetime.utcnow()).days
            return max(0, remaining)
        return 30  # Default to 30 days
    
    def _update_pacing_history(self, campaign_id: str, result: PacingResult):
        """Update pacing history for trend analysis"""
        if campaign_id not in self.pacing_history:
            self.pacing_history[campaign_id] = []
        
        self.pacing_history[campaign_id].append({
            'timestamp': datetime.utcnow().isoformat(),
            'spend': result.current_spend,
            'status': result.pacing_status.value,
            'projected': result.projected_spend,
            'confidence': result.confidence_score
        })
        
        # Keep only last 30 days of history
        cutoff = datetime.utcnow() - timedelta(days=30)
        self.pacing_history[campaign_id] = [
            h for h in self.pacing_history[campaign_id]
            if datetime.fromisoformat(h['timestamp']) > cutoff
        ]
    
    async def get_pacing_recommendations(self, campaign_id: str) -> Dict[str, Any]:
        """Get detailed pacing recommendations for a campaign"""
        pacing_result = await self.check_campaign_budget(campaign_id)
        
        recommendations = {
            'status': pacing_result.pacing_status.value,
            'current_daily_budget': pacing_result.daily_budget,
            'recommended_daily_budget': pacing_result.recommended_budget,
            'adjustment_percentage': (pacing_result.adjustment_factor - 1) * 100,
            'confidence_score': pacing_result.confidence_score,
            'actions': []
        }
        
        # Generate specific recommendations
        if pacing_result.pacing_status == BudgetStatus.OVERSPENDING:
            recommendations['actions'].extend([
                {
                    'type': 'budget_adjustment',
                    'priority': 'high',
                    'description': f'Reduce daily budget to ${pacing_result.recommended_budget:.2f}',
                    'impact': 'Prevents budget exhaustion'
                },
                {
                    'type': 'bid_adjustment',
                    'priority': 'medium',
                    'description': 'Reduce bid adjustments by 10-15%',
                    'impact': 'Slower spend rate'
                }
            ])
        
        elif pacing_result.pacing_status == BudgetStatus.UNDERSPENDING:
            recommendations['actions'].extend([
                {
                    'type': 'budget_adjustment',
                    'priority': 'medium',
                    'description': f'Increase daily budget to ${pacing_result.recommended_budget:.2f}',
                    'impact': 'Better budget utilization'
                },
                {
                    'type': 'targeting_expansion',
                    'priority': 'medium',
                    'description': 'Expand targeting to increase reach',
                    'impact': 'Higher impression volume'
                }
            ])
        
        return recommendations


# Global instance
budget_pacing_service = BudgetPacingService()