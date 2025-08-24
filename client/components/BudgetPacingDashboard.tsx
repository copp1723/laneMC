import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, 
  XCircle, DollarSign, Calendar, BarChart3, HelpCircle, Zap,
  PiggyBank, Clock, ArrowUp, ArrowDown
} from 'lucide-react';

// --- Enhanced Type Definitions ---
interface PacingData {
  campaignId: string;
  campaignName: string;
  currentSpend: number;
  budgetTarget: number;
  recommendedDailyBudget: number;
  pacingStatus: 'ON_TRACK' | 'OVERSPENDING' | 'UNDERSPENDING' | 'AT_RISK' | 'EXHAUSTED';
  daysRemaining: number;
  projectedSpend: number;
  confidenceScore: number;
  // Enhanced fields for better insights
  dailyAverageSpend?: number;
  weeklyTrend?: 'up' | 'down' | 'stable';
  potentialSavings?: number;
  potentialRevenueLoss?: number;
  lastOptimized?: string;
}

interface BudgetInsight {
  type: 'opportunity' | 'warning' | 'critical';
  title: string;
  description: string;
  impact: string;
  action: string;
  campaignIds: string[];
}

interface PacingDashboardProps {
  accountId: string;
}

// --- Main Enhanced Dashboard Component ---
export function BudgetPacingDashboard({ accountId }: PacingDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  // Enhanced query with more detailed insights
  const { data: pacingData = [], isLoading, error } = useQuery<PacingData[]>({
    queryKey: ['budget-pacing', accountId],
    queryFn: () => fetch(`/api/budget-pacing/${accountId}/detailed`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch pacing data');
      return res.json().then(data => data.success ? data.data : []);
    }),
    enabled: !!accountId,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Get AI-generated insights
  const { data: insights = [] } = useQuery<BudgetInsight[]>({
    queryKey: ['budget-insights', accountId],
    queryFn: () => fetch(`/api/budget-pacing/${accountId}/insights`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    enabled: !!accountId,
    refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
  });

  const applyBudgetMutation = useMutation({
    mutationFn: ({ campaignId, budget }: { campaignId: string, budget: number }) =>
      fetch(`/api/budget-pacing/${accountId}/${campaignId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recommendedBudget: budget }),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to apply budget recommendation');
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-pacing', accountId] });
    }
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState />;
  if (pacingData.length === 0) return <EmptyState />;

  const aggregate = aggregateEnhancedPacingData(pacingData);
  const criticalCampaigns = pacingData.filter(c => c.pacingStatus === 'EXHAUSTED' || c.pacingStatus === 'OVERSPENDING');
  
  return (
    <div className="space-y-6">
      {/* Enhanced Header with Key Metrics */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Account Budget Health
          </CardTitle>
          <CardDescription>AI-powered budget optimization and pacing insights</CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedPacingSummary aggregate={aggregate} totalCampaigns={pacingData.length} />
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {criticalCampaigns.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Immediate Action Required</AlertTitle>
          <AlertDescription>
            {criticalCampaigns.length} campaign{criticalCampaigns.length > 1 ? 's' : ''} need{criticalCampaigns.length === 1 ? 's' : ''} immediate budget attention.
            Potential daily loss: ${criticalCampaigns.reduce((sum, c) => sum + (c.potentialRevenueLoss || 0), 0).toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      {/* AI Insights Section */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              AI Budget Insights
            </CardTitle>
            <CardDescription>Machine learning recommendations for budget optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <AIInsightsList insights={insights} />
          </CardContent>
        </Card>
      )}

      {/* Tabbed Campaign View */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="critical">Critical ({criticalCampaigns.length})</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CampaignOverviewTab 
            campaigns={pacingData} 
            onApplyRecommendation={applyBudgetMutation.mutate}
            isApplying={applyBudgetMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="critical">
          <CriticalCampaignsTab 
            campaigns={criticalCampaigns} 
            onApplyRecommendation={applyBudgetMutation.mutate}
            isApplying={applyBudgetMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="opportunities">
          <OpportunitiesTab campaigns={pacingData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Enhanced Sub-Components ---

const EnhancedPacingSummary = ({ aggregate, totalCampaigns }: { 
  aggregate: ReturnType<typeof aggregateEnhancedPacingData>, 
  totalCampaigns: number 
}) => {
  const { totalSpend, totalBudget, projectedSpend, potentialSavings, potentialRevenue } = aggregate;
  const spendPercentage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const efficiency = totalSpend > 0 ? (potentialRevenue / totalSpend) : 0;
  
  return (
    <div className="space-y-6">
      <Progress value={spendPercentage} className="h-4" />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Current Spend"
          value={`$${totalSpend.toLocaleString()}`}
          trend={projectedSpend > totalBudget ? 'up' : 'down'}
          icon={DollarSign}
          color="text-blue-600"
        />
        <MetricCard 
          label="Monthly Budget"
          value={`$${totalBudget.toLocaleString()}`}
          subtitle={`${totalCampaigns} campaigns`}
          icon={Target}
          color="text-gray-600"
        />
        <MetricCard 
          label="Projected Total"
          value={`$${projectedSpend.toLocaleString()}`}
          trend={projectedSpend > totalBudget ? 'up' : 'down'}
          subtitle={projectedSpend > totalBudget ? 'Overbudget' : 'On track'}
          icon={TrendingUp}
          color={projectedSpend > totalBudget ? 'text-red-600' : 'text-green-600'}
        />
        <MetricCard 
          label="Optimization Potential"
          value={`$${potentialSavings.toLocaleString()}`}
          subtitle="Monthly savings"
          icon={PiggyBank}
          color="text-green-600"
        />
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, subtitle, trend, icon: Icon, color }: any) => (
  <div className="text-center space-y-1">
    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
      {trend && (
        trend === 'up' ? <ArrowUp className="h-3 w-3 text-red-500" /> : <ArrowDown className="h-3 w-3 text-green-500" />
      )}
    </div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
  </div>
);

const AIInsightsList = ({ insights }: { insights: BudgetInsight[] }) => (
  <div className="space-y-3">
    {insights.slice(0, 3).map((insight, index) => (
      <div key={index} className={`p-4 rounded-lg border-l-4 ${getInsightStyle(insight.type)}`}>
        <div className="flex justify-between items-start">
          <div className="flex-grow">
            <h4 className="font-medium text-gray-900">{insight.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="font-medium">Impact:</span>
              <span>{insight.impact}</span>
            </div>
          </div>
          <Button size="sm" variant="outline">
            {insight.action}
          </Button>
        </div>
      </div>
    ))}
  </div>
);

const CampaignOverviewTab = ({ campaigns, onApplyRecommendation, isApplying }: any) => {
  const sortedCampaigns = [...campaigns].sort((a, b) => 
    getStatusSeverity(b.pacingStatus).localeCompare(getStatusSeverity(a.pacingStatus))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Campaigns</CardTitle>
        <CardDescription>Complete overview sorted by urgency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedCampaigns.map(campaign => (
          <EnhancedCampaignCard 
            key={campaign.campaignId} 
            campaign={campaign} 
            onApplyRecommendation={() => onApplyRecommendation({ 
              campaignId: campaign.campaignId, 
              budget: campaign.recommendedDailyBudget 
            })}
            isApplying={isApplying}
          />
        ))}
      </CardContent>
    </Card>
  );
};

const CriticalCampaignsTab = ({ campaigns, onApplyRecommendation, isApplying }: any) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-red-600">Critical Budget Issues</CardTitle>
      <CardDescription>Campaigns requiring immediate attention</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {campaigns.map((campaign: PacingData) => (
        <EnhancedCampaignCard 
          key={campaign.campaignId} 
          campaign={campaign} 
          onApplyRecommendation={() => onApplyRecommendation({ 
            campaignId: campaign.campaignId, 
            budget: campaign.recommendedDailyBudget 
          })}
          isApplying={isApplying}
          showImpact={true}
        />
      ))}
    </CardContent>
  </Card>
);

const OpportunitiesTab = ({ campaigns }: { campaigns: PacingData[] }) => {
  const opportunities = campaigns.filter(c => c.potentialSavings && c.potentialSavings > 0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-green-600">Optimization Opportunities</CardTitle>
        <CardDescription>Campaigns with potential for cost savings or revenue growth</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.map(campaign => (
            <div key={campaign.campaignId} className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-green-900">{campaign.campaignName}</h4>
                  <p className="text-sm text-green-700">
                    Potential monthly savings: ${campaign.potentialSavings?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Current pacing allows for optimization without performance loss
                  </p>
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  Optimize
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const EnhancedCampaignCard = ({ campaign, onApplyRecommendation, isApplying, showImpact = false }: any) => {
  const { color, icon: Icon } = getStatusInfo(campaign.pacingStatus);
  const efficiency = campaign.currentSpend > 0 ? ((campaign.potentialRevenueLoss || 0) / campaign.currentSpend) * 100 : 0;
  
  return (
    <div className={`p-4 border rounded-lg space-y-3 ${campaign.pacingStatus === 'EXHAUSTED' ? 'bg-red-50 border-red-200' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{campaign.campaignName}</h4>
            <Badge variant={campaign.pacingStatus === 'ON_TRACK' ? 'default' : 'destructive'}>
              {campaign.pacingStatus.replace('_', ' ')}
            </Badge>
            {campaign.weeklyTrend && (
              <Badge variant="outline">
                {campaign.weeklyTrend === 'up' ? '↗' : campaign.weeklyTrend === 'down' ? '↘' : '→'} Weekly
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Current Spend</div>
              <div className="font-medium">${campaign.currentSpend.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Daily Avg</div>
              <div className="font-medium">${(campaign.dailyAverageSpend || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Projected</div>
              <div className={`font-medium ${campaign.projectedSpend > campaign.budgetTarget ? 'text-red-600' : 'text-green-600'}`}>
                ${campaign.projectedSpend.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Confidence</div>
              <div className="font-medium">{campaign.confidenceScore}%</div>
            </div>
          </div>

          {showImpact && (campaign.potentialSavings || campaign.potentialRevenueLoss) && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Business Impact:</strong> 
              {campaign.potentialRevenueLoss ? 
                <span className="text-red-600"> ${campaign.potentialRevenueLoss.toLocaleString()} potential daily revenue loss</span> :
                <span className="text-green-600"> ${(campaign.potentialSavings || 0).toLocaleString()} potential monthly savings</span>
              }
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <Button 
            size="sm" 
            onClick={onApplyRecommendation} 
            disabled={isApplying || campaign.pacingStatus === 'ON_TRACK'}
            className={campaign.pacingStatus === 'EXHAUSTED' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isApplying ? 'Applying...' : 
             campaign.pacingStatus === 'EXHAUSTED' ? 'Fix Budget' : 'Apply AI Rec'}
          </Button>
          {campaign.recommendedDailyBudget !== campaign.currentSpend && (
            <div className="text-xs text-center text-gray-500">
              Rec: ${campaign.recommendedDailyBudget.toFixed(2)}/day
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Helper Functions ---

const LoadingSkeleton = () => <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></CardContent></Card>;
const ErrorState = () => <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>Could not load budget pacing data.</AlertDescription></Alert>;
const EmptyState = () => <Card className="text-center py-10 text-gray-500"><HelpCircle className="mx-auto h-8 w-8 mb-2" /><h3 className="font-semibold">No Pacing Data</h3><p className="text-sm">No active campaigns with budget data were found for this account.</p></Card>;

const aggregateEnhancedPacingData = (data: PacingData[]) => {
  return data.reduce((acc, campaign) => {
    acc.totalSpend += campaign.currentSpend;
    acc.totalBudget += campaign.budgetTarget;
    acc.projectedSpend += campaign.projectedSpend;
    acc.potentialSavings += campaign.potentialSavings || 0;
    acc.potentialRevenue += campaign.potentialRevenueLoss || 0;
    return acc;
  }, { totalSpend: 0, totalBudget: 0, projectedSpend: 0, potentialSavings: 0, potentialRevenue: 0 });
};

const getStatusSeverity = (status: PacingData['pacingStatus']): string => {
  const order = { 'EXHAUSTED': '1', 'OVERSPENDING': '2', 'AT_RISK': '3', 'UNDERSPENDING': '4', 'ON_TRACK': '5' };
  return order[status] || '5';
};

const getStatusInfo = (status: PacingData['pacingStatus']) => {
  switch (status) {
    case 'ON_TRACK': return { icon: CheckCircle, color: 'text-green-600' };
    case 'AT_RISK': return { icon: AlertTriangle, color: 'text-yellow-600' };
    case 'OVERSPENDING': return { icon: TrendingUp, color: 'text-red-600' };
    case 'EXHAUSTED': return { icon: XCircle, color: 'text-red-700' };
    case 'UNDERSPENDING': return { icon: TrendingDown, color: 'text-blue-600' };
    default: return { icon: HelpCircle, color: 'text-gray-500' };
  }
};

const getInsightStyle = (type: BudgetInsight['type']) => {
  switch (type) {
    case 'critical': return 'bg-red-50 border-l-red-500';
    case 'warning': return 'bg-yellow-50 border-l-yellow-500';
    case 'opportunity': return 'bg-green-50 border-l-green-500';
    default: return 'bg-gray-50 border-l-gray-500';
  }
};