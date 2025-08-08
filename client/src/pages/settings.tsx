import { Settings as SettingsIcon } from 'lucide-react';
import { GoogleAdsTestButton } from '@/components/GoogleAdsTestButton';

export default function Settings() {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>
      
      <div className="space-y-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Google Ads API Connection Test</h2>
          <p className="text-gray-600 mb-4">
            Test your live Google Ads API connection to verify credentials and access to real customer accounts.
          </p>
          <GoogleAdsTestButton />
        </div>
        
        <div className="bg-white rounded-lg border p-8 text-center">
          <SettingsIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Additional Settings</h2>
          <p className="text-gray-600 mb-4">
            Account and platform settings interface coming soon.
          </p>
          <p className="text-sm text-gray-500">
            This will include user preferences, API configurations, and system settings.
          </p>
        </div>
      </div>
    </div>
  );
}