import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

interface BudgetPacingCardProps {
  selectedClient?: GoogleAdsAccount | null;
}

interface BudgetPacingData {
  campaignId: string;
  currentSpend: number;
  dailyBudget: number;
  recommendedBudget: number;
  pacingStatus: 'on_track' | 'overspending' | 'underspending' | 'at_risk' | 'exhausted';
  daysRemaining: number;
  projectedSpend: number;
  confidenceScore: number;
}

export default function BudgetPacingCard({ selectedClient }: BudgetPacingCardProps) {
  const { data: budgetData, isLoading } = useQuery<{ success: boolean; data: BudgetPacingData[] }>({
    queryKey: ['/api/budget-pacing/accounts', selectedClient?.id, 'status'],
    enabled: !!selectedClient,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (!selectedClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Pacing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a client to view budget pacing</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Pacing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const campaigns = budgetData?.data || [];
  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.currentSpend, 0);
  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.dailyBudget * 30), 0); // Approximate monthly
  const spendPercentage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'text-green-600';
      case 'overspending': return 'text-red-600';
      case 'underspending': return 'text-yellow-600';
      case 'at_risk': return 'text-orange-600';
      case 'exhausted': return 'text-red-700';
      default: return 'text-gray-600';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'on_track': return 'default';
      case 'overspending': return 'destructive';
      case 'underspending': return 'secondary';
      case 'at_risk': return 'destructive';
      case 'exhausted': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Budget Pacing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Total Spend</span>
            <span className="text-sm font-semibold">${totalSpend.toLocaleString()}</span>
          </div>
          <Progress value={spendPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>${totalSpend.toLocaleString()} spent</span>
            <span>${totalBudget.toLocaleString()} budget</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Campaign Status</h4>
          {campaigns.slice(0, 3).map((campaign, index) => (
            <div key={campaign.campaignId || index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(campaign.pacingStatus)}>
                  {campaign.pacingStatus.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Campaign {index + 1}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">${campaign.currentSpend.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {campaign.daysRemaining} days left
                </div>
              </div>
            </div>
          ))}
          
          {campaigns.length > 3 && (
            <div className="text-xs text-muted-foreground text-center">
              +{campaigns.length - 3} more campaigns
            </div>
          )}
        </div>

        {campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">No budget data available</p>
        )}
      </CardContent>
    </Card>
  );
}