import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/sidebar';
import QuickInsights from '@/components/quick-insights';
import ChatInterface from '@/components/chat-interface';
import CampaignApprovalModal from '@/components/campaign-approval-modal';
import EscalationSettings from '@/components/escalation-settings';
import BudgetPacingCard from '@/components/budget-pacing-card';
import MonitoringCard from '@/components/monitoring-card';
import SchedulerCard from '@/components/scheduler-card';
import CampaignGenerationCard from '@/components/campaign-generation-card';
import Campaigns from './campaigns';
import Performance from './performance';
import Approvals from './approvals';
import Settings from './settings';
import type { GoogleAdsAccount } from '@shared/schema';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedClient, setSelectedClient] = useState<GoogleAdsAccount | null>(null);
  const [activeView, setActiveView] = useState('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderMainContent = () => {
    switch (activeView) {
      case 'escalation':
        return <EscalationSettings selectedClient={selectedClient} />;
      case 'automation':
        return (
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BudgetPacingCard selectedClient={selectedClient} />
              <MonitoringCard selectedClient={selectedClient} />
              <SchedulerCard />
              <CampaignGenerationCard 
                selectedClient={selectedClient} 
                currentSessionId={currentSessionId}
              />
            </div>
          </div>
        );
      case 'campaigns':
        return <Campaigns />;
      case 'performance':
        return <Performance />;
      case 'approvals':
        return <Approvals />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <div className="flex-1 flex overflow-hidden">
            <QuickInsights selectedClient={selectedClient} />
            <ChatInterface 
              selectedClient={selectedClient} 
              onSessionChange={setCurrentSessionId}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar 
        selectedClient={selectedClient} 
        onClientChange={setSelectedClient}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderMainContent()}
      </div>
      
      <CampaignApprovalModal />
    </div>
  );
}
