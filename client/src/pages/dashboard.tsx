import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useEffect, lazy, Suspense } from 'react';
import Sidebar from '@/components/sidebar';

// Lazy load heavy dashboard components
const QuickInsights = lazy(() => import('@/components/quick-insights'));
const ChatInterface = lazy(() => import('@/components/chat-interface'));
const CampaignApprovalModal = lazy(() => import('@/components/campaign-approval-modal'));

// Component loading fallback
function ComponentLoader({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-6 h-6 bg-slate-300 rounded animate-pulse mx-auto mb-2"></div>
        <p className="text-sm text-slate-500">Loading {name}...</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

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

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <Suspense fallback={<ComponentLoader name="Insights" />}>
            <QuickInsights />
          </Suspense>
          <Suspense fallback={<ComponentLoader name="Chat" />}>
            <ChatInterface />
          </Suspense>
        </div>
      </div>
      
      <Suspense fallback={null}>
        <CampaignApprovalModal />
      </Suspense>
    </div>
  );
}
