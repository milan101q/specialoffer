import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface SiteSetting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export default function SiteSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch site settings
  const { data: settings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ['/api/admin/settings'],
  });
  
  // Update a setting
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('POST', '/api/admin/settings', { key, value });
    },
    onSuccess: () => {
      // Invalidate both admin and public settings queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: 'Setting updated',
        description: 'The site setting has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: `Error updating setting: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Find the showListDealershipButton setting
  const listDealershipSetting = settings?.find(s => s.key === 'showListDealershipButton');
  const showListDealershipButton = listDealershipSetting ? listDealershipSetting.value === 'true' : true;
  
  // Toggle the List Dealership button visibility
  const handleToggleListButton = () => {
    updateSettingMutation.mutate({ 
      key: 'showListDealershipButton', 
      value: showListDealershipButton ? 'false' : 'true' 
    });
  };
  
  // Format the last updated date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
          <CardDescription>Loading site settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>
          Configure site-wide settings and features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col space-y-4">
          <div className="border p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">List Your Dealership Button</h4>
                  <Badge variant={showListDealershipButton ? "default" : "secondary"}>
                    {showListDealershipButton ? "Visible" : "Hidden"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Control visibility of the "List Your Dealership" button on the home page
                </p>
                {listDealershipSetting?.updatedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last updated: {formatDate(listDealershipSetting.updatedAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="list-dealership-toggle"
                  checked={showListDealershipButton}
                  onCheckedChange={handleToggleListButton}
                  disabled={updateSettingMutation.isPending}
                />
                <Label htmlFor="list-dealership-toggle">
                  {showListDealershipButton ? "On" : "Off"}
                </Label>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}