import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/sidebar';
import QuickInsights from '@/components/quick-insights';
import ChatInterface from '@/components/chat-interface';
import CampaignApprovalModal from '@/components/campaign-approval-modal';
import EscalationSettings from '@/components/escalation-settings';
import type { GoogleAdsAccount } from '@shared/schema';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedClient, setSelectedClient] = useState<GoogleAdsAccount | null>(null);
  const [activeView, setActiveView] = useState('chat');

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
    if (activeView === 'escalation') {
      return <EscalationSettings selectedClient={selectedClient} />;
    }
    
    return (
      <div className="flex-1 flex overflow-hidden">
        <QuickInsights selectedClient={selectedClient} />
        <ChatInterface selectedClient={selectedClient} />
      </div>
    );
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
