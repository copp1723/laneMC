import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, X } from 'lucide-react';


interface CampaignApprovalModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function CampaignApprovalModal({
  isOpen = false,
  onClose = () => {},
  onApprove = () => {},
  onReject = () => {},
}: CampaignApprovalModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Mock campaign data - in real app this would come from props or API
  const campaignData = {
    title: 'Q1 SaaS Tool Launch Campaign',
    description: 'AI-generated campaign structure based on your requirements',
    campaigns: [
      {
        name: 'Search Campaign - SaaS Tool Keywords',
        type: 'Search',
        budget: 8000,
        details: '45 keywords • 3 ad groups',
        status: 'recommended' as const,
      },
      {
        name: 'Display Campaign - Retargeting',
        type: 'Display', 
        budget: 4000,
        details: '5 audiences • 8 creatives',
        status: 'recommended' as const,
      },
      {
        name: 'YouTube Campaign - Product Demo',
        type: 'Video',
        budget: 3000,
        details: 'Video targeting • Demo content',
        status: 'recommended' as const,
      },
    ],
  };

  const totalBudget = campaignData.campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      onApprove();
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      onReject();
      onClose();
    } finally {
      setIsRejecting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Campaign Approval Required
              </DialogTitle>
              <DialogDescription className="mt-2">
                Review the AI-generated campaign structure before launching
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Overview */}
          <div>
            <h4 className="text-lg font-medium text-slate-900 mb-2">
              {campaignData.title}
            </h4>
            <p className="text-slate-600 mb-4">{campaignData.description}</p>
            
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Total Monthly Budget</p>
                <p className="text-sm text-slate-600">
                  {campaignData.campaigns.length} campaigns recommended
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(totalBudget)}
                </p>
                <p className="text-xs text-slate-500">per month</p>
              </div>
            </div>
          </div>

          {/* Campaign Structure */}
          <div>
            <h5 className="font-medium text-slate-900 mb-4">Campaign Structure</h5>
            <div className="space-y-3">
              {campaignData.campaigns.map((campaign, index) => (
                <Card key={index} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h6 className="font-medium text-slate-900">
                            {campaign.name}
                          </h6>
                          <Badge variant="outline" className="text-xs">
                            {campaign.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          Budget: {formatCurrency(campaign.budget)}/month • {campaign.details}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={campaign.status === 'recommended' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {campaign.status === 'recommended' && (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {campaign.status === 'recommended' ? 'Recommended' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Key Features */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <h6 className="font-medium text-slate-900 mb-3">What this campaign includes:</h6>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                Comprehensive keyword research and targeting
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                Optimized ad copy and creative assets
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                Strategic budget allocation across campaign types
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                Advanced targeting and audience segmentation
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                Automated bid management and optimization
              </li>
            </ul>
          </div>

          {/* Warning */}
          <div className="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Review before approval
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Once approved, campaigns will be created in your Google Ads account and begin spending budget immediately.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? 'Processing...' : 'Request Changes'}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="bg-primary hover:bg-primary/90"
          >
            {isApproving ? 'Creating Campaigns...' : 'Approve & Launch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
