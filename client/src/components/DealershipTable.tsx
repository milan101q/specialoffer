import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dealership } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Trash2, RefreshCw, FileUp, Edit, ExternalLink, Calendar, Clock, X, Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DealershipTableProps {
  onOpenUploadModal: (dealership: Dealership) => void;
}

export default function DealershipTable({ onOpenUploadModal }: DealershipTableProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealershipToDelete, setDealershipToDelete] = useState<Dealership | null>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [dealershipToRenew, setDealershipToRenew] = useState<Dealership | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dealershipToEdit, setDealershipToEdit] = useState<Dealership | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAdditionalUrls, setEditAdditionalUrls] = useState<string[]>([]);

  // Fetch dealerships
  const { data: dealerships, isLoading } = useQuery<Dealership[]>({
    queryKey: ['/api/dealerships'],
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/dealerships/${id}/sync`);
      const data = await response.json();
      
      // Handle forbidden (expired) status but don't throw an error
      // so we can handle it in onSuccess with a specific message
      if (response.status === 403) {
        return data;
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync dealership');
      }
      
      return data;
    },
    onSuccess: (data) => {
      // Check if this is an expired dealership response
      if (data.status === 'expired') {
        toast({
          title: 'Cannot Sync Expired Dealership',
          description: 'This dealership has expired and needs to be renewed before syncing.',
          variant: 'destructive',
        });
        
        // Update the dealership in the cache to show as expired
        queryClient.setQueryData(
          ['/api/dealerships'], 
          (oldData: Dealership[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(d => 
              d.id === data.dealership.id 
                ? { ...d, status: 'expired' } 
                : d
            );
          }
        );
      } else {
        toast({
          title: 'Sync initiated',
          description: 'Dealership sync process has started',
        });
        
        // Refetch dealerships after a short delay to get the updated sync status
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
        }, 5000);
      }
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
      
      // Invalidate cache to get the actual state from the server
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/dealerships/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete dealership');
      }
      const data = await response.json();
      return { id, ...data };
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/dealerships'] });
      
      // Snapshot the previous value
      const previousDealerships = queryClient.getQueryData<Dealership[]>(['/api/dealerships']);
      
      // Optimistically update the dealership list
      if (previousDealerships) {
        queryClient.setQueryData(
          ['/api/dealerships'],
          previousDealerships.filter(dealership => dealership.id !== id)
        );
      }
      
      return { previousDealerships };
    },
    onSuccess: (result) => {
      // We don't need to invalidate as we've already updated the cache optimistically
      // But we do update stats since that will have changed
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: 'Dealership deleted',
        description: 'Dealership and all its vehicles have been removed',
      });
      setDeleteDialogOpen(false);
    },
    onError: (error, id, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDealerships) {
        queryClient.setQueryData(['/api/dealerships'], context.previousDealerships);
      }
      
      toast({
        title: 'Deletion failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setDeleteDialogOpen(false);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync with server
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
    }
  });

  // Full sync mutation
  const fullSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sync`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start full sync');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Full sync initiated',
        description: 'All dealerships are being synced in the background',
      });
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  });
  
  // Renew dealership subscription mutation
  const renewMutation = useMutation({
    mutationFn: async ({ id, days }: { id: number, days: number }) => {
      const response = await apiRequest('POST', `/api/dealerships/${id}/renew`, { days });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to renew dealership subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
      toast({
        title: 'Subscription renewed',
        description: 'Dealership subscription has been successfully renewed',
      });
      setRenewDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Renewal failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setRenewDialogOpen(false);
    }
  });
  
  // Edit dealership mutation
  const editDealershipMutation = useMutation({
    mutationFn: async ({ 
      id, 
      url, 
      location, 
      additionalUrls 
    }: { 
      id: number, 
      url?: string, 
      location?: string, 
      additionalUrls?: string[] 
    }) => {
      const updateData: { 
        url?: string, 
        location?: string, 
        additional_urls?: string[] 
      } = {};
      
      if (url !== undefined) updateData.url = url;
      if (location !== undefined) updateData.location = location;
      if (additionalUrls !== undefined) updateData.additional_urls = additionalUrls;
      
      const response = await apiRequest('PATCH', `/api/dealerships/${id}`, updateData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update dealership');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dealerships'] });
      toast({
        title: 'Dealership updated',
        description: 'Dealership information has been successfully updated',
      });
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  });

  const handleSyncClick = (dealership: Dealership) => {
    // Optimistically update the dealership status in the client state
    queryClient.setQueryData(['/api/dealerships'], (oldData: Dealership[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(d => 
        d.id === dealership.id 
          ? { ...d, status: 'syncing' }
          : d
      );
    });
    
    syncMutation.mutate(dealership.id);
  };

  const handleDeleteClick = (dealership: Dealership) => {
    setDealershipToDelete(dealership);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (dealershipToDelete) {
      deleteMutation.mutate(dealershipToDelete.id);
    }
  };

  const handleUploadClick = (dealership: Dealership) => {
    onOpenUploadModal(dealership);
  };

  const handleRefreshAll = () => {
    // Optimistically update all dealerships to syncing state in the client state
    queryClient.setQueryData(['/api/dealerships'], (oldData: Dealership[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(d => ({ ...d, status: 'syncing' }));
    });
    
    fullSyncMutation.mutate();
  };
  
  const handleRenewClick = (dealership: Dealership) => {
    setDealershipToRenew(dealership);
    setRenewDialogOpen(true);
  };
  
  const confirmRenew = (days: number) => {
    if (dealershipToRenew) {
      renewMutation.mutate({ id: dealershipToRenew.id, days });
    }
  };
  
  const handleEditClick = (dealership: Dealership) => {
    setDealershipToEdit(dealership);
    setEditUrl(dealership.url);
    setEditLocation(dealership.location || '');
    setEditAdditionalUrls(dealership.additionalUrls || []);
    setEditDialogOpen(true);
  };
  
  const confirmEdit = () => {
    if (dealershipToEdit) {
      editDealershipMutation.mutate({ 
        id: dealershipToEdit.id, 
        url: editUrl,
        location: editLocation,
        additionalUrls: editAdditionalUrls
      });
    }
  };

  const formatDate = (date?: Date | string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    
    // Check if date is today
    const today = new Date();
    const isToday = d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Today, ${d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
    
    // Check if date is yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) {
      return `Yesterday, ${d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
    
    // Otherwise show full date
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Mobile friendly short date format
  const formatShortDate = (date?: Date | string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    
    // Check if date is today
    const today = new Date();
    const isToday = d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Today`;
    }
    
    // Check if date is yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) {
      return `Yesterday`;
    }
    
    // Otherwise show short date
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'syncing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to extract domain from a URL
  const getDomainFromUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  // Mobile card view for dealerships
  const renderMobileView = () => {
    if (isLoading) {
      return (
        <div className="p-6 text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
          <p className="mt-2 text-sm text-neutral-600">Loading dealerships...</p>
        </div>
      );
    }

    if (!dealerships || dealerships.length === 0) {
      return (
        <div className="p-6 text-center">
          <p className="text-sm text-neutral-600">No dealerships added yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 p-3">
        {dealerships.map((dealership) => (
          <Card key={dealership.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm truncate">{dealership.name}</h3>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getStatusBadgeClass(dealership.status)}`}>
                  {dealership.status.charAt(0).toUpperCase() + dealership.status.slice(1)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-neutral-600 mb-2">
                <div className="flex items-center">
                  <ExternalLink className="h-3 w-3 mr-1 opacity-60" />
                  <span className="truncate">{getDomainFromUrl(dealership.url)}</span>
                </div>
                <div className="text-right">
                  {dealership.vehicleCount} {dealership.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                </div>
                <div className="flex items-center">
                  <RefreshCw className="h-3 w-3 mr-1 opacity-60" />
                  <span>{formatShortDate(dealership.lastSynced)}</span>
                </div>
                <div className={`flex items-center justify-end ${
                  dealership.expirationDate 
                    ? new Date(dealership.expirationDate) < new Date() 
                      ? "text-red-600" 
                      : new Date(dealership.expirationDate) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) 
                        ? "text-amber-600"
                        : "text-green-600"
                    : "text-neutral-500"
                }`}>
                  <Calendar className="h-3 w-3 mr-1 opacity-80" />
                  <span>
                    {dealership.expirationDate 
                      ? formatShortDate(dealership.expirationDate)
                      : "No expiration"}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end space-x-1 mt-1 border-t pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-blue-500 hover:text-blue-700" 
                  onClick={() => handleSyncClick(dealership)}
                  disabled={syncMutation.isPending && syncMutation.variables === dealership.id}
                >
                  {syncMutation.isPending && syncMutation.variables === dealership.id ? (
                    <i className="ri-loader-4-line animate-spin text-xs mr-1"></i>
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  <span className="text-xs">Sync</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-neutral-500 hover:text-neutral-700" 
                  onClick={() => handleUploadClick(dealership)}
                >
                  <FileUp className="h-3 w-3 mr-1" />
                  <span className="text-xs">Upload</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-orange-500 hover:text-orange-700" 
                  onClick={() => handleEditClick(dealership)}
                  disabled={editDealershipMutation.isPending}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  <span className="text-xs">Edit</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-green-600 hover:text-green-800" 
                  onClick={() => handleRenewClick(dealership)}
                  disabled={renewMutation.isPending && renewMutation.variables?.id === dealership.id}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  <span className="text-xs">Renew</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-red-500 hover:text-red-700" 
                  onClick={() => handleDeleteClick(dealership)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  <span className="text-xs">Delete</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Desktop table view
  const renderDesktopView = () => (
    <div className="overflow-x-auto">
      {isLoading ? (
        <div className="p-8 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
          <p className="mt-2 text-neutral-600">Loading dealerships...</p>
        </div>
      ) : dealerships && dealerships.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dealership</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Vehicles</TableHead>
              <TableHead>Last Synced</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dealerships.map((dealership) => (
              <TableRow key={dealership.id}>
                <TableCell className="font-medium">{dealership.name}</TableCell>
                <TableCell className="truncate max-w-xs">{dealership.url}</TableCell>
                <TableCell>{dealership.vehicleCount}</TableCell>
                <TableCell>{formatDate(dealership.lastSynced)}</TableCell>
                <TableCell>
                  {dealership.expirationDate ? (
                    <div className={`flex items-center gap-1 ${
                      new Date(dealership.expirationDate) < new Date() 
                        ? "text-red-600" 
                        : new Date(dealership.expirationDate) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) 
                          ? "text-amber-600"
                          : "text-green-600"
                    }`}>
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(dealership.expirationDate)}</span>
                    </div>
                  ) : (
                    <span className="text-neutral-500">No expiration</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(dealership.status)}`}>
                    {dealership.status.charAt(0).toUpperCase() + dealership.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-blue-500 hover:text-blue-700" 
                      title="Sync"
                      onClick={() => handleSyncClick(dealership)}
                      disabled={syncMutation.isPending && syncMutation.variables === dealership.id}
                    >
                      {syncMutation.isPending && syncMutation.variables === dealership.id ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-neutral-500 hover:text-neutral-700" 
                      title="Upload CSV"
                      onClick={() => handleUploadClick(dealership)}
                    >
                      <FileUp className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-orange-500 hover:text-orange-700" 
                      title="Edit URL"
                      onClick={() => handleEditClick(dealership)}
                      disabled={editDealershipMutation.isPending}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-green-600 hover:text-green-800" 
                      title="Renew Subscription"
                      onClick={() => handleRenewClick(dealership)}
                      disabled={renewMutation.isPending && renewMutation.variables?.id === dealership.id}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700" 
                      title="Delete"
                      onClick={() => handleDeleteClick(dealership)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-8 text-center">
          <p className="text-neutral-600">No dealerships added yet.</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className={cn(
          "flex justify-between items-center border-b",
          isMobile ? "p-4" : "p-6"
        )}>
          <h2 className={cn(
            "font-bold text-neutral-900",
            isMobile ? "text-base" : "text-xl"
          )}>Connected Dealerships</h2>
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className={cn(
                "flex items-center text-primary-500",
                isMobile && "h-8 text-xs"
              )}
              onClick={handleRefreshAll}
              disabled={fullSyncMutation.isPending}
            >
              {fullSyncMutation.isPending ? (
                <i className={cn(
                  "ri-loader-4-line animate-spin",
                  isMobile ? "mr-1 text-xs" : "mr-1.5"
                )}></i>
              ) : (
                <RefreshCw className={cn(
                  isMobile ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1.5"
                )} />
              )}
              {isMobile ? "Sync All" : "Refresh All"}
            </Button>
          </div>
        </div>
        
        {isMobile ? renderMobileView() : renderDesktopView()}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className={cn(isMobile && "w-[95%] max-w-sm p-4")}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isMobile && "text-lg")}>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className={cn(isMobile && "text-sm")}>
              This will permanently delete {dealershipToDelete?.name} and all its vehicles from the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isMobile && "flex-col space-y-2")}>
            <AlertDialogCancel className={cn(isMobile && "mt-0")}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Dealership'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit Dealership dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className={cn(isMobile && "w-[95%] max-w-sm p-4")}>
          <DialogHeader>
            <DialogTitle className={cn(isMobile && "text-lg")}>Edit Dealership</DialogTitle>
            <DialogDescription className={cn(isMobile && "text-sm")}>
              Update the information for {dealershipToEdit?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dealership-url">Primary Dealership URL</Label>
              <Input 
                id="dealership-url" 
                value={editUrl} 
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://example.com/inventory"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Additional Inventory URLs</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add up to 10 additional inventory page URLs for dealerships with paginated listings
              </p>
              
              {editAdditionalUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <Input 
                    value={url} 
                    onChange={(e) => {
                      const newUrls = [...editAdditionalUrls];
                      newUrls[index] = e.target.value;
                      setEditAdditionalUrls(newUrls);
                    }}
                    placeholder={`https://example.com/inventory/page${index + 2}`}
                    className="w-full"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newUrls = [...editAdditionalUrls];
                      newUrls.splice(index, 1);
                      setEditAdditionalUrls(newUrls);
                    }}
                    className="flex-shrink-0 text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {editAdditionalUrls.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAdditionalUrls([...editAdditionalUrls, ''])}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add URL
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dealership-location">Location</Label>
              <Input 
                id="dealership-location" 
                value={editLocation} 
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Chantilly, VA"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Enter the location in "City, State" format (e.g., "Chantilly, VA")
              </p>
            </div>
          </div>
          <DialogFooter className={cn(isMobile && "flex-col space-y-2")}>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className={cn(isMobile && "mt-0 w-full")}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmEdit}
              className={cn(isMobile && "w-full")}
              disabled={editDealershipMutation.isPending || !editUrl.trim()}
            >
              {editDealershipMutation.isPending ? 'Updating...' : 'Update Dealership'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Renew subscription dialog */}
      <AlertDialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <AlertDialogContent className={cn(isMobile && "w-[95%] max-w-sm p-4")}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isMobile && "text-lg")}>Renew Subscription</AlertDialogTitle>
            <AlertDialogDescription className={cn(isMobile && "text-sm")}>
              Select a subscription period for {dealershipToRenew?.name}. The expiration date will be extended by the selected period.
              {dealershipToRenew?.expirationDate && (
                <div className="mt-2">
                  <p className="font-medium">Current expiration: <span className={
                    new Date(dealershipToRenew.expirationDate) < new Date() 
                      ? "text-red-600"
                      : new Date(dealershipToRenew.expirationDate) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                        ? "text-amber-600"
                        : "text-green-600"
                  }>{formatDate(dealershipToRenew.expirationDate)}</span></p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button 
              variant="outline" 
              className="flex flex-col items-center space-y-1 h-auto py-3" 
              onClick={() => confirmRenew(30)}
              disabled={renewMutation.isPending}
            >
              <Calendar className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">1 Month</span>
              <span className="text-xs text-neutral-500">30 days</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center space-y-1 h-auto py-3" 
              onClick={() => confirmRenew(90)}
              disabled={renewMutation.isPending}
            >
              <Calendar className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">3 Months</span>
              <span className="text-xs text-neutral-500">90 days</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center space-y-1 h-auto py-3" 
              onClick={() => confirmRenew(365)}
              disabled={renewMutation.isPending}
            >
              <Calendar className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium">1 Year</span>
              <span className="text-xs text-neutral-500">365 days</span>
            </Button>
          </div>
          <AlertDialogFooter className={cn(isMobile && "flex-col space-y-2")}>
            <AlertDialogCancel className={cn(isMobile && "mt-0")}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
