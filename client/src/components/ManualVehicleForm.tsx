import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { TrashIcon, UploadIcon, PlusIcon, CarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dealership } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

// Define form schema
const manualVehicleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  year: z.coerce.number().min(1900, "Year must be at least 1900"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  price: z.coerce.number().min(1, "Price must be greater than 0"),
  mileage: z.coerce.number().min(0, "Mileage must be a positive number"),
  vin: z.string().min(17, "VIN must be at least 17 characters"),
  carfaxUrl: z.string().optional(),
  contactUrl: z.string().optional(),
  originalListingUrl: z.string().optional(),
  dealershipId: z.number()
});

type ManualVehicleFormValues = z.infer<typeof manualVehicleSchema>;

export default function ManualVehicleForm() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get dealerships for the select dropdown
  const { data: dealerships } = useQuery<Dealership[]>({
    queryKey: ['/api/dealerships'],
  });

  // Filter to only show Inspected Auto dealership
  const inspectedAutoDealership = dealerships?.find(d => d.name === 'Inspected Auto');
  
  const form = useForm<ManualVehicleFormValues>({
    resolver: zodResolver(manualVehicleSchema),
    defaultValues: {
      title: '',
      year: 0,
      make: '',
      model: '',
      price: 0,
      mileage: 0,
      vin: '',
      carfaxUrl: '',
      contactUrl: '',
      originalListingUrl: '',
      dealershipId: inspectedAutoDealership?.id || 0
    },
  });

  const addVehicleMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/admin/vehicles/add-manual', {
        method: 'POST',
        body: data,
      } as RequestInit);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({
        title: 'Vehicle Added',
        description: 'The vehicle has been successfully added.',
      });
      form.reset();
      setPhotos([]);
      setPhotoUrls([]);
      setUploading(false);
    },
    onError: (error) => {
      toast({
        title: 'Error Adding Vehicle',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      setUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (photos.length + newFiles.length > 24) {
        toast({
          title: 'Too Many Photos',
          description: 'You can upload a maximum of 24 photos.',
          variant: 'destructive',
        });
        return;
      }

      // Create URLs for preview
      const newUrls = newFiles.map(file => URL.createObjectURL(file));
      setPhotos([...photos, ...newFiles]);
      setPhotoUrls([...photoUrls, ...newUrls]);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    const newUrls = [...photoUrls];
    
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newUrls[index]);
    
    newPhotos.splice(index, 1);
    newUrls.splice(index, 1);
    
    setPhotos(newPhotos);
    setPhotoUrls(newUrls);
  };

  const onSubmit = async (values: ManualVehicleFormValues) => {
    if (!inspectedAutoDealership) {
      toast({
        title: 'Error',
        description: 'Inspected Auto dealership not found.',
        variant: 'destructive',
      });
      return;
    }

    if (photos.length === 0) {
      toast({
        title: 'Photos Required',
        description: 'Please upload at least one photo.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    // Prepare form data for file upload
    const formData = new FormData();
    
    // Add vehicle data
    formData.append('title', `${values.year} ${values.make} ${values.model}`);
    formData.append('year', values.year.toString());
    formData.append('make', values.make);
    formData.append('model', values.model);
    formData.append('price', values.price.toString());
    formData.append('mileage', values.mileage.toString());
    formData.append('vin', values.vin);
    formData.append('dealershipId', inspectedAutoDealership.id.toString());
    formData.append('location', 'Chantilly, VA');
    formData.append('zipCode', '20151');
    
    // Add optional fields if provided
    if (values.carfaxUrl) formData.append('carfaxUrl', values.carfaxUrl);
    if (values.contactUrl) formData.append('contactUrl', values.contactUrl);
    if (values.originalListingUrl) {
      formData.append('originalListingUrl', values.originalListingUrl);
    } else {
      formData.append('originalListingUrl', 'https://inspectedauto.com');
    }

    // Add photos
    photos.forEach((file, index) => {
      formData.append(`photos`, file);
    });

    try {
      await addVehicleMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Error adding vehicle:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CarIcon className="w-5 h-5" />
          Add Vehicle for Inspected Auto
        </CardTitle>
        <CardDescription>
          Manually add vehicle listings with up to 24 photos for the Inspected Auto dealership.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2023" 
                        value={value === 0 ? '' : String(value)}
                        onChange={(e) => onChange(Number(e.target.value))} 
                        {...rest}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input placeholder="Toyota" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Camry" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="25000" 
                        value={value === 0 ? '' : String(value)}
                        onChange={(e) => onChange(Number(e.target.value))} 
                        {...rest}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mileage"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Mileage</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="15000" 
                        value={value === 0 ? '' : String(value)}
                        onChange={(e) => onChange(Number(e.target.value))} 
                        {...rest}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VIN</FormLabel>
                    <FormControl>
                      <Input placeholder="1HGBH41JXMN109186" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="carfaxUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carfax URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.carfax.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact URL (Required for Inspected Auto)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://inspectedauto.com/contact/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="originalListingUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Original Listing URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://inspectedauto.com/vehicle/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photo Upload Section */}
            <div className="mt-6">
              <h3 className="font-medium mb-2">Vehicle Photos (Max 24)</h3>
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  id="vehicle-photos"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={photos.length >= 24 || uploading}
                />
                <label
                  htmlFor="vehicle-photos"
                  className="flex flex-col items-center justify-center h-32 cursor-pointer"
                >
                  <UploadIcon className="w-10 h-10 text-neutral-400 mb-2" />
                  <span className="text-sm text-neutral-500">
                    {photos.length === 0
                      ? 'Click to upload vehicle photos'
                      : `${photos.length} photo${photos.length !== 1 ? 's' : ''} selected (Click to add more)`}
                  </span>
                  <span className="text-xs text-neutral-400 mt-1">
                    {photos.length >= 24 ? 'Maximum 24 photos reached' : 'JPG, PNG, WEBP up to 10MB each'}
                  </span>
                </label>
              </div>

              {/* Photo Previews */}
              {photoUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
                  {photoUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-video rounded-md overflow-hidden border border-neutral-200">
                        <img
                          src={url}
                          alt={`Vehicle photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="mt-4 w-full"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Add Vehicle'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}