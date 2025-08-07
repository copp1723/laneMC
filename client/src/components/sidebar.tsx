import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import ClientSelector from './client-selector';
import { 
  MessageSquare, 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  Settings,
  LogOut
} from 'lucide-react';

const navigationItems = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, active: true },
  { id: 'campaigns', label: 'Campaigns', icon: BarChart3 },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [activeItem, setActiveItem] = useState('chat');

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo and Brand */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Lane MCP</h1>
            <p className="text-xs text-slate-500">Google Ads Platform</p>
          </div>
        </div>
      </div>

      {/* Client Selector */}
      <div className="p-4 border-b border-slate-200">
        <ClientSelector />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveItem(item.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-primary border-r-2 border-primary'
                      : 'text-slate-700 hover:bg-slate-100'
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
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
              <span className="text-slate-600 text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role || 'User'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-500 hover:text-slate-700"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
