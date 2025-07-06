import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ExternalLink, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function VehicleCardImagesDownload() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const cardImagesMutation = useMutation({
    mutationFn: async () => {
      // Use fetch directly instead of apiRequest since we need GET with specific options
      const response = await fetch('/api/admin/vehicle-card-images', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate vehicle card images');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedUrl(data.url);
      setMessage(data.message);
      setIsGenerating(false);
      toast({
        title: 'Success!',
        description: 'Vehicle card images are ready for download.',
        variant: 'default',
      });
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate vehicle card images',
        variant: 'destructive',
      });
    }
  });

  const handleGenerateCardImages = () => {
    setIsGenerating(true);
    cardImagesMutation.mutate();
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-100 to-cyan-100">
        <CardTitle className="text-blue-800">Vehicle Card Images</CardTitle>
        <CardDescription>Download all vehicle card images for offline use or marketing materials</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This tool creates a downloadable page with all vehicle card images. Use this for:
          </p>
          <ul className="text-sm list-disc list-inside text-gray-600 ml-2 space-y-1">
            <li>Marketing materials and brochures</li>
            <li>Social media posts</li>
            <li>Print advertisements</li>
            <li>Email marketing campaigns</li>
          </ul>
        </div>
        
        {generatedUrl && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-medium text-green-800 mb-2">
              Card images are ready!
            </p>
            <p className="text-xs text-neutral-600 mb-3">{message}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2 bg-green-100 hover:bg-green-200 border-green-300 text-green-800"
              onClick={() => window.open(generatedUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Card Images
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-800 mt-2"
              onClick={() => window.open('/api/admin/direct-cards-download', '_blank')}
            >
              <Download className="h-4 w-4" />
              Direct Download (Alternative)
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleGenerateCardImages}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Card Images...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Download Vehicle Card Images
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}