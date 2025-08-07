import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Activity, Clock } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

interface MonitoringCardProps {
  selectedClient?: GoogleAdsAccount | null;
}

interface CampaignHealth {
  campaignId: string;
  overallHealth: 'healthy' | 'warning' | 'critical';
  lastCheck: string;
  issues: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
  }>;
  metrics: {
    uptime: number;
    performanceScore: number;
    budgetHealth: string;
    trafficQuality: number;
  };
  alerts: {
    active: number;
    resolved: number;
    dismissed: number;
  };
}

export default function MonitoringCard({ selectedClient }: MonitoringCardProps) {
  const { data: healthData, isLoading } = useQuery<{ success: boolean; data: CampaignHealth }>({
    queryKey: ['/api/monitoring/accounts', selectedClient?.id, 'campaigns', 'campaign_1', 'health'],
    enabled: !!selectedClient,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  if (!selectedClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Campaign Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a client to view campaign health</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Campaign Health
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

  const health = healthData?.data;

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getHealthVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Campaign Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {health ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getHealthIcon(health.overallHealth)}
                <Badge variant={getHealthVariant(health.overallHealth)}>
                  {health.overallHealth}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Last check: {new Date(health.lastCheck).toLocaleTimeString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Uptime</div>
                <div className="text-2xl font-bold text-green-600">
                  {health.metrics.uptime.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Performance Score</div>
                <div className="text-2xl font-bold">
                  {health.metrics.performanceScore}/100
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Active Alerts</div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Active: {health.alerts.active}</span>
                <span className="text-green-600">Resolved: {health.alerts.resolved}</span>
                <span className="text-gray-600">Dismissed: {health.alerts.dismissed}</span>
              </div>
            </div>

            {health.issues.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Recent Issues</div>
                <div className="space-y-1">
                  {health.issues.slice(0, 2).map((issue) => (
                    <div key={issue.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {issue.severity}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {issue.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No health data available</p>
        )}
      </CardContent>
    </Card>
  );
}