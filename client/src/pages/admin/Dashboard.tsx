import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminSidebar from '@/components/AdminSidebar';
import AdminStats from '@/components/AdminStats';
import ContactClicksHistory from '@/components/ContactClicksHistory';
import DealershipForm from '@/components/DealershipForm';
import DealershipTable from '@/components/DealershipTable';
import SiteSettings from '@/components/SiteSettings';
import FileUpload from '@/components/FileUpload';
import VehicleCardsDownload from '@/components/VehicleCardsDownload';
import VehiclePhotosDownload from '@/components/VehiclePhotosDownload';
import { VehicleCardImagesDownload } from '@/components/VehicleCardImagesDownload';
import InspectedAutoSyncTester from '@/components/InspectedAutoSyncTester';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Dealership } from '@shared/schema';

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [currentLocation, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const isMobile = useIsMobile();

  interface StatsData {
    totalDealerships: number;
    totalVehicles: number;
    contactClicks: number;
    viewClicks: number;
    lastSynced: string | null;
    vehicleViewCounts?: Record<number, number>;
  }
  
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ['/api/stats'],
    enabled: isAuthenticated
  });

  // Get path from URL to determine active tab
  useEffect(() => {
    const path = currentLocation.split('/').pop();
    if (path && ['dashboard', 'dealerships', 'inventory', 'settings'].includes(path)) {
      setActiveTab(path);
    }
  }, [currentLocation]);

  // Authentication is now handled by the ProtectedRoute component

  return (
    <div className="bg-neutral-100 min-h-screen flex flex-col lg:flex-row">
      <AdminSidebar activeTab={activeTab} />
      
      <div className={cn(
        "flex-1 overflow-auto",
        isMobile ? "p-4 pt-16" : "p-8 lg:ml-20" // Add padding for mobile hamburger menu
      )}>
        <Tabs 
          defaultValue="dashboard" 
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            setLocation(`/admin/${value}`);
          }}
          className="space-y-6"
        >
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="dealerships">Dealerships</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Dashboard</h1>
            <AdminStats stats={stats} isLoading={statsLoading} />
            <ContactClicksHistory />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <DealershipForm />
              <InspectedAutoSyncTester />
            </div>
          </TabsContent>
          
          <TabsContent value="dealerships" className="space-y-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Dealerships</h1>
            <DealershipForm />
            <div className="overflow-x-auto">
              <DealershipTable 
                onOpenUploadModal={(dealership) => {
                  setSelectedDealership(dealership);
                  setIsUploadModalOpen(true);
                }} 
              />
            </div>
          </TabsContent>
          
          <TabsContent value="inventory" className="space-y-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Inventory Management</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <p className="text-neutral-600 mb-4">
                  Manage your vehicle inventory by selecting a dealership in the Dealerships tab.
                </p>
              </div>
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">Dealership Sync Tools</h2>
                <InspectedAutoSyncTester />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Site Settings</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <SiteSettings />
              </div>
              <div>
                <VehicleCardsDownload />
              </div>
              <div>
                <VehicleCardImagesDownload />
              </div>
              <div className="lg:col-span-2">
                <VehiclePhotosDownload />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* CSV Upload Modal */}
      {isUploadModalOpen && selectedDealership && (
        <FileUpload 
          dealership={selectedDealership} 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}
    </div>
  );
}
