import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { GoogleAdsAccount } from '@shared/schema';

interface CampaignGenerationCardProps {
  selectedClient?: GoogleAdsAccount | null;
  currentSessionId?: string | null;
}

interface GenerationResult {
  success: boolean;
  campaignId?: string;
  workflowId: string;
  brief?: any;
  readyToLaunch: boolean;
  recommendations: string[];
}

export default function CampaignGenerationCard({ 
  selectedClient, 
  currentSessionId 
}: CampaignGenerationCardProps) {
  const [lastGeneration, setLastGeneration] = useState<GenerationResult | null>(null);
  const { toast } = useToast();

  const generateCampaign = useMutation({
    mutationFn: async () => {
      if (!currentSessionId) {
        throw new Error('No active chat session');
      }

      const response = await apiRequest('POST', '/api/campaign-generator/generate-from-conversation', {
        sessionId: currentSessionId
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }
      
      return result.data;
    },
    onSuccess: (data: GenerationResult) => {
      setLastGeneration(data);
      toast({
        title: 'Campaign Generated',
        description: 'AI has created a new campaign draft for review.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!selectedClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Campaign Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a client to generate campaigns
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Campaign Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Generate complete Google Ads campaigns from your chat conversation using AI.
        </div>

        <Button 
          onClick={() => generateCampaign.mutate()}
          disabled={generateCampaign.isPending || !currentSessionId}
          className="w-full"
        >
          {generateCampaign.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Campaign...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Campaign
            </>
          )}
        </Button>

        {!currentSessionId && (
          <p className="text-xs text-muted-foreground text-center">
            Start a chat to enable campaign generation
          </p>
        )}

        {lastGeneration && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Generation</span>
              <div className="flex items-center gap-2">
                {lastGeneration.readyToLaunch ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <Badge variant={lastGeneration.readyToLaunch ? "default" : "secondary"}>
                  {lastGeneration.readyToLaunch ? 'Ready' : 'Draft'}
                </Badge>
              </div>
            </div>

            {lastGeneration.brief && (
              <div>
                <div className="text-sm font-medium">Campaign</div>
                <div className="text-sm text-muted-foreground">
                  {lastGeneration.brief.campaignName || 'AI Generated Campaign'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Budget: ${lastGeneration.brief.budget?.amount || 0}/month
                </div>
              </div>
            )}

            {lastGeneration.recommendations.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-1">Recommendations</div>
                <div className="space-y-1">
                  {lastGeneration.recommendations.slice(0, 2).map((rec, index) => (
                    <div key={index} className="text-xs text-muted-foreground">
                      • {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}