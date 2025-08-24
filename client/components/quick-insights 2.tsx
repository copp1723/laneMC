import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, AlertTriangle, TrendingUp, Brain, Zap, DollarSign } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

// --- Type Definitions for API Payloads ---

interface ActionableAlert {
  id: string;
  type: 'BUDGET' | 'PERFORMANCE' | 'POLICY';
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
}

interface ImpactOpportunity {
  id: string;
  type: 'REVENUE' | 'SAVINGS';
  title: string;
  description: string;
  estimatedValue: number;
  period: 'monthly' | 'quarterly';
}

interface AutomationStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'ready';
}

// --- Main Component ---

interface QuickInsightsProps {
  selectedClient?: GoogleAdsAccount | null;
}

export default function QuickInsights({ selectedClient }: QuickInsightsProps) {
  const accountId = selectedClient?.id;

  const { data: alerts, isLoading: isLoadingAlerts } = useQuery<ActionableAlert[]>({
    queryKey: ['/api/issues/actionable', accountId],
    queryFn: () => fetch(`/api/issues/actionable?accountId=${accountId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    enabled: !!accountId,
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: opportunities, isLoading: isLoadingOpps } = useQuery<ImpactOpportunity[]>({
    queryKey: ['/api/insights/opportunities', accountId],
    queryFn: () => fetch(`/api/insights/opportunities?accountId=${accountId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const automations: AutomationStatus[] = [
    { id: '1', name: 'Budget Pacing', status: 'active' },
    { id: '2', name: 'Bid Optimization', status: 'active' },
    { id: '3', name: 'Keyword Discovery', status: 'ready' },
  ];

  const isLoading = isLoadingAlerts || isLoadingOpps;

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      <Header selectedClient={selectedClient} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedClient ? (
          <EmptyState />
        ) : isLoading ? (
          <LoadingState />
        ) : (
          <>
            <ActionRequiredCard alerts={alerts} />
            <ImpactOpportunitiesCard opportunities={opportunities} />
            <AutomationsCard automations={automations} />
            <QuickActionsCard />
          </>
        )}
      </div>
    </div>
  );
}

// --- Sub-Components ---

const Header = ({ selectedClient }: QuickInsightsProps) => (
  <div className="p-4 border-b border-slate-200">
    <h2 className="text-lg font-semibold text-slate-900">Business Impact</h2>
    <p className="text-sm text-slate-500 mt-1 truncate">
      {selectedClient ? selectedClient.name : 'No client selected'}
    </p>
  </div>
);

const EmptyState = () => (
  <div className="text-center text-slate-500 pt-16">
    <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
    <p>Select a client to view insights</p>
  </div>
);

const LoadingState = () => (
  <div className="space-y-4 p-2">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-28 w-full" />
  </div>
);

const ActionRequiredCard = ({ alerts }: { alerts?: ActionableAlert[] }) => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <AlertTriangle className="w-4 h-4 text-red-600" />
      <CardTitle className="text-sm font-bold text-red-600">Action Required</CardTitle>
    </CardHeader>
    <CardContent className="pt-0 space-y-2">
      {alerts && alerts.length > 0 ? (
        alerts.map(alert => <ActionableItem key={alert.id} alert={alert} />)
      ) : (
        <p className="text-xs text-slate-500 py-2">No critical actions required.</p>
      )}
    </CardContent>
  </Card>
);

const ActionableItem = ({ alert }: { alert: ActionableAlert }) => (
  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
    <div className="text-sm font-medium text-slate-900">{alert.title}</div>
    <div className="text-xs text-slate-700 mt-1">{alert.description}</div>
    <Button size="sm" variant="destructive" className="mt-2 h-7 text-xs">
      {alert.ctaText}
    </Button>
  </div>
);

const ImpactOpportunitiesCard = ({ opportunities }: { opportunities?: ImpactOpportunity[] }) => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <TrendingUp className="w-4 h-4 text-slate-600" />
      <CardTitle className="text-sm">Impact Opportunities</CardTitle>
    </CardHeader>
    <CardContent className="pt-0 space-y-3">
      {opportunities && opportunities.length > 0 ? (
        opportunities.map(opp => <OpportunityItem key={opp.id} opportunity={opp} />)
      ) : (
        <p className="text-xs text-slate-500 py-2">No new opportunities found.</p>
      )}
    </CardContent>
  </Card>
);

const OpportunityItem = ({ opportunity }: { opportunity: ImpactOpportunity }) => (
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-medium">{opportunity.title}</div>
      <div className="text-xs text-slate-600">{opportunity.description}</div>
    </div>
    <div className="text-right flex-shrink-0 ml-2">
      <div className={`text-lg font-bold ${opportunity.type === 'REVENUE' ? 'text-green-600' : 'text-slate-900'}`}>
        {opportunity.type === 'REVENUE' ? '+' : '-'}${opportunity.estimatedValue.toLocaleString()}
      </div>
      <div className="text-xs text-slate-500">Est. {opportunity.period}</div>
    </div>
  </div>
);

const AutomationsCard = ({ automations }: { automations: AutomationStatus[] }) => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <Brain className="w-4 h-4 text-slate-600" />
      <CardTitle className="text-sm">AI Automations</CardTitle>
    </CardHeader>
    <CardContent className="pt-0 space-y-1">
      {automations.map(auto => <AutomationStatusItem key={auto.id} automation={auto} />)}
    </CardContent>
  </Card>
);

const AutomationStatusItem = ({ automation }: { automation: AutomationStatus }) => {
  const statusColors = {
    active: 'secondary',
    ready: 'outline',
    inactive: 'destructive',
  };
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{automation.name}</span>
      <Badge variant={statusColors[automation.status] as any} className="text-xs capitalize">{automation.status}</Badge>
    </div>
  );
};

const QuickActionsCard = () => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <Zap className="w-4 h-4 text-slate-600" />
      <CardTitle className="text-sm">Quick Actions</CardTitle>
    </CardHeader>
    <CardContent className="pt-0 space-y-2">
      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
        <TrendingUp className="w-3 h-3 mr-2" /> Generate Performance Report
      </Button>
      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
        <Target className="w-3 h-3 mr-2" /> Find Keyword Opportunities
      </Button>
    </CardContent>
  </Card>
);