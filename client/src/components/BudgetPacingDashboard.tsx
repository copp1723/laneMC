import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Calendar,
  BarChart3
} from 'lucide-react';

interface BudgetPacingData {
  currentSpend: number;
  dailyBudget: number;
  recommendedBudget: number;
  pacingStatus: 'ON_TRACK' | 'OVERSPENDING' | 'UNDERSPENDING' | 'AT_RISK' | 'EXHAUSTED';
  daysRemaining: number;
  projectedSpend: number;
  adjustmentFactor: number;
  confidenceScore: number;
}

interface PacingDashboardProps {
  accountId: string;
  campaignId?: string;
}

export function BudgetPacingDashboard({ accountId, campaignId }: PacingDashboardProps) {
  const { data: pacingData, isLoading, error } = useQuery({
    queryKey: ['/api/budget-pacing', accountId, campaignId],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Intelligent Budget Pacing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !pacingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget Pacing Error</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load budget pacing data. Please check your Google Ads connection.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const budgetData = Array.isArray(pacingData) ? pacingData[0] : pacingData;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'AT_RISK':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'OVERSPENDING':
      case 'EXHAUSTED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'UNDERSPENDING':
        return <TrendingDown className="h-5 w-5 text-blue-500" />;
      default:
        return <Target className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'AT_RISK':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'OVERSPENDING':
      case 'EXHAUSTED':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'UNDERSPENDING':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const spendPercentage = (budgetData.currentSpend / (budgetData.projectedSpend || budgetData.currentSpend)) * 100;
  const recommendationChange = ((budgetData.recommendedBudget - budgetData.dailyBudget) / budgetData.dailyBudget) * 100;

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Intelligent Budget Pacing
            </CardTitle>
            <Badge className={getStatusColor(budgetData.pacingStatus)}>
              {getStatusIcon(budgetData.pacingStatus)}
              {budgetData.pacingStatus.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Current Spend */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign className="h-4 w-4" />
                Current Spend
              </div>
              <div className="text-2xl font-bold">${budgetData.currentSpend.toFixed(2)}</div>
              <Progress value={spendPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {spendPercentage.toFixed(1)}% of projected spend
              </div>
            </div>

            {/* Days Remaining */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                Days Remaining
              </div>
              <div className="text-2xl font-bold">{budgetData.daysRemaining}</div>
              <div className="text-xs text-gray-500">
                Until month end
              </div>
            </div>

            {/* Projected Spend */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Target className="h-4 w-4" />
                Projected Spend
              </div>
              <div className="text-2xl font-bold">${budgetData.projectedSpend.toFixed(2)}</div>
              <div className="text-xs text-gray-500">
                At current pace
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Recommendation Card */}
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <div className="font-semibold">Recommended Daily Budget</div>
              <div className="text-2xl font-bold text-blue-600">
                ${budgetData.recommendedBudget.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                {recommendationChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {Math.abs(recommendationChange).toFixed(1)}% vs current budget
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-gray-600">Confidence Score</div>
              <div className="text-xl font-bold">
                {(budgetData.confidenceScore * 100).toFixed(0)}%
              </div>
              <Progress value={budgetData.confidenceScore * 100} className="h-2 w-20" />
            </div>
          </div>
          
          {budgetData.pacingStatus !== 'ON_TRACK' && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {budgetData.pacingStatus === 'OVERSPENDING' && 
                  "Campaign is spending faster than planned. Consider reducing bids or pausing low-performing keywords."
                }
                {budgetData.pacingStatus === 'UNDERSPENDING' && 
                  "Campaign is under-spending. Consider increasing bids or expanding keyword targeting."
                }
                {budgetData.pacingStatus === 'AT_RISK' && 
                  "Campaign may exceed budget at current pace. Monitor closely and consider adjustments."
                }
                {budgetData.pacingStatus === 'EXHAUSTED' && 
                  "Campaign budget has been exhausted. Consider increasing budget or optimizing for efficiency."
                }
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Center */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Refresh Data
            </Button>
            <Button 
              variant="outline"
              disabled={budgetData.pacingStatus === 'ON_TRACK'}
            >
              Apply Recommendation
            </Button>
            <Button variant="outline">
              View Campaign Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}