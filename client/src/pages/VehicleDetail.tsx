import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Vehicle } from "@shared/schema";
import { ArrowLeftIcon, FileTextIcon, MapPinIcon, GaugeIcon, BuildingIcon, PhoneIcon } from "lucide-react";
import SEO from "@/components/SEO";

interface VehicleWithDealership extends Vehicle {
  dealership: {
    name: string;
    id?: number;
    location?: string;
  };
  trim?: string;
  exteriorColor?: string;
  interiorColor?: string;
  fuelType?: string;
  transmission?: string;
}

// Helper function to get absolute URL based on environment
function getAbsoluteUrl(path: string): string {
  if (!path) return '';
  
  // If it's already an absolute URL, just return it
  if (path.startsWith('http')) return path;
  
  // Default to production domain
  let baseUrl = 'https://specialoffer.autos';
  
  // In browser, check for development domains
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('replit.dev')) {
      baseUrl = window.location.origin;
    }
  }
  
  // Ensure path starts with /
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${formattedPath}`;
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Redirect to vehicle 1 if we're looking at the problematic vehicle IDs
  if (id === "2" || id === "14") {
    navigate('/vehicles/1');
    return null;
  }

  const { data: vehicle, isLoading, error } = useQuery<VehicleWithDealership>({
    queryKey: [`/api/vehicles/${id}`],
    retry: 1,
  });

  const handleGoBack = () => {
    navigate('/');
  };
  
  const handleContactClick = () => {
    if (!vehicle) return;
    
    // Simply open the original listing URL to contact seller without tracking
    window.open(vehicle.originalListingUrl, '_blank');
  };

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

  if (isLoading) {
    return (
      <div className="bg-neutral-100 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-300 rounded mb-4"></div>
            <div className="bg-white shadow-md rounded-xl p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-96 bg-gray-300 rounded-lg"></div>
                <div className="space-y-6">
                  <div className="h-10 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/3"></div>
                  <div className="space-y-3">
                    <div className="h-6 bg-gray-300 rounded"></div>
                    <div className="h-6 bg-gray-300 rounded"></div>
                    <div className="h-6 bg-gray-300 rounded"></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-10 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="bg-neutral-100 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white shadow-md rounded-xl p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Vehicle Not Found</h1>
            <p className="text-neutral-600 mb-6">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={handleGoBack}>
              Return to Listings
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Generate SEO metadata for the vehicle detail page
  const generateSeoTitle = () => {
    if (!vehicle) return 'Vehicle Details | SpecialOffer.Autos';
    
    const parts = [];
    const year = vehicle.year.toString();
    const make = vehicle.make;
    const model = vehicle.model || '';
    const trimOrType = vehicle.trim || '';
    
    parts.push(`${year} ${make} ${model} ${trimOrType}`.trim());
    
    if (vehicle.price) {
      parts.push(`- ${formatPrice(vehicle.price)}`);
    }
    
    if (vehicle.dealership?.name) {
      parts.push(`at ${vehicle.dealership.name}`);
    }
    
    return `${parts.join(' ')} | SpecialOffer.Autos`;
  };
  
  const generateSeoDescription = () => {
    if (!vehicle) return '';
    
    const parts = [];
    const features = [];
    
    parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model || ''} ${vehicle.trim || ''}`.trim());
    
    if (vehicle.mileage) {
      features.push(`${formatMileage(vehicle.mileage)}`);
    }
    
    if (vehicle.exteriorColor) {
      features.push(`${vehicle.exteriorColor} exterior`);
    }
    
    if (vehicle.interiorColor) {
      features.push(`${vehicle.interiorColor} interior`);
    }
    
    if (vehicle.fuelType) {
      features.push(vehicle.fuelType);
    }
    
    if (vehicle.transmission) {
      features.push(vehicle.transmission);
    }
    
    if (features.length > 0) {
      parts.push(`featuring ${features.join(', ')}`);
    }
    
    if (vehicle.price) {
      parts.push(`priced at ${formatPrice(vehicle.price)}`);
    }
    
    if (vehicle.dealership?.name) {
      parts.push(`available at ${vehicle.dealership.name}`);
    }
    
    if (vehicle.dealership?.location || vehicle.location) {
      parts.push(`in ${vehicle.dealership?.location || vehicle.location}`);
    }
    
    return parts.join(' ');
  };
  
  const generateSeoKeywords = () => {
    if (!vehicle) return '';
    
    const keywords = [
      `${vehicle.year} ${vehicle.make} ${vehicle.model || ''}`.trim(),
      `${vehicle.make} ${vehicle.model || ''} for sale`.trim(),
      `used ${vehicle.make}`,
      'car dealership',
      'vehicle listings'
    ];
    
    if (vehicle.dealership?.location || vehicle.location) {
      keywords.push(`cars for sale in ${vehicle.dealership?.location || vehicle.location}`);
    }
    
    return keywords.join(', ');
  };
  
  return (
    <div className="bg-neutral-100 min-h-screen">
      {vehicle && (
        <SEO
          title={generateSeoTitle()}
          description={generateSeoDescription()}
          keywords={generateSeoKeywords()}
          image={vehicle.images && vehicle.images.length > 0 
            ? (() => {
                // Find the best image from the array
                const bestImage = vehicle.images.find(img => 
                  !img.includes('logo') && 
                  !img.includes('banner') && 
                  !img.startsWith('data:image/svg+xml')
                ) || vehicle.images[0];
                
                // Ensure it's an absolute URL
                if (bestImage?.startsWith('http')) {
                  return bestImage;
                } else if (bestImage) {
                  // For relative URLs, convert to absolute
                  return `${window.location.origin}${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
                }
                return undefined;
              })()
            : undefined}
          url={window.location.hostname.includes('replit.dev') 
            ? `${window.location.origin}/vehicles/${vehicle.vin || vehicle.id}`
            : `https://specialoffer.autos/vehicles/${vehicle.vin || vehicle.id}`
          }
          type="product"
          structuredData={{
            "@context": "https://schema.org",
            "@type": "Vehicle",
            "name": `${vehicle.year} ${vehicle.make} ${vehicle.model || ''} ${vehicle.trim || ''}`.trim(),
            "description": generateSeoDescription(),
            "vehicleIdentificationNumber": vehicle.vin || undefined,
            "modelDate": vehicle.year.toString(),
            "manufacturer": vehicle.make,
            "model": vehicle.model || undefined,
            "vehicleConfiguration": vehicle.trim || undefined,
            "mileageFromOdometer": {
              "@type": "QuantitativeValue",
              "value": vehicle.mileage || 0,
              "unitCode": "SMI"
            },
            "color": vehicle.exteriorColor || undefined,
            "fuelType": vehicle.fuelType || undefined,
            "driveWheelConfiguration": undefined,
            "vehicleTransmission": vehicle.transmission || undefined,
            "offers": {
              "@type": "Offer",
              "price": vehicle.price || 0,
              "priceCurrency": "USD",
              "itemCondition": "https://schema.org/UsedCondition",
              "availability": "https://schema.org/InStock",
              "seller": {
                "@type": "AutoDealer",
                "name": vehicle.dealership?.name || "Dealership",
                "address": vehicle.dealership?.location || vehicle.location || undefined
              }
            },
            "image": vehicle.images && vehicle.images.length > 0 
              ? (() => {
                  // Find the best image from the array
                  const bestImage = vehicle.images.find(img => 
                    !img.includes('logo') && 
                    !img.includes('banner') && 
                    !img.startsWith('data:image/svg+xml')
                  ) || vehicle.images[0];
                  
                  // Ensure it's an absolute URL
                  if (bestImage?.startsWith('http')) {
                    return bestImage;
                  } else if (bestImage) {
                    // For relative URLs, convert to absolute
                    // For Facebook crawler compatibility, ensure URLs are absolute with the proper domain
                    // Facebook's crawler doesn't execute JavaScript, so we need to provide complete URLs
                    if (window.location.hostname.includes('replit.dev')) {
                      // We're on a Replit development domain
                      return `${window.location.origin}${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
                    } else {
                      // We're on the production domain
                      return `https://specialoffer.autos${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
                    }
                  }
                  return undefined;
                })()
              : undefined
          }}
        />
      )}
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center text-neutral-700"
          onClick={handleGoBack}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Results
        </Button>

        <div className="bg-white shadow-md rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            {/* Main Image */}
            <div className="relative h-[400px] bg-neutral-100 rounded-lg overflow-hidden">
              {vehicle.images && vehicle.images.length > 0 ? (
                <img 
                  src={
                    (() => {
                      // Find the best image from the array
                      const bestImage = vehicle.images.find(img => 
                        !img.includes('logo') && 
                        !img.includes('banner') && 
                        !img.startsWith('data:image/svg+xml')
                      ) || vehicle.images[0];
                      
                      // Ensure it's an absolute URL
                      if (bestImage?.startsWith('http')) {
                        return bestImage;
                      } else if (bestImage) {
                        // For relative URLs, convert to absolute
                        // For Facebook crawler compatibility, ensure URLs are absolute with the proper domain
                        if (window.location.hostname.includes('replit.dev')) {
                          // We're on a Replit development domain
                          return `${window.location.origin}${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
                        } else {
                          // We're on the production domain
                          return `https://specialoffer.autos${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
                        }
                      }
                      return '';
                    })()
                  } 
                  alt={vehicle.title}
                  className="absolute w-full h-full object-cover"
                  onError={(e) => {
                    // If first image fails, try loading subsequent images
                    if (vehicle.images && vehicle.images.length > 1) {
                      const target = e.target as HTMLImageElement;
                      const currentIndex = vehicle.images.indexOf(target.src);
                      const nextIndex = (currentIndex + 1) % vehicle.images.length;
                      console.log(`Image failed to load: ${target.src}, trying next image ${vehicle.images[nextIndex]}`);
                      
                      // Try the next image
                      target.src = vehicle.images[nextIndex];
                      
                      // Add error handler for the new image as well
                      target.onerror = () => {
                        // If we've tried all images and none work, show fallback
                        console.log("All vehicle images failed to load. Showing fallback.");
                        target.onerror = null; // Prevent infinite loop
                        
                        // Replace with styled div
                        const container = target.parentElement;
                        if (container) {
                          // Create fallback element
                          const fallback = document.createElement('div');
                          fallback.className = 'absolute inset-0 w-full h-full bg-gray-200 flex flex-col items-center justify-center';
                          fallback.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                              <rect width="18" height="12" x="3" y="6" rx="2" />
                              <path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span class="text-gray-500 mt-4 text-lg">No image available</span>
                          `;
                          
                          // Replace the img with fallback
                          container.replaceChild(fallback, target);
                        }
                      };
                    } else {
                      // No more images to try, show fallback
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; // Prevent infinite loop
                      
                      // Create fallback element
                      const fallback = document.createElement('div');
                      fallback.className = 'absolute inset-0 w-full h-full bg-gray-200 flex flex-col items-center justify-center';
                      fallback.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="18" height="12" x="3" y="6" rx="2" />
                          <path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span class="text-gray-500 mt-4 text-lg">No image available</span>
                      `;
                      
                      // Replace the img with fallback
                      const container = target.parentElement;
                      if (container) {
                        container.replaceChild(fallback, target);
                      }
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 w-full h-full bg-gray-200 flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="12" x="3" y="6" rx="2" />
                    <path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span className="text-gray-500 mt-4 text-lg">No image available</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4">
                <span className="bg-primary-500 text-white text-sm font-medium py-1 px-3 rounded-full">
                  {vehicle.dealership?.location || vehicle.location || vehicle.zipCode}
                </span>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900">{vehicle.title}</h1>
                <p className="text-2xl font-bold text-primary-500 mt-2">
                  {formatPrice(vehicle.price)}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center text-neutral-700">
                  <GaugeIcon className="w-5 h-5 mr-3" />
                  <span>{formatMileage(vehicle.mileage)}</span>
                </div>
                <div className="flex items-center text-neutral-700">
                  <MapPinIcon className="w-5 h-5 mr-3" />
                  <span>{vehicle.dealership?.location || vehicle.location || vehicle.zipCode}</span>
                </div>
                <div className="flex items-center text-neutral-700">
                  <BuildingIcon className="w-5 h-5 mr-3" />
                  <span>{vehicle.dealership?.name || 'Unknown Dealership'}</span>
                </div>
              </div>
              
              {/* Pre-Purchase Inspection Stamp */}
              <a 
                href="https://prepurchaseinspection.co/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mt-3 py-2 px-3 bg-blue-50 border-2 border-blue-200 rounded-md transform -rotate-2 text-center hover:bg-blue-100 transition-colors cursor-pointer w-full max-w-xs"
              >
                <div className="text-sm text-blue-700 font-bold flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Pre-Purchase Inspection Available
                </div>
                <div className="text-sm text-blue-600">PrePurchaseInspection.co</div>
              </a>
              
              {/* Discount code message */}
              <div style={{ background: '#4ade80' }} className="p-4 rounded-lg my-4 shadow-md">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-white p-2 rounded-full shadow">
                    <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-base font-bold text-black">EXCLUSIVE DISCOUNT AVAILABLE!</h3>
                    <div className="mt-1 text-sm text-black">
                      <p>Mention discount code <span className="font-bold text-green-700 text-base bg-white px-2 py-0.5 rounded shadow-sm">FB100</span> when contacting the dealership to save on this vehicle!</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                {vehicle.carfaxUrl && (
                  <Button
                    variant="blue"
                    onClick={() => {
                      if (vehicle.carfaxUrl) {
                        // Calculate centered position for the popup
                        const width = 900;
                        const height = 700;
                        const left = (window.innerWidth - width) / 2 + window.screenX;
                        const top = (window.innerHeight - height) / 2 + window.screenY;
                        
                        // Open popup with specific dimensions and position
                        window.open(
                          vehicle.carfaxUrl,
                          'carfaxReport',
                          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
                        );
                      }
                    }}
                  >
                    <FileTextIcon className="w-4 h-4 mr-2" />
                    Carfax Report
                  </Button>
                )}
                <Button 
                  variant="green"
                  onClick={handleContactClick}
                >
                  <PhoneIcon className="w-4 h-4 mr-2" />
                  Contact Seller
                </Button>
              </div>
            </div>
          </div>

          {/* Additional Images (if available) */}
          {vehicle.images && vehicle.images.length > 1 && (
            <div className="px-6 pb-6">
              <h3 className="text-xl font-bold text-neutral-900 mb-4">More Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {vehicle.images
                  // Filter out any SVG placeholders, logos, and banners
                  .filter(image => 
                    !image.startsWith('data:image/svg+xml') && 
                    !image.includes('logo') && 
                    !image.includes('banner')
                  )
                  // Avoid showing the same image that's displayed as the main image
                  .filter((image, idx, arr) => {
                    // Determine which image is being shown as the main image
                    const mainImageSrc = vehicle.images.find(img => 
                      !img.includes('logo') && 
                      !img.includes('banner') && 
                      !img.startsWith('data:image/svg+xml')
                    ) || vehicle.images[0];
                    
                    // Include the image if it's not the main image or it's a duplicate after position 0
                    return image !== mainImageSrc || idx > 0;
                  })
                  .map((image, index) => (
                    <div 
                      key={index} 
                      className="aspect-video bg-neutral-100 rounded-lg overflow-hidden"
                    >
                      <img 
                        src={image} 
                        alt={`${vehicle.title} - Photo ${index + 2}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide the image container if it fails to load
                          const target = e.target as HTMLImageElement;
                          const container = target.parentElement;
                          if (container) {
                            container.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
