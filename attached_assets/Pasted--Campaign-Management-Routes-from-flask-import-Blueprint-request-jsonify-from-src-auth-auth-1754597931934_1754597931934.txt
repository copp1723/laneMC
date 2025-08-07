"""
Campaign Management Routes
"""

from flask import Blueprint, request, jsonify
from src.auth.authentication import token_required
from src.models.campaign import Campaign
from src.services.campaign_orchestrator import CampaignOrchestrator
from src.services.real_google_ads import real_google_ads_service
from src.config.database import db
import logging

logger = logging.getLogger(__name__)

# Create blueprint
campaigns_bp = Blueprint('campaigns', __name__)

# Initialize campaign orchestrator
campaign_orchestrator = CampaignOrchestrator(real_google_ads_service)


@campaigns_bp.route('/', methods=['GET'])
@token_required
def list_campaigns():
    """List all campaigns for the user"""
    try:
        campaigns = Campaign.query.all()
        
        return jsonify({
            'success': True,
            'campaigns': [campaign.to_dict() for campaign in campaigns]
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing campaigns: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to list campaigns'
        }), 500


@campaigns_bp.route('/<campaign_id>', methods=['GET'])
@token_required
def get_campaign(campaign_id):
    """Get specific campaign details"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        return jsonify({
            'success': True,
            'campaign': campaign.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting campaign: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get campaign'
        }), 500


@campaigns_bp.route('/brief', methods=['POST'])
@token_required
def create_campaign_from_brief():
    """Create campaign from AI-generated brief"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['business_type', 'target_audience', 'budget', 'goals']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Use campaign orchestrator to create campaign
        campaign = campaign_orchestrator.create_campaign_from_brief(data)
        
        return jsonify({
            'success': True,
            'campaign': campaign,
            'message': 'Campaign created successfully from brief'
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating campaign from brief: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create campaign from brief'
        }), 500


@campaigns_bp.route('/', methods=['POST'])
@token_required
def create_campaign():
    """Create a new campaign manually"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'customer_id', 'budget']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Create campaign
        campaign = Campaign(
            name=data['name'],
            customer_id=data['customer_id'],
            budget=data['budget'],
            description=data.get('description', ''),
            target_audience=data.get('target_audience', ''),
            keywords=data.get('keywords', []),
            ad_groups=data.get('ad_groups', [])
        )
        
        db.session.add(campaign)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'campaign': campaign.to_dict(),
            'message': 'Campaign created successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating campaign: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to create campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>', methods=['PUT'])
@token_required
def update_campaign(campaign_id):
    """Update campaign details"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        data = request.get_json()
        
        # Update allowed fields
        allowed_fields = ['name', 'description', 'budget', 'target_audience', 'keywords', 'ad_groups']
        for field in allowed_fields:
            if field in data:
                setattr(campaign, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'campaign': campaign.to_dict(),
            'message': 'Campaign updated successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating campaign: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to update campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>/launch', methods=['POST'])
@token_required
def launch_campaign(campaign_id):
    """Launch a campaign to Google Ads"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        # Use campaign orchestrator to launch
        result = campaign_orchestrator.launch_campaign(campaign_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Campaign launched successfully',
                'google_ads_campaign_id': result.get('google_ads_campaign_id')
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to launch campaign')
            }), 500
        
    except Exception as e:
        logger.error(f"Error launching campaign: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to launch campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>/pause', methods=['POST'])
@token_required
def pause_campaign(campaign_id):
    """Pause a campaign"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        # Use campaign orchestrator to pause
        result = campaign_orchestrator.pause_campaign(campaign_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Campaign paused successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to pause campaign')
            }), 500
        
    except Exception as e:
        logger.error(f"Error pausing campaign: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to pause campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>/resume', methods=['POST'])
@token_required
def resume_campaign(campaign_id):
    """Resume a paused campaign"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        # Use campaign orchestrator to resume
        result = campaign_orchestrator.resume_campaign(campaign_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Campaign resumed successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to resume campaign')
            }), 500
        
    except Exception as e:
        logger.error(f"Error resuming campaign: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to resume campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>', methods=['DELETE'])
@token_required
def delete_campaign(campaign_id):
    """Delete a campaign"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        # Soft delete by updating status
        campaign.status = 'deleted'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Campaign deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting campaign: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to delete campaign'
        }), 500


@campaigns_bp.route('/<campaign_id>/analytics', methods=['GET'])
@token_required
def get_campaign_analytics(campaign_id):
    """Get analytics for a specific campaign"""
    try:
        campaign = Campaign.query.get(campaign_id)
        
        if not campaign:
            return jsonify({
                'success': False,
                'error': 'Campaign not found'
            }), 404
        
        # Get analytics from campaign orchestrator
        analytics = campaign_orchestrator.get_campaign_analytics(campaign_id)
        
        return jsonify({
            'success': True,
            'analytics': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting campaign analytics: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get campaign analytics'
        }), 500