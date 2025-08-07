import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, PlayCircle } from 'lucide-react';

interface SchedulerCardProps {
  className?: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

export default function SchedulerCard({ className }: SchedulerCardProps) {
  const { data: tasksData, isLoading } = useQuery<{ success: boolean; data: ScheduledTask[] }>({
    queryKey: ['/api/scheduler/tasks'],
    staleTime: 60 * 1000, // 1 minute
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="h-3 w-3 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running': return 'default';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Automated Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {tasksData?.data ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {tasksData.data.filter(t => t.status === 'completed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {tasksData.data.filter(t => t.status === 'running').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Running</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {tasksData.data.filter(t => t.enabled).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Recent Tasks</div>
                  {tasksData.data.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <span className="text-sm truncate">{task.name}</span>
                      </div>
                      <Badge variant={getStatusVariant(task.status)} className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Next run: {tasksData.data[0]?.nextRun ? 
                    new Date(tasksData.data[0].nextRun).toLocaleTimeString() : 
                    'Unknown'
                  }
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No task data available</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}