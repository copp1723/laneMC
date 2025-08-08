import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, TestTube } from 'lucide-react';

interface TestResult {
  success: boolean;
  timestamp: string;
  results?: {
    accessibleCustomers: string[];
    customerTests: Array<{
      customerId: string;
      status: 'success' | 'error';
      info?: any;
      error?: string;
    }>;
  };
  summary?: {
    totalAccessibleCustomers: number;
    successfulCustomers: number;
  };
  error?: string;
  suggestion?: string;
}

export function GoogleAdsTestButton() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/google-ads/test-connection', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Network error - could not reach server'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={testConnection}
        disabled={testing}
        className="w-full"
        variant="outline"
      >
        <TestTube className="w-4 h-4 mr-2" />
        {testing ? 'Testing Google Ads API...' : 'Test Live Google Ads Connection'}
      </Button>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              Google Ads API Test Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-500">
              {new Date(result.timestamp).toLocaleString()}
            </div>

            {result.success ? (
              <div className="space-y-3">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    Accessible Customers: {result.summary?.totalAccessibleCustomers || 0}
                  </Badge>
                  <div className="text-sm space-y-1">
                    {result.results?.accessibleCustomers.map(id => (
                      <div key={id} className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        {id}
                      </div>
                    ))}
                  </div>
                </div>

                {result.results?.customerTests && (
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      Customer Info Tests: {result.summary?.successfulCustomers} / {result.results.customerTests.length}
                    </Badge>
                    <div className="space-y-2">
                      {result.results.customerTests.map(test => (
                        <div key={test.customerId} className="text-sm p-2 border rounded">
                          <div className="font-mono text-xs">{test.customerId}</div>
                          {test.status === 'success' ? (
                            <div className="text-green-600 text-xs">
                              ✅ {test.info?.name || 'Success'}
                            </div>
                          ) : (
                            <div className="text-red-600 text-xs">
                              ❌ {test.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-red-600 font-medium">
                  {result.error}
                </div>
                {result.suggestion && (
                  <div className="text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border">
                    <strong>Suggestion:</strong> {result.suggestion}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}