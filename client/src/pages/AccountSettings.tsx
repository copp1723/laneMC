import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function AccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userSettings, isLoading: userLoading } = useQuery({
    queryKey: ['/api/settings/user'],
  });

  const { data: apiSettings, isLoading: apiLoading } = useQuery({
    queryKey: ['/api/settings/api'],
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/settings/user', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data) 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: 'Settings updated',
        description: 'Your preferences have been saved successfully.',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: () => 
      fetch('/api/settings/api/test-connection', { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: 'Connection test',
        description: 'Connection test completed successfully.',
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
              <p className="text-gray-600">Manage your Lane MCP account and preferences</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connection">Google Ads</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="support">Help & Support</TabsTrigger>
          </TabsList>

          {/* Google Ads Connection Tab */}
          <TabsContent value="connection" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Google Ads Connection
                  <Badge variant={(apiSettings as any)?.googleAds?.status === 'connected' ? 'default' : 'destructive'}>
                    {(apiSettings as any)?.googleAds?.status || 'disconnected'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Connect your Google Ads account to enable campaign management and automation features.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(apiSettings as any)?.googleAds?.status === 'connected' ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800">Google Ads Connected</p>
                        <p className="text-xs text-green-600">
                          Connected to Customer ID: {(apiSettings as any)?.googleAds?.loginCustomerId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <div className="text-sm text-gray-600 font-mono">
                          {(apiSettings as any)?.googleAds?.clientId}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Developer Token</Label>
                        <div className="text-sm text-gray-600">
                          {(apiSettings as any)?.googleAds?.developerToken}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => testConnectionMutation.mutate()}
                        disabled={testConnectionMutation.isPending}
                      >
                        {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => {
                          window.location.href = '/api/auth/google/disconnect';
                        }}
                      >
                        Disconnect Google Ads
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Google Ads Not Connected</p>
                        <p className="text-xs text-yellow-600">
                          Connect your Google Ads account to access campaign management features
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-center py-8">
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">Connect Google Ads</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Authorize Lane MCP to access your Google Ads account for campaign management
                          </p>
                        </div>
                        <Button 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            window.location.href = '/api/auth/google';
                          }}
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Connect with Google
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
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
                      defaultValue={(userSettings as any)?.name || ''}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={(userSettings as any)?.email || ''}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue={(userSettings as any)?.timezone || 'UTC'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue={(userSettings as any)?.language || 'en'}>
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

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Security Settings</h4>
                  <div className="space-y-2">
                    <Label htmlFor="password">Change Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => updateUserMutation.mutate({})}
                    disabled={updateUserMutation.isPending}
                  >
                    Save Profile Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notifications & Preferences</CardTitle>
                <CardDescription>
                  Configure how you receive alerts and customize your dashboard experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Email Notifications</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Budget Warnings</Label>
                        <p className="text-xs text-gray-500">Get notified when campaigns approach budget limits</p>
                      </div>
                      <Switch defaultChecked={(userSettings as any)?.notifications?.budgetWarnings || false} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Campaign Issues</Label>
                        <p className="text-xs text-gray-500">Receive alerts for campaign performance issues</p>
                      </div>
                      <Switch defaultChecked={(userSettings as any)?.notifications?.campaignIssues || false} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Weekly Reports</Label>
                        <p className="text-xs text-gray-500">Get weekly performance summaries via email</p>
                      </div>
                      <Switch defaultChecked={(userSettings as any)?.notifications?.weeklyReports || false} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Dashboard Preferences</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Currency</Label>
                      <Select defaultValue={(userSettings as any)?.preferences?.defaultCurrency || 'USD'}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Auto-refresh Interval</Label>
                      <Select defaultValue={(userSettings as any)?.preferences?.autoRefreshInterval?.toString() || '30'}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">1 minute</SelectItem>
                          <SelectItem value="300">5 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => updateUserMutation.mutate({})}
                    disabled={updateUserMutation.isPending}
                  >
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Help & Support</CardTitle>
                <CardDescription>
                  Get help with Lane MCP and access documentation resources.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Documentation</h4>
                    <div className="space-y-2">
                      <a 
                        href="#" 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium">Getting Started Guide</p>
                          <p className="text-xs text-gray-500">Learn the basics of Lane MCP</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                      <a 
                        href="#" 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium">Google Ads Integration</p>
                          <p className="text-xs text-gray-500">Setup and troubleshooting</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                      <a 
                        href="#" 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium">API Reference</p>
                          <p className="text-xs text-gray-500">Technical documentation</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Contact Support</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">Email Support</p>
                        <p className="text-xs text-gray-500">support@lanemcp.com</p>
                        <p className="text-xs text-gray-500">Response within 24 hours</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">Live Chat</p>
                        <p className="text-xs text-gray-500">Available Monday-Friday</p>
                        <p className="text-xs text-gray-500">9 AM - 6 PM EST</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">System Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label>Version</Label>
                      <p className="text-gray-600">v2.1.0</p>
                    </div>
                    <div>
                      <Label>Last Updated</Label>
                      <p className="text-gray-600">January 15, 2025</p>
                    </div>
                    <div>
                      <Label>Environment</Label>
                      <p className="text-gray-600">Production</p>
                    </div>
                    <div>
                      <Label>Region</Label>
                      <p className="text-gray-600">US-East</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}