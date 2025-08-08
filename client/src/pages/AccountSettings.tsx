import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings, User, Key, Bell, Globe, Shield, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UserSettings {
  id: string;
  email: string;
  name: string;
  timezone: string;
  language: string;
  notifications: {
    emailAlerts: boolean;
    budgetWarnings: boolean;
    campaignIssues: boolean;
    weeklyReports: boolean;
  };
  preferences: {
    defaultCurrency: string;
    dashboardLayout: string;
    autoRefreshInterval: number;
  };
}

interface APISettings {
  googleAds: {
    clientId: string;
    developerToken: string;
    loginCustomerId: string;
    status: 'connected' | 'disconnected' | 'error';
  };
  openRouter: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

export default function AccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');

  const { data: userSettings, isLoading: userLoading } = useQuery({
    queryKey: ['/api/settings/user'],
  });

  const { data: apiSettings, isLoading: apiLoading } = useQuery({
    queryKey: ['/api/settings/api'],
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: Partial<UserSettings>) =>
      apiRequest('/api/settings/user', { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: 'Settings updated',
        description: 'Your preferences have been saved successfully.',
      });
    },
  });

  const updateAPIMutation = useMutation({
    mutationFn: (data: Partial<APISettings>) =>
      apiRequest('/api/settings/api', { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/api'] });
      toast({
        title: 'API settings updated',
        description: 'Your API configuration has been saved.',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest('/api/settings/api/test-connection', { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: 'Connection test',
        description: data.success ? 'All connections are working!' : 'Some connections failed. Check your settings.',
        variant: data.success ? 'default' : 'destructive',
      });
    },
  });

  if (userLoading || apiLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Account Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>API Settings</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and account details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    defaultValue={userSettings?.name}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={userSettings?.email}
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue={userSettings?.timezone || 'America/New_York'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">GMT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue={userSettings?.language || 'en'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={() => updateUserMutation.mutate({})}
                disabled={updateUserMutation.isPending}
              >
                Save Profile Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Google Ads API Configuration
                <Badge variant={apiSettings?.googleAds?.status === 'connected' ? 'default' : 'destructive'}>
                  {apiSettings?.googleAds?.status || 'disconnected'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure your Google Ads API credentials for live campaign management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  defaultValue={apiSettings?.googleAds?.clientId}
                  placeholder="Enter your Google Ads Client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="developerToken">Developer Token</Label>
                <Input
                  id="developerToken"
                  type="password"
                  defaultValue={apiSettings?.googleAds?.developerToken}
                  placeholder="Enter your Google Ads Developer Token"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loginCustomerId">Login Customer ID (Manager Account)</Label>
                <Input
                  id="loginCustomerId"
                  defaultValue={apiSettings?.googleAds?.loginCustomerId}
                  placeholder="Enter your Google Ads Manager Customer ID"
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => updateAPIMutation.mutate({})}
                  disabled={updateAPIMutation.isPending}
                >
                  Save API Settings
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                >
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>
                Configure OpenRouter AI settings for campaign generation and analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiModel">AI Model</Label>
                <Select defaultValue={apiSettings?.openRouter?.model || 'anthropic/claude-3-sonnet'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                    <SelectItem value="anthropic/claude-3-haiku">Claude 3 Haiku</SelectItem>
                    <SelectItem value="openai/gpt-4">GPT-4</SelectItem>
                    <SelectItem value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (Creativity)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue={apiSettings?.openRouter?.temperature || 0.7}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    defaultValue={apiSettings?.openRouter?.maxTokens || 2000}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose which notifications you want to receive and how.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch 
                  defaultChecked={userSettings?.notifications?.emailAlerts}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Budget Warnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when campaigns exceed budget targets
                  </p>
                </div>
                <Switch 
                  defaultChecked={userSettings?.notifications?.budgetWarnings}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Campaign Issues</Label>
                  <p className="text-sm text-muted-foreground">
                    Alerts for campaign performance issues and errors
                  </p>
                </div>
                <Switch 
                  defaultChecked={userSettings?.notifications?.campaignIssues}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly performance summary reports
                  </p>
                </div>
                <Switch 
                  defaultChecked={userSettings?.notifications?.weeklyReports}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Preferences</CardTitle>
              <CardDescription>
                Customize your Lane MCP experience and default settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select defaultValue={userSettings?.preferences?.defaultCurrency || 'USD'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                      <SelectItem value="CAD">Canadian Dollar (CAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refreshInterval">Auto-refresh Interval</Label>
                  <Select defaultValue={userSettings?.preferences?.autoRefreshInterval?.toString() || '300'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                      <SelectItem value="1800">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboardLayout">Dashboard Layout</Label>
                <Select defaultValue={userSettings?.preferences?.dashboardLayout || 'executive'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive (High-level)</SelectItem>
                    <SelectItem value="detailed">Detailed (Technical)</SelectItem>
                    <SelectItem value="compact">Compact (Overview)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and access controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                />
              </div>
              <Button variant="outline">
                Update Password
              </Button>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Active Sessions</h4>
                <p className="text-sm text-muted-foreground">
                  You are currently logged in on 1 device.
                </p>
                <Button variant="destructive" size="sm">
                  Revoke All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}