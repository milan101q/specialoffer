import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

const dealershipSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: 'Dealership name is required' }),
  url: z.string()
    .trim()
    .min(1, { message: 'Primary URL is required' })
    .url({ message: 'Please enter a valid URL' }),
  additionalUrls: z.array(
    z.string()
      .trim()
      .min(1, { message: 'URL is required' })
      .url({ message: 'Please enter a valid URL' })
  )
    .max(10, { message: 'Maximum 10 additional URLs allowed' })
    .optional()
    .default([]),
  location: z.string()
    .trim()
    .max(100, { message: 'Location must not exceed 100 characters' })
    .optional()
    .or(z.literal(''))
});

type DealershipFormValues = z.infer<typeof dealershipSchema>;

export default function DealershipForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [additionalUrlCount, setAdditionalUrlCount] = useState(0);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const form = useForm<DealershipFormValues>({
    resolver: zodResolver(dealershipSchema),
    defaultValues: {
      name: '',
      url: '',
      additionalUrls: [],
      location: ''
    }
  });

  const additionalUrls = form.watch('additionalUrls') || [];

  const addUrlField = () => {
    if (additionalUrls.length < 10) {
      const newUrls = [...additionalUrls, ''];
      form.setValue('additionalUrls', newUrls);
      setAdditionalUrlCount(additionalUrlCount + 1);
    } else {
      toast({
        title: 'Maximum URLs reached',
        description: 'You can add up to 10 additional URLs',
        variant: 'destructive',
      });
    }
  };

  const removeUrlField = (index: number) => {
    const newUrls = [...additionalUrls];
    newUrls.splice(index, 1);
    form.setValue('additionalUrls', newUrls);
    setAdditionalUrlCount(additionalUrlCount - 1);
  };

  const onSubmit = async (data: DealershipFormValues) => {
    setIsSubmitting(true);
    try {
      // Filter out empty additional URLs
      const filteredAdditionalUrls = (data.additionalUrls || []).filter(url => url.trim() !== '');
      
      const response = await apiRequest('POST', '/api/dealerships', {
        name: data.name,
        url: data.url,
        additionalUrls: filteredAdditionalUrls,
        location: data.location || undefined
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add dealership');
      }
      
      // Reset form
      form.reset();
      setAdditionalUrlCount(0);
      
      // Refresh dealership list
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      toast({
        title: 'Dealership Added',
        description: 'New dealership has been added and scraping has started',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className={cn(isMobile ? "px-4 py-3" : "")}>
        <CardTitle className={cn(
          "text-neutral-900",
          isMobile ? "text-lg" : "text-xl"
        )}>
          Add New Dealership
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(isMobile ? "px-4 py-2" : "")}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={cn(isMobile ? "space-y-1.5" : "")}>
                    <FormLabel className={cn(isMobile ? "text-sm" : "")}>
                      Dealership Name
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ABC Motors" 
                        className={cn(isMobile ? "h-8 text-sm" : "")}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className={cn(isMobile ? "text-xs" : "")} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem className={cn(isMobile ? "space-y-1.5" : "")}>
                    <FormLabel className={cn(isMobile ? "text-sm" : "")}>
                      Dealership Website URL
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example-dealer.com" 
                        className={cn(isMobile ? "h-8 text-sm" : "")}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className={cn(isMobile ? "text-xs" : "")} />
                  </FormItem>
                )}
              />
            </div>
            {/* Additional URLs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={cn(
                  "font-medium text-neutral-900",
                  isMobile ? "text-sm" : ""
                )}>
                  Additional Inventory URLs
                </h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size={isMobile ? "sm" : "default"}
                  onClick={addUrlField}
                  className="text-xs"
                  disabled={additionalUrls.length >= 10}
                >
                  <span className="flex items-center">
                    <i className="ri-add-line mr-1"></i>
                    Add URL
                  </span>
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {additionalUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`additionalUrls.${index}`}
                      render={({ field }) => (
                        <FormItem className="flex-1 mb-0">
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input 
                                placeholder={`Inventory Link ${index + 1}`}
                                className={cn(isMobile ? "h-8 text-sm" : "")}
                                {...field} 
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeUrlField(index)}
                                className="h-8 w-8"
                              >
                                <i className="ri-delete-bin-line text-red-500"></i>
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className={cn(isMobile ? "text-xs" : "")} />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                
                {additionalUrls.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add additional inventory page URLs (e.g., page=1, page=2) to ensure all vehicles are scraped. Maximum 10 URLs allowed.
                  </p>
                )}
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className={cn(isMobile ? "space-y-1.5" : "")}>
                  <FormLabel className={cn(isMobile ? "text-sm" : "")}>
                    Location
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Chantilly, VA" 
                      className={cn(isMobile ? "h-8 text-sm" : "")}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className={cn(isMobile ? "text-xs" : "")} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the dealership location to be displayed on vehicle cards (e.g., "Chantilly, VA")
                  </p>
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className={cn(
                "w-full",
                isMobile ? "mt-1 h-9 text-sm" : "mt-2"
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <i className={cn(
                    "ri-loader-4-line animate-spin",
                    isMobile ? "mr-1 text-sm" : "mr-2"
                  )}></i>
                  Adding...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className={cn(
                    "ri-add-line",
                    isMobile ? "mr-1 text-sm" : "mr-2"
                  )}></i>
                  {isMobile ? "Add Dealership" : "Add & Start Scraping"}
                </span>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
