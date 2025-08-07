import { TrendingUp } from 'lucide-react';

export default function Performance() {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
      </div>
      
      <div className="bg-white rounded-lg border p-8 text-center">
        <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Performance Analytics</h2>
        <p className="text-gray-600 mb-4">
          Advanced performance analytics dashboard coming soon.
        </p>
        <p className="text-sm text-gray-500">
          This will include detailed performance metrics, trend analysis, and optimization recommendations.
        </p>
      </div>
    </div>
  );
}