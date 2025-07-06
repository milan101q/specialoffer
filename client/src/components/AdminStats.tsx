import { Card } from "@/components/ui/card";
import { Store, Car, PhoneCall, RefreshCw, MousePointer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface StatsData {
  totalDealerships: number;
  totalVehicles: number;
  contactClicks: number;
  viewClicks: number;
  lastSynced: string | null;
  vehicleViewCounts?: Record<number, number>;
}

interface AdminStatsProps {
  stats?: StatsData;
  isLoading: boolean;
}

export default function AdminStats({ stats, isLoading }: AdminStatsProps) {
  const isMobile = useIsMobile();
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    
    // Check if it's today
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-20 md:w-24 bg-gray-300 rounded mb-1"></div>
                <div className="h-8 w-12 md:w-16 bg-gray-300 rounded"></div>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-300 rounded-full"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-8">
      <StatCard
        title="Total Dealerships"
        value={stats?.totalDealerships || 0}
        icon={<Store className={cn("h-5 w-5 md:h-6 md:w-6")} />}
        bgColor="bg-primary-100"
        textColor="text-primary-500"
      />
      
      <StatCard
        title="Total Vehicles"
        value={stats?.totalVehicles || 0}
        icon={<Car className={cn("h-5 w-5 md:h-6 md:w-6")} />}
        bgColor="bg-green-100"
        textColor="text-green-500"
      />
      
      <StatCard
        title="Vehicle Views"
        value={stats?.viewClicks || 0}
        icon={<MousePointer className={cn("h-5 w-5 md:h-6 md:w-6")} />}
        bgColor="bg-purple-100"
        textColor="text-purple-500"
      />
      
      <StatCard
        title="Seller Contacts"
        value={stats?.contactClicks || 0}
        icon={<PhoneCall className={cn("h-5 w-5 md:h-6 md:w-6")} />}
        bgColor="bg-blue-100"
        textColor="text-blue-500"
      />
      
      <StatCard
        title="Last Sync"
        valueComponent={
          <h3 className="text-sm md:text-lg font-bold text-neutral-900 truncate">
            {formatDate(stats?.lastSynced || null)}
          </h3>
        }
        icon={<RefreshCw className={cn("h-5 w-5 md:h-6 md:w-6")} />}
        bgColor="bg-amber-100"
        textColor="text-amber-500"
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value?: number;
  valueComponent?: React.ReactNode;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

function StatCard({ title, value, valueComponent, icon, bgColor, textColor }: StatCardProps) {
  const isMobile = useIsMobile();
  
  return (
    <Card className="p-3 md:p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="pr-2">
          <p className="text-neutral-600 text-xs md:text-sm truncate">{title}</p>
          {valueComponent || (
            <h3 className="text-xl md:text-2xl font-bold text-neutral-900">{value}</h3>
          )}
        </div>
        <div className={cn(
          "flex-shrink-0 rounded-full flex items-center justify-center",
          bgColor, textColor,
          isMobile ? "w-10 h-10" : "w-12 h-12"
        )}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
