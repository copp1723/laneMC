import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, CheckCircle, Clock, TrendingDown, DollarSign,
  Eye, MessageSquare, Activity, RefreshCw, Info
} from 'lucide-react';

// --- Type Definitions ---
// (Should ideally be imported from a shared types file)
interface DetectedIssue {
  id: string;
  campaignId: string;
  type: 'performance_anomaly' | 'budget_pacing_alert' | 'quality_score_warning' | 'ad_disapproval';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
  confidenceScore: number;
  detectedAt: string;
  affectedMetrics: string[];
  historicalContext?: {
    metric: string;
    currentValue: number;
    mean: number;
    changePercentage?: number; // Kept for older issue types
  };
}

interface AccountHealthScore {
  score: number;
  grade: string;
  issues: { critical: number; high: number; medium: number; low: number; };
}

// --- Main Dashboard Component ---
export function IssueDetectionDashboard({ accountId }: { accountId: string }) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  const { data: issues = [], isLoading: issuesLoading, refetch: refetchIssues } = useQuery<DetectedIssue[]>({
    queryKey: ['issues', 'detect', accountId], // Corrected query key format
    queryFn: () => fetch(`/api/issues/detect?accountId=${accountId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()), // Example API call
    enabled: !!accountId,
    refetchInterval: autoRefresh ? 60 * 1000 : false,
  });

  const { data: healthScore, isLoading: healthLoading } = useQuery<AccountHealthScore>({
    queryKey: ['issues', 'health-score', accountId], // Corrected query key format
    queryFn: () => fetch(`/api/issues/health-score?accountId=${accountId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()), // Example API call
    enabled: !!accountId,
    refetchInterval: autoRefresh ? 2 * 60 * 1000 : false,
  });
  
  const criticalIssues = issues.filter(issue => issue.severity === 'critical');
  const recentIssues = issues.slice(0, 5);
  const isLoading = (issuesLoading && !issues.length) || (healthLoading && !healthScore);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardHeader autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} onRefresh={refetchIssues} isLoading={issuesLoading} />
      {healthScore && <HealthScoreCard healthScore={healthScore} />}
      {criticalIssues.length > 0 && <CriticalIssuesAlerts issues={criticalIssues} />}
      <RecentIssuesList issues={recentIssues} />
    </div>
  );
}

// --- Sub-Components ---

const DashboardHeader = ({ autoRefresh, setAutoRefresh, onRefresh, isLoading }: any) => (
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">Issue Detection</h2>
      <p className="text-sm text-gray-600">Real-time monitoring and automated issue detection.</p>
    </div>
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded border-gray-300" />
        Auto-refresh
      </label>
      <Button onClick={onRefresh} variant="outline" size="sm" disabled={isLoading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>
);

const HealthScoreCard = ({ healthScore }: { healthScore: AccountHealthScore }) => {
  const scoreColor = healthScore.score >= 80 ? 'text-green-600' : healthScore.score >= 60 ? 'text-yellow-600' : 'text-red-600';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Health Score</CardTitle>
        <CardDescription>Overall performance and issue assessment.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="flex-shrink-0 text-center">
          <div className={`text-5xl font-bold ${scoreColor}`}>{healthScore.score}</div>
          <div className={`text-lg font-medium ${scoreColor}`}>Grade {healthScore.grade}</div>
        </div>
        <div className="flex-grow space-y-3">
            <Progress value={healthScore.score} />
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div><div className="font-bold text-red-600 text-lg">{healthScore.issues.critical}</div><span className="text-gray-500">Critical</span></div>
                <div><div className="font-bold text-orange-600 text-lg">{healthScore.issues.high}</div><span className="text-gray-500">High</span></div>
                <div><div className="font-bold text-yellow-600 text-lg">{healthScore.issues.medium}</div><span className="text-gray-500">Medium</span></div>
                <div><div className="font-bold text-blue-600 text-lg">{healthScore.issues.low}</div><span className="text-gray-500">Low</span></div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CriticalIssuesAlerts = ({ issues }: { issues: DetectedIssue[] }) => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-gray-900">Critical Issues</h3>
    {issues.map((issue) => (
      <Alert key={issue.id} variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{issue.title}</AlertTitle>
        <AlertDescription className="flex justify-between items-center">
          <span>{issue.description}</span>
          <Button size="sm" variant="outline">View Details</Button>
        </AlertDescription>
      </Alert>
    ))}
  </div>
);

const RecentIssuesList = ({ issues }: { issues: DetectedIssue[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Recent Issues</CardTitle>
      <CardDescription>Latest detected issues across all campaigns.</CardDescription>
    </CardHeader>
    <CardContent>
      {issues.length === 0 ? <EmptyState /> : (
        <div className="space-y-4">
          {issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      )}
    </CardContent>
  </Card>
);

const IssueCard = ({ issue }: { issue: DetectedIssue }) => (
  <div className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}>
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        {getSeverityIcon(issue.severity)}
        <div>
          <h4 className="font-semibold text-gray-900">{issue.title}</h4>
          <span className="text-xs text-gray-500">Campaign ID: {issue.campaignId} &middot; {formatTimeAgo(issue.detectedAt)}</span>
        </div>
      </div>
      <Badge variant="outline">{issue.type.replace(/_/g, ' ')}</Badge>
    </div>
    <Separator className="my-3" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
            <h5 className="font-medium text-gray-600 mb-1">Description</h5>
            <p className="text-gray-800">{issue.description}</p>
        </div>
        <div>
            <h5 className="font-medium text-gray-600 mb-1">Context</h5>
            <p className="text-gray-800">{formatContext(issue.historicalContext)}</p>
        </div>
        <div>
            <h5 className="font-medium text-gray-600 mb-1">Recommendation</h5>
            <p className="text-blue-600 font-medium">{issue.recommendations[0]}</p>
        </div>
    </div>
  </div>
);

// --- UI Helpers & Skeletons ---

const LoadingSkeleton = () => <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
const EmptyState = () => <div className="text-center py-10 text-gray-500"><CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" /><p>No issues detected.</p></div>;

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  high: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
  medium: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200' },
  low: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
};

const getSeverityIcon = (severity: IssueSeverity) => {
  const Conf = severityConfig[severity];
  return <Conf.icon className={`h-5 w-5 ${Conf.color}`} />;
};
const getSeverityColor = (severity: IssueSeverity) => severityConfig[severity].bg;

const formatTimeAgo = (dateString: string) => { 
  return `${Math.floor((Date.now() - new Date(dateString).getTime())/60000)}m ago`
};
const formatContext = (ctx?: DetectedIssue['historicalContext']) => {
  if (!ctx) return 'No historical data.';
  return `${ctx.metric} changed from ${ctx.mean.toFixed(2)} to ${ctx.currentValue.toFixed(2)}.`;
};