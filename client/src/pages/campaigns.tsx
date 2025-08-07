import { BarChart3 } from 'lucide-react';

export default function Campaigns() {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Campaign Management</h1>
      </div>
      
      <div className="bg-white rounded-lg border p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign Management</h2>
        <p className="text-gray-600 mb-4">
          Comprehensive campaign management interface coming soon.
        </p>
        <p className="text-sm text-gray-500">
          This will include campaign creation, editing, optimization tools, and performance analytics.
        </p>
      </div>
    </div>
  );
}