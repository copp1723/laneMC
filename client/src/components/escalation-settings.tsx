import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, Bell, Mail, MessageSquare, Trash2 } from 'lucide-react';
import type { EscalationSettings, GoogleAdsAccount } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface EscalationSettingsProps {
  selectedClient?: GoogleAdsAccount | null;
}

export default function EscalationSettingsComponent({ selectedClient }: EscalationSettingsProps) {
  const [showNewSettingForm, setShowNewSettingForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['/api/escalation-settings', selectedClient?.id],
    queryFn: async () => {
      const response = await apiRequest(`/api/escalation-settings${selectedClient ? `?accountId=${selectedClient.id}` : ''}`);
      return Array.isArray(response) ? response : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/escalation-settings', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-settings'] });
      setShowNewSettingForm(false);
      toast({ title: 'Escalation setting created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create escalation setting', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/escalation-settings/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-settings'] });
      toast({ title: 'Escalation setting updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update escalation setting', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/escalation-settings/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-settings'] });
      toast({ title: 'Escalation setting deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete escalation setting', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      googleAdsAccountId: selectedClient?.id || null,
      type: formData.get('type'),
      threshold: parseFloat(formData.get('threshold') as string),
      enabled: true,
      notificationMethods: {
        email: formData.get('email') === 'on',
        sms: formData.get('sms') === 'on',
        slack: formData.get('slack') === 'on',
      },
      escalationRules: {
        immediate: formData.get('immediate') === 'on',
        after15min: formData.get('after15min') === 'on',
        after1hour: formData.get('after1hour') === 'on',
      }
    };

    createMutation.mutate(data);
  };

  const toggleSetting = (setting: EscalationSettings) => {
    updateMutation.mutate({
      id: setting.id,
      data: { enabled: !setting.enabled }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Settings className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Escalation Settings</h2>
        </div>
        <div className="text-center text-slate-600">Loading escalation settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Escalation Settings</h2>
        </div>
        <Button 
          onClick={() => setShowNewSettingForm(true)}
          size="sm"
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Setting</span>
        </Button>
      </div>

      {selectedClient && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            Configuring escalation settings for: <strong>{selectedClient.name}</strong>
          </p>
        </div>
      )}

      {showNewSettingForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <span>New Escalation Setting</span>
            </CardTitle>
            <CardDescription>
              Configure when and how you want to be notified about budget pacing issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Alert Type</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget_pacing">Budget Pacing</SelectItem>
                      <SelectItem value="performance_drop">Performance Drop</SelectItem>
                      <SelectItem value="campaign_issue">Campaign Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold">Threshold (%)</Label>
                  <Input
                    id="threshold"
                    name="threshold"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g., 20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Notification Methods</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="email" className="rounded" />
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="sms" className="rounded" />
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">SMS</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="slack" className="rounded" />
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">Slack</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Escalation Timeline</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="immediate" className="rounded" />
                    <span className="text-sm">Immediate</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="after15min" className="rounded" />
                    <span className="text-sm">After 15 minutes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="after1hour" className="rounded" />
                    <span className="text-sm">After 1 hour</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Setting'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowNewSettingForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {settings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-slate-600">
                <Bell className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="mb-2">No escalation settings configured</p>
                <p className="text-sm">Create your first setting to receive automated alerts</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          settings.map((setting: EscalationSettings) => (
            <Card key={setting.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant={setting.enabled ? 'default' : 'secondary'}>
                        {setting.type?.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-slate-600">
                        Threshold: {setting.threshold}%
                      </span>
                      <Badge variant={setting.enabled ? 'default' : 'outline'}>
                        {setting.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-slate-600">
                      {setting.notificationMethods && typeof setting.notificationMethods === 'object' && (
                        <div className="flex items-center space-x-2 mb-1">
                          <span>Notifications:</span>
                          {Object.entries(setting.notificationMethods as any).filter(([_, enabled]) => enabled).map(([method]) => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={setting.enabled || false}
                      onCheckedChange={() => toggleSetting(setting)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(setting.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}