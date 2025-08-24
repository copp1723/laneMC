import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

interface ClientSelectorProps {
  onClientChange?: (client: GoogleAdsAccount | null) => void;
}

export default function ClientSelector({ onClientChange }: ClientSelectorProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    data: accountsResponse, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/google-ads/accounts'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const accounts = accountsResponse?.data || [];

  const syncMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/google-ads/accounts/sync'),
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.setQueryData(['/api/google-ads/accounts'], result);
      toast({
        title: 'Accounts synchronized',
        description: `Found ${result.data?.length || 0} Google Ads accounts`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const selectedClient = accounts.find(acc => acc.id === clientId) || null;
    onClientChange?.(selectedClient);
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  // Auto-select first account if none selected
  useEffect(() => {
    if (accounts.length > 0 && !selectedClientId) {
      const firstAccount = accounts[0];
      setSelectedClientId(firstAccount.id);
      onClientChange?.(firstAccount);
    }
  }, [accounts, selectedClientId, onClientChange]);

  if (error) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Current Client</Label>
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">Failed to load accounts</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="w-full"
        >
          {syncMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700">Current Client</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="h-6 px-2 text-xs"
        >
          {syncMutation.isPending ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg animate-pulse">
          <div className="h-4 bg-slate-200 rounded"></div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-600 mb-2">No Google Ads accounts found</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            Sync Accounts
          </Button>
        </div>
      ) : (
        <Select value={selectedClientId} onValueChange={handleClientChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select client account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-xs text-slate-500">
                      ID: {account.customerId}
                      {account.currency && ` • ${account.currency}`}
                    </div>
                  </div>
                  {account.isActive && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
