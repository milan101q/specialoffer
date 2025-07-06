import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Vehicle } from "@shared/schema";
import SimpleVehicleCard from './SimpleVehicleCard';
import { SimplePagination } from './SimplePagination';
import { Loader2 } from 'lucide-react';

interface EnhancedVehicle extends Vehicle {
  dealership?: {
    id?: number;
    name: string;
    location?: string;
  };
}

interface InfiniteScrollVehiclesProps {
  vehicles: EnhancedVehicle[];
  totalPages: number;
  currentPage: number;
  onLoadMore: (page: number) => void;
  onVehicleClick: (vehicle: EnhancedVehicle) => void;
  isLoading: boolean;
  showPagination?: boolean;
}

export default function InfiniteScrollVehicles({
  vehicles,
  totalPages,
  currentPage,
  onLoadMore,
  onVehicleClick,
  isLoading,
  showPagination = true,
}: InfiniteScrollVehiclesProps) {
  // IntersectionObserver hook to detect when we reach the bottom of the page
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '400px 0px', // Load more content when user is 400px away from the bottom
  });

  // Track loaded vehicles to prevent duplicates during page changes
  const [allVehicles, setAllVehicles] = useState<EnhancedVehicle[]>([]);
  
  // Update our state when the vehicles prop changes
  useEffect(() => {
    if (currentPage === 1) {
      // Reset for new searches
      setAllVehicles(vehicles || []);
    } else if (currentPage > 1 && vehicles && vehicles.length > 0) {
      // Append for pagination
      const newVehicleIds = new Set(vehicles.map(v => v.id));
      const existingVehicleIds = new Set(allVehicles.map(v => v.id));
      
      // Only add vehicles that aren't already displayed
      const uniqueNewVehicles = vehicles.filter(v => !existingVehicleIds.has(v.id));
      setAllVehicles(prev => [...prev, ...uniqueNewVehicles]);
    }
  }, [vehicles, currentPage]);

  // Load more content when the user scrolls to the bottom (if not on the last page)
  useEffect(() => {
    if (inView && currentPage < totalPages && !isLoading) {
      onLoadMore(currentPage + 1);
    }
  }, [inView, currentPage, totalPages, isLoading, onLoadMore]);

  if (allVehicles.length === 0 && !isLoading) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">No vehicles match your search criteria.</p>
        <p className="text-gray-400 mt-2">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Grid of vehicle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allVehicles.map((vehicle) => (
          <SimpleVehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            onClick={() => onVehicleClick(vehicle)}
          />
        ))}
      </div>

      {/* Loading indicator or pagination */}
      <div ref={ref} className="mt-8 flex justify-center py-6">
        {isLoading ? (
          <div className="flex items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-gray-600">Loading more vehicles...</span>
          </div>
        ) : currentPage < totalPages ? (
          <div className="text-sm text-gray-500">Scroll for more</div>
        ) : showPagination ? (
          <SimplePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onLoadMore}
          />
        ) : null}
      </div>
    </div>
  );
}