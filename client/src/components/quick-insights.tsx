import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { GoogleAdsAccount } from '@shared/schema';

interface QuickInsightsProps {
  selectedClient?: GoogleAdsAccount | null;
}

interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
}

interface BudgetData {
  monthly: number;
  used: number;
  percentUsed: number;
  status: 'on_track' | 'over_pacing' | 'under_pacing';
}



export default function QuickInsights({ selectedClient }: QuickInsightsProps) {
  const { user } = useAuth();

  const { data: metrics, isLoading: metricsLoading } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/google-ads/accounts', selectedClient?.id, 'metrics'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/google-ads/accounts/${selectedClient?.id}/metrics`);
      return response.json();
    },
    enabled: !!selectedClient && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: budgetData, isLoading: budgetLoading } = useQuery<BudgetData>({
    queryKey: ['/api/google-ads/accounts', selectedClient?.id, 'pacing'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/budget-pacing/account/${selectedClient?.id}`);
      return response.json();
    },
    enabled: !!selectedClient && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: issuesResponse, isLoading: issuesLoading } = useQuery({
    queryKey: ['/api/issues/actionable', selectedClient?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/issues/actionable?accountId=${selectedClient?.id}`);
      return response.json();
    },
    enabled: !!selectedClient && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: activitiesResponse, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/activities', selectedClient?.id],
    queryFn: async () => {
      // Mock activities for now since audit logs endpoint doesn't exist
      return [
        {
          id: '1',
          title: 'Campaign optimization completed',
          timestamp: '2 hours ago'
        },
        {
          id: '2',
          title: 'Budget adjustment applied',
          timestamp: '4 hours ago'
        },
        {
          id: '3',
          title: 'New keywords added',
          timestamp: '1 day ago'
        }
      ];
    },
    enabled: !!selectedClient && !!user,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  // Safely handle the data with proper fallbacks
  const issues = Array.isArray(issuesResponse) ? issuesResponse : [];
  const activities = Array.isArray(activitiesResponse) ? activitiesResponse : [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (!user) {
    return (
      <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto">
        <div className="text-center py-8">
          <p className="text-slate-500">Please log in to view insights</p>
        </div>
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto">
        <div className="text-center py-8">
          <p className="text-slate-500">Select a client to view insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Insights</h3>
        
        {/* Client Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-900">{selectedClient.name}</h4>
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            ID: {selectedClient.customerId}
            {selectedClient.currency && ` • ${selectedClient.currency}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last sync: 2 minutes ago
          </p>
        </div>
        
        {/* Today's Performance */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Today's Performance</h4>
          <div className="space-y-3">
            {metricsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-lg animate-pulse">
                    <div className="h-4 bg-slate-200 rounded mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : metrics ? (
              <>
                <Card className="p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Spend</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {formatCurrency(metrics.cost)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-slate-500">Last 7 days</span>
                  </div>
                </Card>
                
                <Card className="p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Clicks</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {formatNumber(metrics.clicks)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-slate-500">CTR: {(metrics.ctr * 100).toFixed(2)}%</span>
                  </div>
                </Card>
                
                <Card className="p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Conversions</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {Math.round(metrics.conversions)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-slate-500">Rate: {(metrics.conversionRate * 100).toFixed(2)}%</span>
                  </div>
                </Card>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No metrics data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Pacing */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Budget Pacing</h4>
          <div className="space-y-3">
            {budgetLoading ? (
              <div className="bg-slate-50 p-3 rounded-lg animate-pulse">
                <div className="h-4 bg-slate-200 rounded mb-2"></div>
                <div className="h-2 bg-slate-200 rounded mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              </div>
            ) : budgetData ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Monthly Budget</span>
                  <span className="text-sm font-medium text-slate-900">
                    {formatCurrency(budgetData.monthly)}
                  </span>
                </div>
                <Progress value={budgetData.percentUsed} className="mb-2" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Used: {formatCurrency(budgetData.used)}
                  </span>
                  <Badge 
                    variant={budgetData.status === 'on_track' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {budgetData.status === 'on_track' ? 'On track' : 'Over pacing'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No budget data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Issues */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Active Issues</h4>
          <div className="space-y-2">
            {issuesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-lg animate-pulse">
                    <div className="h-3 bg-slate-200 rounded mb-2"></div>
                    <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : issues.length > 0 ? (
              issues.map((issue) => (
                <div 
                  key={issue.id}
                  className={`flex items-start p-3 rounded-lg border ${
                    issue.type === 'warning' 
                      ? 'bg-amber-50 border-amber-200' 
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 mt-1 ${
                    issue.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${
                      issue.type === 'warning' ? 'text-amber-800' : 'text-blue-800'
                    }`}>
                      {issue.title}
                    </p>
                    <p className={`text-xs ${
                      issue.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {issue.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No active issues</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Recent Activity</h4>
          <div className="space-y-3">
            {activitiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-50 p-2 rounded animate-pulse">
                    <div className="h-3 bg-slate-200 rounded mb-1"></div>
                    <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="text-xs">
                  <span className="font-medium text-slate-700">{activity.title}</span>
                  <div className="text-slate-500 mt-1">{activity.timestamp}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
