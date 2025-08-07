import { CheckCircle } from 'lucide-react';

export default function Approvals() {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Campaign Approvals</h1>
      </div>
      
      <div className="bg-white rounded-lg border p-8 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign Approvals</h2>
        <p className="text-gray-600 mb-4">
          Campaign approval workflow interface coming soon.
        </p>
        <p className="text-sm text-gray-500">
          This will include pending approvals, review history, and approval management tools.
        </p>
      </div>
    </div>
  );
}