import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingDown, 
  DollarSign,
  Eye,
  MessageSquare,
  Activity,
  RefreshCw
} from 'lucide-react';

interface DetectedIssue {
  id: string;
  accountId: string;
  campaignId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
  confidenceScore: number;
  detectedAt: string;
  affectedMetrics: string[];
  historicalContext?: {
    previousValue: number;
    currentValue: number;
    changePercentage: number;
    timeframe: string;
  };
}

interface AccountHealthScore {
  score: number;
  grade: string;
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'medium':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <Activity className="h-4 w-4 text-blue-500" />;
    default:
      return <CheckCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getIssueTypeIcon = (type: string) => {
  switch (type) {
    case 'budget_overspend':
      return <DollarSign className="h-4 w-4" />;
    case 'performance_drop':
    case 'conversion_drop':
      return <TrendingDown className="h-4 w-4" />;
    case 'quality_score_drop':
      return <Eye className="h-4 w-4" />;
    case 'disapproval':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

export function IssueDetectionDashboard({ accountId }: { accountId: string }) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  // Fetch detected issues
  const { data: issues = [], isLoading: issuesLoading, refetch: refetchIssues } = useQuery<DetectedIssue[]>({
    queryKey: ['/api/issues/detect', accountId],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
  });

  // Fetch account health score
  const { data: healthScore, isLoading: healthLoading } = useQuery<AccountHealthScore>({
    queryKey: ['/api/issues/health-score', accountId],
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
  });

  const criticalIssues = issues.filter(issue => issue.severity === 'critical');
  const highIssues = issues.filter(issue => issue.severity === 'high');
  const recentIssues = issues
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 10);

  const handleRefresh = async () => {
    await Promise.all([
      refetchIssues(),
      queryClient.invalidateQueries({ queryKey: ['/api/issues/health-score', accountId] })
    ]);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreBackground = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 80) return 'bg-blue-50 border-blue-200';
    if (score >= 70) return 'bg-yellow-50 border-yellow-200';
    if (score >= 60) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  if (issuesLoading && !issues.length) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Issue Detection</h2>
          <p className="text-sm text-gray-600">Real-time monitoring and automated issue detection</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh
          </label>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={issuesLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${issuesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Account Health Score */}
      {healthScore && (
        <Card className={`border-2 ${getHealthScoreBackground(healthScore.score)}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Account Health Score</CardTitle>
                <CardDescription>Overall campaign performance and issue assessment</CardDescription>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${getHealthScoreColor(healthScore.score)}`}>
                  {healthScore.score}/100
                </div>
                <div className={`text-lg font-medium ${getHealthScoreColor(healthScore.score)}`}>
                  Grade {healthScore.grade}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress 
              value={healthScore.score} 
              className="mb-4"
            />
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600">{healthScore.issues.critical}</div>
                <div className="text-xs text-red-600">Critical</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{healthScore.issues.high}</div>
                <div className="text-xs text-orange-600">High</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{healthScore.issues.medium}</div>
                <div className="text-xs text-yellow-600">Medium</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{healthScore.issues.low}</div>
                <div className="text-xs text-blue-600">Low</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Alerts */}
      {criticalIssues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Critical Issues Requiring Immediate Attention
          </h3>
          {criticalIssues.map((issue) => (
            <Alert key={issue.id} className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="ml-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-red-800">{issue.title}</div>
                    <div className="text-sm text-red-700">{issue.description}</div>
                    {issue.recommendations.length > 0 && (
                      <div className="text-xs text-red-600">
                        <strong>Action needed:</strong> {issue.recommendations[0]}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-red-600 whitespace-nowrap">
                    {formatTimeAgo(issue.detectedAt)}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Issue Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">{issues.length}</p>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{criticalIssues.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-orange-600">{highIssues.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-600">
                  {issues.length > 0 
                    ? Math.round(issues.reduce((sum, issue) => sum + issue.confidenceScore, 0) / issues.length)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
          <CardDescription>
            Latest detected issues across all campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentIssues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">No issues detected</p>
              <p className="text-sm">All campaigns are running smoothly</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentIssues.map((issue, index) => (
                <div key={issue.id}>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 mt-1">
                      {getSeverityIcon(issue.severity)}
                      {getIssueTypeIcon(issue.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{issue.title}</h4>
                        <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {issue.confidenceScore}% confident
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                      
                      {issue.historicalContext && (
                        <div className="text-xs text-gray-500 mb-2">
                          Changed from {issue.historicalContext.previousValue.toFixed(2)} to {issue.historicalContext.currentValue.toFixed(2)} 
                          ({issue.historicalContext.changePercentage > 0 ? '+' : ''}{issue.historicalContext.changePercentage.toFixed(1)}%)
                        </div>
                      )}
                      
                      {issue.recommendations.length > 0 && (
                        <div className="text-xs text-gray-600">
                          <strong>Recommended:</strong> {issue.recommendations[0]}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {formatTimeAgo(issue.detectedAt)}
                    </div>
                  </div>
                  {index < recentIssues.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}