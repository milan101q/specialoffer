import { Vehicle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { GaugeIcon, MapPinIcon, BuildingIcon, FileTextIcon, GlobeIcon, TagIcon } from "lucide-react";

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

export default function SimpleVehicleCard({ vehicle, onClick }: VehicleCardProps) {
  // Handle Honda Pilot special case
  const isHondaPilot = 
    vehicle.make === 'Honda' && 
    vehicle.model === 'Pilot' && 
    vehicle.vin === '2HKYF18545H532952';

  // Special handling for problematic vehicles
  if (isHondaPilot && vehicle.images && vehicle.images.length > 0) {
    // Make sure image URLs are clean
    vehicle.images = vehicle.images.map(img => img.trim());
  }

  const formatPrice = (price: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(price);
    } catch (error) {
      console.error('Error formatting price:', error);
      return '$' + price;
    }
  };

  const formatMileage = (mileage: number) => {
    try {
      return new Intl.NumberFormat('en-US').format(mileage) + ' miles';
    } catch (error) {
      console.error('Error formatting mileage:', error);
      return mileage + ' miles';
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all"
      onClick={onClick}
    >
      <div className="aspect-video bg-gray-200 relative">
        {vehicle.images && vehicle.images.length > 0 && (
          <img 
            src={(vehicle.images[0] || '').trim()} 
            alt={vehicle.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect fill='%23f0f0f0' width='100' height='100'/%3e%3cpath fill='%23cccccc' d='M65,35 L35,35 L35,65 L65,65 Z'/%3e%3c/svg%3e";
            }}
          />
        )}
        <div className="absolute top-2 right-2 bg-white py-1 px-2 rounded text-sm font-bold">
          {formatPrice(vehicle.price)}
        </div>
      </div>
      <div className="p-4">
        {/* Nova Autoland Promotion Banner */}
        {vehicle.dealership?.name === 'Nova Autoland' && (
          <div className="mb-3">
            <div className="relative overflow-hidden bg-[#0a2158] text-white p-2.5 rounded text-sm">
              <div className="absolute top-0 left-0 h-full w-[30px] bg-[#ff6c00] opacity-20"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-base">4-Month Warranty!</div>
                  <div className="bg-[#ff6c00] text-white text-[10px] font-bold py-0.5 px-2 rounded-full whitespace-nowrap">
                    LIMITED TIME OFFER
                  </div>
                </div>
                <div className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Free Oil Change • Free Brake Pads • Free Battery</div>
              </div>
            </div>
          </div>
        )}
        
        <h3 className="font-semibold text-lg mb-2 truncate">{vehicle.title}</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-center">
            <GaugeIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{formatMileage(vehicle.mileage)}</span>
          </div>
          <div className="flex items-center">
            <BuildingIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{vehicle.dealership?.name || 'Unknown'}</span>
          </div>
          <div className="flex items-center">
            <MapPinIcon className="w-4 h-4 mr-2 text-gray-500" />
            <span>{vehicle.dealership?.location || vehicle.location || 'Unknown'}</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Pre-Purchase Inspection Available
            </div>
            <div className="text-xs text-blue-600">PrePurchaseInspection.co</div>
          </a>
        </div>
        <div className="mt-3">
          <Button 
            variant="default"
            size="sm" 
            className="w-full bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-medium border border-blue-500 shadow-sm"
          >
            <FileTextIcon className="w-4 h-4 mr-1" />
            View Details & Carfax
          </Button>
        </div>
      </div>
    </div>
  );
}