import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface VehicleCardResponse {
  success: boolean;
  url: string;
  message: string;
  fileCount: number;
  error?: string;
}

interface StatsData {
  totalVehicles: number;
  totalDealerships: number;
  contactClicks: number;
  lastSynced: string | null;
}

export default function VehicleCardsDownload() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  interface StatsData {
    totalVehicles: number;
    totalDealerships: number;
    contactClicks: number;
    lastSynced: string | null;
  }

  const { data: stats } = useQuery<StatsData>({
    queryKey: ['/api/stats'],
  });

  const handleGenerateCards = async () => {
    setIsGenerating(true);
    setGeneratedUrl(null);
    
    try {
      const response = await fetch('/api/admin/vehicle-cards', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to generate vehicle cards: ${response.statusText}`);
      }
      
      const data: VehicleCardResponse = await response.json();
      
      if (data.success) {
        setGeneratedUrl(data.url);
        setFileCount(data.fileCount);
        setMessage(data.message);
        toast({
          title: 'Success',
          description: 'Vehicle card HTML files generated successfully',
          variant: 'default',
        });
      } else {
        throw new Error(data.error || 'Failed to generate vehicle cards');
      }
    } catch (error) {
      console.error('Error generating vehicle cards:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate vehicle cards',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Vehicle Cards Download
        </CardTitle>
        <CardDescription>
          Generate HTML files for all vehicle cards that can be easily viewed and saved
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600 mb-4">
          Generate HTML files for all vehicle cards (up to 200) with their images and details. 
          These can be used for review, screenshots, or sharing with clients.
        </p>
        
        {stats && (
          <p className="text-sm font-medium mb-2">
            Total vehicles available: {stats.totalVehicles}
          </p>
        )}
        
        {generatedUrl && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Generated {fileCount} vehicle card files
            </p>
            <p className="text-xs text-neutral-600 mb-3">{message}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2"
              onClick={() => window.open(generatedUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Generated Cards
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleGenerateCards}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate Vehicle Cards
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}