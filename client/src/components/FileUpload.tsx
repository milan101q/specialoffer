import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dealership } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FileUploadProps {
  dealership: Dealership;
  isOpen: boolean;
  onClose: () => void;
}

export default function FileUpload({ dealership, isOpen, onClose }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/dealerships/${dealership.id}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload CSV file');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      toast({
        title: 'Upload Successful',
        description: data.message || `${data.count} vehicles have been uploaded`,
      });
      
      // Close the modal and reset state
      onClose();
      setFile(null);
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a CSV file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Inventory CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing vehicle inventory for {dealership.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required CSV Format</AlertTitle>
            <AlertDescription>
              Your CSV should include these columns: title, year, make, model, price, mileage, vin, location, zipCode
            </AlertDescription>
          </Alert>
          
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive ? 'border-primary-500 bg-primary-50' : 'border-neutral-300'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <Upload className={`h-10 w-10 ${dragActive ? 'text-primary-500' : 'text-neutral-400'}`} />
              <div className="flex flex-col space-y-1 text-center">
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-neutral-500">CSV files only (max 10MB)</p>
              </div>
              
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="ghost"
                onClick={() => document.getElementById('csv-upload')?.click()}
                disabled={uploadMutation.isPending}
              >
                Select File
              </Button>
            </div>
            
            {file && (
              <div className="mt-4 text-sm text-neutral-700 bg-neutral-100 p-2 rounded-md">
                Selected file: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <div className="flex items-center">
                <span className="animate-spin mr-2">
                  <i className="ri-loader-4-line"></i>
                </span>
                Uploading...
              </div>
            ) : (
              'Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
