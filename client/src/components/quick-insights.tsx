import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Clock, AlertTriangle, TrendingUp, Brain, Zap } from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

interface QuickInsightsProps {
  selectedClient?: GoogleAdsAccount | null;
}

export default function QuickInsights({ selectedClient }: QuickInsightsProps) {
  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Executive Insights</h2>
        <p className="text-sm text-slate-500 mt-1">
          {selectedClient ? `${selectedClient.name}` : 'Select a client for insights'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!selectedClient ? (
          <div className="text-center text-slate-500">
            <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Select a client to view insights</p>
          </div>
        ) : (
          <>
            {/* Immediate Actions Required */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm">Action Required</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-sm font-medium text-amber-900">Budget Overspend Risk</div>
                  <div className="text-xs text-amber-700 mt-1">Search campaigns may exceed monthly target by $8,500</div>
                  <Button size="sm" className="mt-2 h-7 text-xs">
                    Review Budget
                  </Button>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm font-medium text-blue-900">Optimization Ready</div>
                  <div className="text-xs text-blue-700 mt-1">3 campaigns ready for AI optimization</div>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                    Optimize Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Business Impact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600" />
                  <CardTitle className="text-sm">Impact Opportunities</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Potential Revenue Lift</div>
                    <div className="text-xs text-slate-600">From keyword expansion</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">+$23,400</div>
                    <div className="text-xs text-slate-500">Est. monthly</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Cost Savings</div>
                    <div className="text-xs text-slate-600">From bid optimization</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-600">-$4,200</div>
                    <div className="text-xs text-slate-500">Monthly CPC</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smart Automations */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm">AI Automations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Budget Pacing</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Bid Optimization</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm">Keyword Discovery</span>
                  </div>
                  <Badge variant="outline" className="text-xs">Ready</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                  <TrendingUp className="w-3 h-3 mr-2" />
                  Generate Performance Report
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                  <Target className="w-3 h-3 mr-2" />
                  Expand High-Performing Keywords
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                  <Clock className="w-3 h-3 mr-2" />
                  Schedule Campaign Review
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}