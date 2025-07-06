import { Vehicle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { FileTextIcon, ExternalLinkIcon, GaugeIcon, MapPinIcon, BuildingIcon, GlobeIcon, TagIcon } from "lucide-react";
import { useState } from "react";

// Enhanced vehicle type with dealership info included from API
interface EnhancedVehicle extends Vehicle {
  dealership?: {
    id?: number;
    name: string;
    location?: string;
  };
}

interface VehicleCardProps {
  vehicle: EnhancedVehicle;
  onClick: () => void;
}

export default function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat('en-US').format(mileage) + ' miles';
  };

  const handleCarfaxClick = (e: React.MouseEvent, url?: string | null) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleContactClick = async (e: React.MouseEvent, vehicleId: number, url: string) => {
    e.stopPropagation();
    
    try {
      // Track the contact click with the backend
      await fetch(`/api/vehicles/${vehicleId}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to track contact click:', error);
    }
    
    // Simply open the original listing URL in a new tab
    window.open(url, '_blank');
  };

  // Choose the first non-empty image
  const imageUrl = vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : null;

  return (
    <div 
      className="bg-white rounded-xl border border-transparent shadow-md overflow-hidden cursor-pointer
                transform transition-all duration-300 ease-in-out
                hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-[1.03] hover:border-primary-300 hover:z-10
                hover:bg-gradient-to-b hover:from-white hover:to-primary-50"
      style={{
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative pb-[60%] overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl}
            alt={vehicle.title} 
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gray-200 flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="12" x="3" y="6" rx="2" />
              <path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="text-gray-500 mt-2 text-sm">No image available</span>
          </div>
        )}
        
        <div className="absolute bottom-3 left-3">
          <span className="bg-primary-500 text-white text-xs font-medium py-1 px-2 rounded-full">
            {vehicle.dealership?.location || vehicle.location || vehicle.zipCode}
          </span>
        </div>
        
        {/* Price tag */}
        <div className="absolute top-3 right-3">
          <span className="bg-white/80 backdrop-blur-sm text-primary-600 text-sm font-bold py-1 px-3 rounded-full shadow-sm">
            {formatPrice(vehicle.price)}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-neutral-900 truncate">{vehicle.title}</h3>
          <span className="text-lg font-bold text-primary-500">{formatPrice(vehicle.price)}</span>
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center text-neutral-600 text-sm">
            <GaugeIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{formatMileage(vehicle.mileage)}</span>
          </div>
          <div className="flex items-center text-neutral-600 text-sm">
            <MapPinIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{vehicle.dealership?.location || vehicle.location || vehicle.zipCode}</span>
          </div>
          <div className="flex items-center text-neutral-600 text-sm">
            <BuildingIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{vehicle.dealership?.name || 'Unknown Dealership'}</span>
          </div>

          <div className="mb-2">
            <div className="px-2 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded shadow-sm transform rotate-1">
              <div className="text-xs text-purple-800 font-semibold flex items-center justify-between">
                <div className="flex items-center">
                  <TagIcon className="w-3 h-3 mr-1 text-purple-600" />
                  <span>Special Discount at</span>
                </div>
                <span className="font-bold text-purple-900">SpecialOffer.Autos</span>
              </div>
            </div>
          </div>
          <a 
            href="https://prepurchaseinspection.co/" 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block py-1 px-2 bg-blue-50 border-2 border-blue-200 rounded-md transform -rotate-2 text-center hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <div className="text-xs text-blue-700 font-bold flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Pre-Purchase Inspection Available
            </div>
            <div className="text-xs text-blue-600">PrePurchaseInspection.co</div>
          </a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="default"
            size="sm"
            className="text-xs font-medium bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white border border-blue-500 shadow-sm"
            onClick={(e) => handleCarfaxClick(e, vehicle.carfaxUrl || undefined)}
            disabled={!vehicle.carfaxUrl}
          >
            <FileTextIcon className="w-3 h-3 mr-1" />
            Carfax Report
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-xs font-medium bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white border border-blue-500 shadow-sm"
            onClick={(e) => handleContactClick(e, vehicle.id, vehicle.originalListingUrl || '#')}
          >
            <ExternalLinkIcon className="w-3 h-3 mr-1" />
            Contact Seller
          </Button>
        </div>
      </div>
    </div>
  );
}
