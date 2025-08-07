import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Edit,
  Eye,
  Rocket,
  DollarSign,
  Target,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface GeneratedCampaignBrief {
  id: string;
  title: string;
  campaignType: string;
  objectives: string[];
  targetAudience: {
    demographics: string[];
    interests: string[];
    behaviors: string[];
    locations: string[];
  };
  budget: {
    daily: number;
    monthly: number;
    bidStrategy: string;
  };
  keywords: {
    primary: string[];
    secondary: string[];
    negative: string[];
  };
  adCopy: {
    headlines: string[];
    descriptions: string[];
    callsToAction: string[];
  };
  expectedMetrics: {
    estimatedClicks: number;
    estimatedCTR: number;
    estimatedCPC: number;
    projectedConversions: number;
  };
  confidenceScore: number;
  recommendations: string[];
  reviewNotes: string[];
}

interface CampaignBriefGeneratorProps {
  sessionId: string;
  accountId: string;
  onBriefGenerated?: (brief: GeneratedCampaignBrief) => void;
}

export function CampaignBriefGenerator({ 
  sessionId, 
  accountId, 
  onBriefGenerated 
}: CampaignBriefGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<GeneratedCampaignBrief | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showReviewMode, setShowReviewMode] = useState(false);
  const queryClient = useQueryClient();

  // Generate campaign brief from conversation
  const generateBrief = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/campaign-brief/generate`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          accountId
        })
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success && data.brief) {
        setGeneratedBrief(data.brief);
        setShowReviewMode(true);
        onBriefGenerated?.(data.brief);
      } else if (data.missingInfo) {
        setMissingInfo(data.missingInfo);
        setFollowUpQuestions(data.followUpQuestions || []);
      }
    },
    onError: (error) => {
      console.error('Brief generation failed:', error);
    }
  });

  // Refine brief based on feedback
  const refineBrief = useMutation({
    mutationFn: async ({ feedback, changes }: { feedback: string; changes: string[] }) => {
      if (!generatedBrief) throw new Error('No brief to refine');
      
      const response = await apiRequest(`/api/campaign-brief/${generatedBrief.id}/refine`, {
        method: 'POST',
        body: JSON.stringify({
          feedback,
          requestedChanges: changes
        })
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success && data.refinedBrief) {
        setGeneratedBrief(data.refinedBrief);
      }
    }
  });

  // Create campaign from approved brief
  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!generatedBrief) throw new Error('No brief to create campaign from');
      
      const response = await apiRequest(`/api/campaigns/create-from-brief`, {
        method: 'POST',
        body: JSON.stringify({
          briefId: generatedBrief.id,
          accountId
        })
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      }
    }
  });

  const handleGenerateBrief = () => {
    setIsGenerating(true);
    generateBrief.mutate();
  };

  const handleRefineBrief = () => {
    if (reviewFeedback.trim()) {
      refineBrief.mutate({
        feedback: reviewFeedback,
        changes: reviewFeedback.split('\n').filter(line => line.trim())
      });
      setReviewFeedback('');
    }
  };

  const handleApproveBrief = () => {
    if (generatedBrief) {
      createCampaign.mutate();
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBackground = (score: number) => {
    if (score >= 85) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-blue-50 border-blue-200';
    if (score >= 55) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  if (!generatedBrief && followUpQuestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Generate Campaign Brief
          </CardTitle>
          <CardDescription>
            Transform your conversation into a structured Google Ads campaign brief
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Button 
              onClick={handleGenerateBrief} 
              disabled={generateBrief.isPending || isGenerating}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generateBrief.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Conversation...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Generate Campaign Brief
                </>
              )}
            </Button>
            <p className="text-sm text-gray-600 mt-3">
              Our AI will analyze your conversation and create a comprehensive campaign strategy
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show follow-up questions if information is missing
  if (followUpQuestions.length > 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            Additional Information Needed
          </CardTitle>
          <CardDescription className="text-yellow-700">
            Please provide more details to create a comprehensive campaign brief
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border">
              <h4 className="font-medium text-gray-900 mb-2">Missing Information:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {missingInfo.map((info, index) => (
                  <li key={index}>{info}</li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 border">
              <h4 className="font-medium text-gray-900 mb-3">Please answer these questions:</h4>
              <div className="space-y-3">
                {followUpQuestions.map((question, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-sm text-gray-700">{question}</p>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Continue the conversation by answering these questions, then try generating the brief again.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show generated brief for review
  if (generatedBrief && showReviewMode) {
    return (
      <div className="space-y-6">
        {/* Brief Header */}
        <Card className={`border-2 ${getConfidenceBackground(generatedBrief.confidenceScore)}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{generatedBrief.title}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <Badge variant="outline">{generatedBrief.campaignType}</Badge>
                  <span className="text-sm">
                    ${generatedBrief.budget.daily}/day • ${generatedBrief.budget.monthly}/month
                  </span>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getConfidenceColor(generatedBrief.confidenceScore)}`}>
                  {generatedBrief.confidenceScore}%
                </div>
                <div className="text-xs text-gray-600">Confidence</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress 
              value={generatedBrief.confidenceScore} 
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleApproveBrief}
                disabled={createCampaign.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {createCampaign.isPending ? 'Creating...' : 'Approve & Create Campaign'}
              </Button>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview Campaign
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Objectives & Targeting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Objectives & Targeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Campaign Objectives</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {generatedBrief.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Target Audience</h4>
                <div className="space-y-2 text-sm">
                  {generatedBrief.targetAudience.demographics.length > 0 && (
                    <div>
                      <span className="font-medium">Demographics:</span> {generatedBrief.targetAudience.demographics.join(', ')}
                    </div>
                  )}
                  {generatedBrief.targetAudience.interests.length > 0 && (
                    <div>
                      <span className="font-medium">Interests:</span> {generatedBrief.targetAudience.interests.join(', ')}
                    </div>
                  )}
                  {generatedBrief.targetAudience.locations.length > 0 && (
                    <div>
                      <span className="font-medium">Locations:</span> {generatedBrief.targetAudience.locations.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget & Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget & Projections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">${generatedBrief.budget.daily}</div>
                  <div className="text-xs text-gray-600">Daily Budget</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">${generatedBrief.budget.monthly}</div>
                  <div className="text-xs text-gray-600">Monthly Budget</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Expected Performance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Est. Clicks:</span>
                    <span className="font-medium">{generatedBrief.expectedMetrics.estimatedClicks.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. CTR:</span>
                    <span className="font-medium">{generatedBrief.expectedMetrics.estimatedCTR}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. CPC:</span>
                    <span className="font-medium">${generatedBrief.expectedMetrics.estimatedCPC}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Conversions:</span>
                    <span className="font-medium">{generatedBrief.expectedMetrics.projectedConversions}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Keywords & Ad Copy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Keywords Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Primary Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {generatedBrief.keywords.primary.map((keyword, index) => (
                    <Badge key={index} variant="default" className="bg-blue-100 text-blue-800">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Secondary Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {generatedBrief.keywords.secondary.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              {generatedBrief.keywords.negative.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Negative Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {generatedBrief.keywords.negative.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="bg-red-100 text-red-800">
                        -{keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Copy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Headlines</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {generatedBrief.adCopy.headlines.map((headline, index) => (
                    <li key={index}>{headline}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Descriptions</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {generatedBrief.adCopy.descriptions.map((desc, index) => (
                    <li key={index}>{desc}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Calls to Action</h4>
                <div className="flex flex-wrap gap-2">
                  {generatedBrief.adCopy.callsToAction.map((cta, index) => (
                    <Badge key={index} variant="outline" className="bg-orange-50 text-orange-700">
                      {cta}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        {generatedBrief.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                {generatedBrief.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Review Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Request Changes
            </CardTitle>
            <CardDescription>
              Provide feedback to refine the campaign brief
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe any changes you'd like to make to this campaign brief..."
              value={reviewFeedback}
              onChange={(e) => setReviewFeedback(e.target.value)}
              rows={4}
            />
            <Button 
              onClick={handleRefineBrief}
              disabled={refineBrief.isPending || !reviewFeedback.trim()}
              variant="outline"
            >
              {refineBrief.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refining...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Refine Brief
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}