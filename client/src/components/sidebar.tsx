import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import ClientSelector from '@/components/client-selector';
import { 
  MessageSquare, 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  Settings,
  LogOut,
  Bot,
  Zap
} from 'lucide-react';
import type { GoogleAdsAccount } from '@shared/schema';

const navigationItems = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, active: true },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'campaigns', label: 'Campaigns', icon: BarChart3 },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'escalation', label: 'Escalation', icon: Settings },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  selectedClient?: GoogleAdsAccount | null;
  onClientChange?: (client: GoogleAdsAccount | null) => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export default function Sidebar({ selectedClient, onClientChange, activeView = 'chat', onViewChange }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-300 flex flex-col">
      {/* Logo and Brand */}
      <div className="flex items-center justify-between p-6 border-b border-slate-600">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Lane MCP</h1>
            <p className="text-xs text-slate-400">Automation Platform</p>
          </div>
        </div>
      </div>

      {/* Client Selector */}
      <div className="p-4 border-b border-slate-600">
        <ClientSelector onClientChange={onClientChange} />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange?.(item.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-slate-300 text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-slate-400 capitalize">
                {user?.role || 'User'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-400 hover:text-slate-200"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
