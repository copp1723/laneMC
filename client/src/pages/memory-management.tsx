import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, Cloud, Search, Plus, Trash2, Link as LinkIcon, FileText, Activity } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SupermemoryConnection {
  id: string;
  connectionId: string;
  provider: string;
  email?: string;
  documentLimit?: number;
  containerTags?: string[];
  expiresAt?: string;
  createdAt: string;
}

interface SupermemoryMemory {
  id: string;
  memoryId: string;
  title?: string;
  content: string;
  summary?: string;
  type: string;
  status: string;
  containerTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MemoryManagement() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [newConnectionDialog, setNewConnectionDialog] = useState(false);
  const [newMemoryDialog, setNewMemoryDialog] = useState(false);

  // Fetch connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/supermemory/connections'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch memories
  const { data: memories = [], isLoading: memoriesLoading } = useQuery({
    queryKey: ['/api/supermemory/memories'],
    staleTime: 5 * 60 * 1000,
  });

  // Search memories
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['/api/supermemory/search', searchQuery],
    enabled: !!searchQuery,
    staleTime: 30 * 1000,
  });

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/supermemory/connections', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supermemory/connections'] });
      setNewConnectionDialog(false);
      toast({ title: 'Connection created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create connection',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Create memory mutation
  const createMemoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/supermemory/memories', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supermemory/memories'] });
      setNewMemoryDialog(false);
      toast({ title: 'Memory created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create memory',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: (connectionId: string) => 
      apiRequest(`/api/supermemory/connections/${connectionId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supermemory/connections'] });
      toast({ title: 'Connection deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete connection',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete memory mutation
  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId: string) => 
      apiRequest(`/api/supermemory/memories/${memoryId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supermemory/memories'] });
      toast({ title: 'Memory deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete memory',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'notion': return <FileText className="w-4 h-4" />;
      case 'google-drive': return <Cloud className="w-4 h-4" />;
      case 'onedrive': return <Cloud className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'campaign': return <Activity className="w-4 h-4" />;
      case 'performance': return <Activity className="w-4 h-4" />;
      case 'chat': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const ConnectionForm = () => {
    const [formData, setFormData] = useState({
      provider: '',
      accessToken: '',
      refreshToken: '',
      containerTags: '',
      documentLimit: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createConnectionMutation.mutate({
        ...formData,
        containerTags: formData.containerTags.split(',').map(tag => tag.trim()).filter(Boolean),
        documentLimit: formData.documentLimit ? parseInt(formData.documentLimit) : undefined
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="provider">Provider</Label>
          <Select value={formData.provider} onValueChange={(value) => setFormData({...formData, provider: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notion">Notion</SelectItem>
              <SelectItem value="google-drive">Google Drive</SelectItem>
              <SelectItem value="onedrive">OneDrive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="accessToken">Access Token</Label>
          <Input
            id="accessToken"
            type="password"
            value={formData.accessToken}
            onChange={(e) => setFormData({...formData, accessToken: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="refreshToken">Refresh Token (Optional)</Label>
          <Input
            id="refreshToken"
            type="password"
            value={formData.refreshToken}
            onChange={(e) => setFormData({...formData, refreshToken: e.target.value})}
          />
        </div>
        <div>
          <Label htmlFor="containerTags">Container Tags (comma-separated)</Label>
          <Input
            id="containerTags"
            value={formData.containerTags}
            onChange={(e) => setFormData({...formData, containerTags: e.target.value})}
            placeholder="tag1, tag2, tag3"
          />
        </div>
        <div>
          <Label htmlFor="documentLimit">Document Limit</Label>
          <Input
            id="documentLimit"
            type="number"
            value={formData.documentLimit}
            onChange={(e) => setFormData({...formData, documentLimit: e.target.value})}
          />
        </div>
        <Button type="submit" disabled={createConnectionMutation.isPending}>
          {createConnectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Connection
        </Button>
      </form>
    );
  };

  const MemoryForm = () => {
    const [formData, setFormData] = useState({
      title: '',
      content: '',
      type: 'text',
      summary: '',
      url: '',
      containerTags: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createMemoryMutation.mutate({
        ...formData,
        containerTags: formData.containerTags.split(',').map(tag => tag.trim()).filter(Boolean)
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            rows={4}
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="campaign">Campaign Data</SelectItem>
              <SelectItem value="performance">Performance Data</SelectItem>
              <SelectItem value="chat">Chat Session</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="summary">Summary (Optional)</Label>
          <Textarea
            id="summary"
            value={formData.summary}
            onChange={(e) => setFormData({...formData, summary: e.target.value})}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="url">URL (Optional)</Label>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
          />
        </div>
        <div>
          <Label htmlFor="containerTags">Container Tags (comma-separated)</Label>
          <Input
            id="containerTags"
            value={formData.containerTags}
            onChange={(e) => setFormData({...formData, containerTags: e.target.value})}
            placeholder="google-ads, campaign, performance"
          />
        </div>
        <Button type="submit" disabled={createMemoryMutation.isPending}>
          {createMemoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Memory
        </Button>
      </form>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Memory Management</h1>
          <p className="text-gray-600 mt-2">
            Manage document connections and stored memories with Supermemory integration
          </p>
        </div>
      </div>

      <Tabs defaultValue="memories" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="memories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Stored Memories</h2>
            <Dialog open={newMemoryDialog} onOpenChange={setNewMemoryDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Memory
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Memory</DialogTitle>
                  <DialogDescription>
                    Add content to your memory storage for easy retrieval and organization.
                  </DialogDescription>
                </DialogHeader>
                <MemoryForm />
              </DialogContent>
            </Dialog>
          </div>

          {memoriesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No memories stored yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Create your first memory to start organizing your Google Ads data
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(memories as SupermemoryMemory[]).map((memory: SupermemoryMemory) => (
                <Card key={memory.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(memory.type)}
                        <CardTitle className="text-lg">{memory.title || 'Untitled'}</CardTitle>
                        <Badge variant="outline">{memory.type}</Badge>
                        <Badge variant={memory.status === 'completed' ? 'default' : 'secondary'}>
                          {memory.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMemoryMutation.mutate(memory.memoryId)}
                        disabled={deleteMemoryMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {memory.summary && (
                      <CardDescription>{memory.summary}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {memory.content}
                      </p>
                      {memory.containerTags && memory.containerTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {(memory.containerTags as string[]).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        Created: {new Date(memory.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Document Connections</h2>
            <Dialog open={newConnectionDialog} onOpenChange={setNewConnectionDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Connection</DialogTitle>
                  <DialogDescription>
                    Connect to external document sources like Notion, Google Drive, or OneDrive.
                  </DialogDescription>
                </DialogHeader>
                <ConnectionForm />
              </DialogContent>
            </Dialog>
          </div>

          {connectionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <LinkIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No connections configured</p>
                <p className="text-sm text-gray-500 mt-2">
                  Connect to document sources to automatically sync your content
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(connections as SupermemoryConnection[]).map((connection: SupermemoryConnection) => (
                <Card key={connection.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(connection.provider)}
                        <CardTitle className="text-lg capitalize">
                          {connection.provider.replace('-', ' ')}
                        </CardTitle>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteConnectionMutation.mutate(connection.connectionId)}
                        disabled={deleteConnectionMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {connection.email && (
                      <CardDescription>{connection.email}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {connection.documentLimit && (
                        <p className="text-sm text-gray-600">
                          Document Limit: {connection.documentLimit}
                        </p>
                      )}
                      {connection.containerTags && connection.containerTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {connection.containerTags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        Connected: {new Date(connection.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Search Memories</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search your memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {searchLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : searchQuery && searchResults.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No results found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Try different keywords or check your search query
                  </p>
                </CardContent>
              </Card>
            ) : searchQuery ? (
              <div className="grid gap-4">
                {(searchResults as any[]).map((result: any) => (
                  <Card key={result.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(result.type)}
                        <CardTitle className="text-lg">{result.title || 'Untitled'}</CardTitle>
                        <Badge variant="outline">{result.type}</Badge>
                      </div>
                      {result.summary && (
                        <CardDescription>{result.summary}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {result.content}
                      </p>
                      {result.container_tags && result.container_tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {result.container_tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">Enter a search query to find memories</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Search across all your stored content and connections
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}