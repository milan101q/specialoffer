import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InspectedAutoSyncTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message?: string; error?: string } | null>(null);
  const { toast } = useToast();

  const triggerSync = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      const response = await fetch('/api/admin/trigger-inspected-auto-sync');
      const data = await response.json();
      
      if (response.ok) {
        setResult({ message: data.message });
        toast({
          title: 'Success',
          description: 'Inspected Auto sync triggered successfully!',
          variant: 'default',
        });
      } else {
        setResult({ error: data.message || data.error || 'Unknown error occurred' });
        toast({
          title: 'Error',
          description: data.message || data.error || 'Failed to trigger sync',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      setResult({ error: 'Network error occurred' });
      toast({
        title: 'Error',
        description: 'Network error occurred while triggering sync',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Inspected Auto Sync Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground">
          This tool will force a sync with Inspected Auto dealership, regardless of the last sync time.
          This is useful for testing the scraper implementation.
        </p>
        
        {result?.message && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        
        {result?.error && (
          <Alert className="mb-4 bg-red-50 border-red-200" variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={triggerSync} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            'Trigger Inspected Auto Sync'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}