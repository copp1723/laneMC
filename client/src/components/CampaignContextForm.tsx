import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Building, Target, MapPin } from 'lucide-react';

interface CampaignContext {
  businessType: string;
  industry: string;
  targetAudience: string;
  budget: string;
  goals: string[];
  geographicLocation: string;
  seasonality: string;
  competitors: string[];
  uniqueSellingPoints: string[];
}

interface CampaignContextFormProps {
  context: CampaignContext;
  onChange: (context: CampaignContext) => void;
  onSubmit: () => void;
  isGenerating: boolean;
}

const industryTemplates = {
  automotive: {
    targetAudience: 'Car shoppers ages 25-55, lease returns, service customers',
    goals: ['Drive showroom visits', 'Generate qualified leads', 'Promote service specials'],
    competitors: ['Local dealerships', 'CarMax', 'Online car retailers'],
    uniqueSellingPoints: ['Certified pre-owned program', 'Service excellence', 'Competitive financing'],
  },
  healthcare: {
    targetAudience: 'Patients seeking treatment, insurance holders, health-conscious individuals',
    goals: ['Increase appointments', 'Build patient trust', 'Educate about services'],
    competitors: ['Local clinics', 'Hospital systems', 'Urgent care centers'],
    uniqueSellingPoints: ['Board-certified specialists', 'Advanced technology', 'Personalized care'],
  },
  retail: {
    targetAudience: 'Online shoppers, local customers, price-conscious buyers',
    goals: ['Drive online sales', 'Increase foot traffic', 'Build brand awareness'],
    competitors: ['Amazon', 'Local retailers', 'Big box stores'],
    uniqueSellingPoints: ['Quality products', 'Expert customer service', 'Competitive pricing'],
  },
  'real-estate': {
    targetAudience: 'Home buyers, sellers, investors, first-time buyers',
    goals: ['Generate listing leads', 'Find qualified buyers', 'Build agent reputation'],
    competitors: ['Other real estate agents', 'Online platforms', 'Discount brokerages'],
    uniqueSellingPoints: ['Local market expertise', 'Full-service support', 'Proven track record'],
  },
  professional: {
    targetAudience: 'Business owners, professionals seeking services, decision makers',
    goals: ['Generate qualified leads', 'Build professional reputation', 'Showcase expertise'],
    competitors: ['Other service providers', 'Large firms', 'Online platforms'],
    uniqueSellingPoints: ['Specialized expertise', 'Personalized service', 'Local presence'],
  },
};

export default function CampaignContextForm({ 
  context, 
  onChange, 
  onSubmit, 
  isGenerating 
}: CampaignContextFormProps) {
  const [newGoal, setNewGoal] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newUSP, setNewUSP] = useState('');

  const handleIndustryChange = (industry: string) => {
    const template = industryTemplates[industry as keyof typeof industryTemplates];
    if (template) {
      onChange({
        ...context,
        industry,
        targetAudience: template.targetAudience,
        goals: template.goals,
        competitors: template.competitors,
        uniqueSellingPoints: template.uniqueSellingPoints,
      });
    } else {
      onChange({ ...context, industry });
    }
  };

  const addItem = (field: 'goals' | 'competitors' | 'uniqueSellingPoints', value: string) => {
    if (value.trim()) {
      onChange({
        ...context,
        [field]: [...context[field], value.trim()],
      });
      if (field === 'goals') setNewGoal('');
      if (field === 'competitors') setNewCompetitor('');
      if (field === 'uniqueSellingPoints') setNewUSP('');
    }
  };

  const removeItem = (field: 'goals' | 'competitors' | 'uniqueSellingPoints', index: number) => {
    onChange({
      ...context,
      [field]: context[field].filter((_, i) => i !== index),
    });
  };

  const isFormValid = context.businessType && context.industry && context.targetAudience && context.budget;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building className="h-5 w-5" />
          <span>Campaign Context</span>
        </CardTitle>
        <CardDescription>
          Provide business context to generate more accurate and targeted campaign briefs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="businessType">Business Type *</Label>
            <Input
              id="businessType"
              value={context.businessType}
              onChange={(e) => onChange({ ...context, businessType: e.target.value })}
              placeholder="e.g., Car Dealership, Medical Practice"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Select value={context.industry} onValueChange={handleIndustryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automotive">Automotive</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="real-estate">Real Estate</SelectItem>
                <SelectItem value="professional">Professional Services</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAudience">Target Audience *</Label>
          <Textarea
            id="targetAudience"
            value={context.targetAudience}
            onChange={(e) => onChange({ ...context, targetAudience: e.target.value })}
            placeholder="Describe your ideal customers: demographics, interests, behaviors"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget">Monthly Budget *</Label>
            <Select 
              value={context.budget} 
              onValueChange={(value) => onChange({ ...context, budget: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select budget range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="under-1000">Under $1,000</SelectItem>
                <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                <SelectItem value="5000-10000">$5,000 - $10,000</SelectItem>
                <SelectItem value="10000-25000">$10,000 - $25,000</SelectItem>
                <SelectItem value="25000-50000">$25,000 - $50,000</SelectItem>
                <SelectItem value="over-50000">Over $50,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Geographic Location</Label>
            <Input
              id="location"
              value={context.geographicLocation}
              onChange={(e) => onChange({ ...context, geographicLocation: e.target.value })}
              placeholder="e.g., San Francisco Bay Area, Nationwide"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Campaign Goals</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {context.goals.map((goal, index) => (
              <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                <span>{goal}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeItem('goals', index)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex space-x-2">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add campaign goal"
              onKeyPress={(e) => e.key === 'Enter' && addItem('goals', newGoal)}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={() => addItem('goals', newGoal)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Main Competitors</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {context.competitors.map((competitor, index) => (
              <Badge key={index} variant="outline" className="flex items-center space-x-1">
                <span>{competitor}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeItem('competitors', index)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex space-x-2">
            <Input
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              placeholder="Add competitor"
              onKeyPress={(e) => e.key === 'Enter' && addItem('competitors', newCompetitor)}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={() => addItem('competitors', newCompetitor)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Unique Selling Points</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {context.uniqueSellingPoints.map((usp, index) => (
              <Badge key={index} variant="default" className="flex items-center space-x-1">
                <span>{usp}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeItem('uniqueSellingPoints', index)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex space-x-2">
            <Input
              value={newUSP}
              onChange={(e) => setNewUSP(e.target.value)}
              placeholder="Add unique selling point"
              onKeyPress={(e) => e.key === 'Enter' && addItem('uniqueSellingPoints', newUSP)}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={() => addItem('uniqueSellingPoints', newUSP)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seasonality">Seasonality & Timing</Label>
          <Textarea
            id="seasonality"
            value={context.seasonality}
            onChange={(e) => onChange({ ...context, seasonality: e.target.value })}
            placeholder="Any seasonal trends, timing considerations, or promotional periods"
            rows={2}
          />
        </div>

        <Button 
          onClick={onSubmit}
          disabled={!isFormValid || isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating Campaign Brief...' : 'Generate AI Campaign Brief'}
        </Button>
      </CardContent>
    </Card>
  );
}