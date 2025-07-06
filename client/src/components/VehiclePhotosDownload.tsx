import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, ExternalLink, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VehiclePhotosResponse {
  success: boolean;
  url: string;
  message: string;
  error?: string;
}

export default function VehiclePhotosDownload() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleGeneratePhotosZip = async () => {
    setIsGenerating(true);
    setGeneratedUrl(null);
    
    try {
      const response = await fetch('/api/admin/vehicle-photos-zip', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to generate vehicle photos ZIP: ${response.statusText}`);
      }
      
      const data: VehiclePhotosResponse = await response.json();
      
      if (data.success) {
        setGeneratedUrl(data.url);
        setMessage(data.message);
        toast({
          title: 'Success',
          description: 'Vehicle photos ZIP file generated successfully',
          variant: 'default',
        });
      } else {
        throw new Error(data.error || 'Failed to generate vehicle photos ZIP');
      }
    } catch (error) {
      console.error('Error generating vehicle photos ZIP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate vehicle photos ZIP',
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
          <Image className="h-5 w-5" />
          Vehicle Photos Gallery
        </CardTitle>
        <CardDescription>
          View all vehicle photos in an organized gallery
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600 mb-4">
          This will create a gallery with all photos from all vehicles in your inventory.
          The process may take a few minutes depending on the number of vehicles and photos.
        </p>
        
        {generatedUrl && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-medium text-green-800 mb-2">
              Photo gallery created successfully!
            </p>
            <p className="text-xs text-neutral-600 mb-3">{message}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2 bg-green-100 hover:bg-green-200 border-green-300 text-green-800"
              onClick={() => window.open(generatedUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Photo Gallery
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleGeneratePhotosZip}
          disabled={isGenerating}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Photo Gallery...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Generate Vehicle Photos Gallery
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}