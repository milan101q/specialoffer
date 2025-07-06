import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import SafeVehicleCard from "@/components/SafeVehicleCard";
import AlwaysVisibleFilterBar from "@/components/AlwaysVisibleFilterBar";
import { Vehicle, VehicleFilter } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SEO from "@/components/SEO";

// Extended Vehicle type with dealership information
interface EnhancedVehicle extends Vehicle {
  dealership?: {
    id?: number;
    name: string;
    location?: string;
  };
}

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get current page from URL path parameter or query parameter
  // First check if we're on the /page/:pageNumber route
  const location = window.location.pathname;
  const pageMatch = location.match(/^\/page\/(\d+)$/);
  
  // Always clear any saved page number to ensure fresh navigation
  sessionStorage.removeItem('lastPageNumber');
  
  // Path parameter takes precedence, then query parameter, then default to 1
  const currentPage = pageMatch ? parseInt(pageMatch[1]) : 
    (searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1);
  
  // Get current filter values from URL
  const getFilterValues = (): VehicleFilter => {
    return {
      page: currentPage,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12,
      sortBy: (searchParams.get('sortBy') as any) || 'relevance',
      keyword: searchParams.get('keyword') || undefined,
      yearMin: searchParams.get('yearMin') ? parseInt(searchParams.get('yearMin')!) : undefined,
      yearMax: searchParams.get('yearMax') ? parseInt(searchParams.get('yearMax')!) : undefined,
      priceMin: searchParams.get('priceMin') ? parseInt(searchParams.get('priceMin')!) : undefined,
      priceMax: searchParams.get('priceMax') ? parseInt(searchParams.get('priceMax')!) : undefined,
      mileageMin: searchParams.get('mileageMin') ? parseInt(searchParams.get('mileageMin')!) : undefined,
      mileageMax: searchParams.get('mileageMax') ? parseInt(searchParams.get('mileageMax')!) : undefined,
      zipCode: searchParams.get('zipCode') || undefined,
      location: searchParams.get('location') || undefined, // Get location from URL params
      distance: searchParams.get('distance') ? parseInt(searchParams.get('distance')!) : undefined,
      make: searchParams.getAll('make').length > 0 ? searchParams.getAll('make') : undefined,
      dealershipId: searchParams.get('dealershipId') ? parseInt(searchParams.get('dealershipId')!) : undefined
    };
  };
  
  const currentFilters = getFilterValues();
  
  // Query for vehicles with current filters
  const { data, isLoading, isFetching } = useQuery<{
    vehicles: EnhancedVehicle[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }>({
    queryKey: ['/api/vehicles', searchParams.toString(), currentPage.toString()],
    queryFn: async () => {
      // Create a new URLSearchParams to include the page from URL path if needed
      const queryParams = new URLSearchParams(searchParams.toString());
      
      // Always ensure the page parameter matches our currentPage
      if (currentPage > 1) {
        queryParams.set('page', currentPage.toString());
      } else {
        queryParams.delete('page');
      }
      
      console.log("Fetching with query:", queryParams.toString(), "Page:", currentPage);
      const response = await fetch(`/api/vehicles?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      const result = await response.json();
      console.log("Received page:", result.currentPage, "of", result.totalPages);
      return result;
    },
    staleTime: 0,
    refetchOnWindowFocus: false
  });
  
  // Update search params with new filters
  const updateFilters = (newFilters: Partial<VehicleFilter> & { _forceReset?: boolean }) => {
    // Don't use this function for page changes - those are handled directly in handlePageChange
    if (newFilters.page !== undefined && Object.keys(newFilters).length === 1 && !newFilters._forceReset) {
      console.log("Page change should use handlePageChange instead");
      return;
    }
    
    // Special handling for complete filter reset
    if (newFilters._forceReset) {
      console.log("Performing complete filter reset");
      
      // Create a fresh URLSearchParams without inheriting any previous state
      const cleanParams = new URLSearchParams();
      
      // Only keep the limit parameter if it's different from default
      if (newFilters.limit && newFilters.limit !== 12) {
        cleanParams.set('limit', newFilters.limit.toString());
      }
      
      // Use replace instead of push to avoid browser history issues
      navigate(`/?${cleanParams.toString()}`, { replace: true });
      
      // Exit early to avoid any other processing
      return;
    }
    
    // Normal filter update flow
    const updatedParams = new URLSearchParams(searchParams);
    
    // Handle keyword parameter
    if (newFilters.keyword !== undefined) {
      if (newFilters.keyword) {
        updatedParams.set('keyword', newFilters.keyword);
      } else {
        updatedParams.delete('keyword');
      }
    }
    
    // Handle make parameter (array)
    if (newFilters.make !== undefined) {
      // Clear existing make params
      updatedParams.delete('make');
      
      // Add all makes if they exist
      if (newFilters.make && newFilters.make.length > 0) {
        newFilters.make.forEach(make => {
          updatedParams.append('make', make);
        });
      }
    }
    
    // Handle zipCode parameter (string)
    if (newFilters.zipCode !== undefined) {
      if (newFilters.zipCode && newFilters.zipCode.trim() !== "") {
        updatedParams.set('zipCode', newFilters.zipCode);
      } else {
        updatedParams.delete('zipCode');
      }
    }
    
    // Handle location parameter (string)
    if (newFilters.location !== undefined) {
      if (newFilters.location && newFilters.location.trim() !== "") {
        updatedParams.set('location', newFilters.location);
      } else {
        updatedParams.delete('location');
      }
    }
    
    // Handle numeric parameters
    const numericParams: Array<keyof VehicleFilter> = [
      'yearMin', 'yearMax', 'priceMin', 'priceMax', 
      'mileageMin', 'mileageMax', 'distance', 'dealershipId'
    ];
    
    numericParams.forEach(param => {
      if (newFilters[param] !== undefined) {
        if (newFilters[param]) {
          updatedParams.set(param, newFilters[param]!.toString());
        } else {
          updatedParams.delete(param);
        }
      }
    });
    
    // Handle sort parameter
    if (newFilters.sortBy !== undefined) {
      if (newFilters.sortBy !== 'relevance') {
        updatedParams.set('sortBy', newFilters.sortBy);
      } else {
        updatedParams.delete('sortBy');
      }
    }
    
    // Handle limit parameter
    if (newFilters.limit !== undefined && newFilters.limit !== 12) {
      updatedParams.set('limit', newFilters.limit.toString());
    }
    
    // Reset page to 1 when changing any filter other than page itself
    if (newFilters.page === 1 || 
        Object.keys(newFilters).some(key => key !== 'page' && key !== '_forceReset' && key !== 'limit')) {
      updatedParams.delete('page');
    }
    
    // Use programmatic navigation with React Router
    const newUrl = `${window.location.pathname}?${updatedParams.toString()}`;
    navigate(newUrl);
  };
  
  // Handle search from header
  const handleSearch = (keyword: string) => {
    updateFilters({ keyword, page: 1 });
  };
  
  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<VehicleFilter>) => {
    // Debug logging removed for production deployment
    updateFilters({ ...newFilters, page: 1 });
  };
  
  // Track our own page state to prevent loops
  const [pageChangeInProgress, setPageChangeInProgress] = useState(false);
  
  // Handle pagination with path-based navigation
  const handlePageChange = (page: number) => {
    if (page === currentPage || pageChangeInProgress) return;
    
    // Debug logging removed for production deployment
    setPageChangeInProgress(true);
    
    // Create a new URLSearchParams object with current query parameters
    const params = new URLSearchParams(window.location.search);
    
    // Remove page from query params since we're using path-based pagination
    params.delete('page');
    
    // Never store page information in sessionStorage - this was causing the navigation issue
    // Now we rely only on the URL for navigation state
    
    // Block React Router's history updates temporarily
    const preventedDefault = (e: any) => {
      e.preventDefault();
      return false;
    };
    window.addEventListener('popstate', preventedDefault);
    
    // For page 1, go to root path, otherwise use /page/:pageNumber
    if (page === 1) {
      window.location.href = params.toString() ? `/?${params.toString()}` : '/';
    } else {
      window.location.href = `/page/${page}${params.toString() ? `?${params.toString()}` : ''}`;
    }
    
    // This code won't run as we're doing a full page refresh, but keeping it as a fallback
    setTimeout(() => {
      setPageChangeInProgress(false);
      window.removeEventListener('popstate', preventedDefault);
    }, 500);
  };
  
  // Handle URL parameter changes with more resistance to unwanted resets
  useEffect(() => {
    // Only handle URL parameter changes if pagination is not in progress
    if (!pageChangeInProgress) {
      const urlPage = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
      // Debug logging removed for production deployment
    } else {
      // Debug logging removed for production deployment
    }
  }, [searchParams, pageChangeInProgress]);
  
  // Initialize component
  useEffect(() => {
    // Always remove sessionStorage page number to prevent navigation issues
    sessionStorage.removeItem('lastPageNumber');
    localStorage.removeItem('lastPageNumber'); // Also check localStorage just in case
    
    // Clear pagination lock
    setPageChangeInProgress(false);
    
    const handleBeforeUnload = () => {
      // Clear any pending pagination states
      setPageChangeInProgress(false);
      
      // Ensure we clear session storage on page unload too
      sessionStorage.removeItem('lastPageNumber');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  const isSearching = isLoading || isFetching;

  // Generate SEO metadata based on current filters
  const getSeoTitle = () => {
    const parts = [];
    
    if (currentFilters.make && currentFilters.make.length > 0) {
      parts.push(currentFilters.make.join(', '));
    }
    
    if (currentFilters.yearMin && currentFilters.yearMax) {
      parts.push(`${currentFilters.yearMin}-${currentFilters.yearMax}`);
    } else if (currentFilters.yearMin) {
      parts.push(`${currentFilters.yearMin}+`);
    } else if (currentFilters.yearMax) {
      parts.push(`Pre-${currentFilters.yearMax}`);
    }
    
    parts.push("Cars for Sale");
    
    if (currentFilters.location) {
      parts.push(`in ${currentFilters.location}`);
    } else if (currentFilters.zipCode) {
      parts.push(`Near ${currentFilters.zipCode}`);
    }
    
    const filterTitle = parts.join(' ');
    return filterTitle ? `${filterTitle} | SpecialOffer.Autos` : 'Quality Vehicles Available | SpecialOffer.Autos';
  };
  
  const getSeoDescription = () => {
    const parts = [];
    
    if (currentFilters.make && currentFilters.make.length > 0) {
      parts.push(`Browse ${currentFilters.make.join(', ')} vehicles`);
    } else {
      parts.push('Browse vehicles');
    }
    
    if (currentFilters.priceMin && currentFilters.priceMax) {
      parts.push(`priced between $${currentFilters.priceMin.toLocaleString()} and $${currentFilters.priceMax.toLocaleString()}`);
    } else if (currentFilters.priceMin) {
      parts.push(`priced from $${currentFilters.priceMin.toLocaleString()}`);
    } else if (currentFilters.priceMax) {
      parts.push(`under $${currentFilters.priceMax.toLocaleString()}`);
    }
    
    if (currentFilters.yearMin && currentFilters.yearMax) {
      parts.push(`from ${currentFilters.yearMin} to ${currentFilters.yearMax}`);
    } else if (currentFilters.yearMin) {
      parts.push(`from ${currentFilters.yearMin} and newer`);
    } else if (currentFilters.yearMax) {
      parts.push(`up to ${currentFilters.yearMax}`);
    }
    
    if (currentFilters.location) {
      parts.push(`in ${currentFilters.location}`);
    } else if (currentFilters.zipCode) {
      parts.push(`near ${currentFilters.zipCode}`);
    }
    
    const filterDescription = parts.join(' ');
    return filterDescription || 'Browse quality vehicles from trusted dealerships at SpecialOffer.Autos.';
  };

  // Use IntersectionObserver to track when user scrolls to bottom of page
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [allVehicles, setAllVehicles] = useState<EnhancedVehicle[]>([]);
  const [hasMore, setHasMore] = useState(true);
  // Use a ref to track the current page for infinite scroll
  const currentLoadedPageRef = useRef<number>(1);
  
  useEffect(() => {
    // When data changes, reset our accumulated vehicles
    if (data?.vehicles) {
      setAllVehicles(data.vehicles);
      setHasMore(data.currentPage < data.totalPages);
      
      // Reset our page counter when filters change or a search is performed
      currentLoadedPageRef.current = data.currentPage;
      // Debug logging removed for production deployment
    }
  }, [data]);
  
  // Load more vehicles when scrolling to bottom - wrapped in useCallback to prevent recreation on every render
  const loadMoreVehicles = useCallback(async () => {
    if (!hasMore || loadingMore || !data) return;
    
    try {
      setLoadingMore(true);
      const nextPage = currentLoadedPageRef.current + 1;
      // Debug logging removed for production deployment
      
      // Create params for next page request
      const queryParams = new URLSearchParams(searchParams.toString());
      queryParams.set('page', nextPage.toString());
      
      const response = await fetch(`/api/vehicles?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch more vehicles');
      }
      
      const result = await response.json();
      // Debug logging removed for production deployment
      
      // Check if we received vehicles we already have by ID to prevent duplicates
      const existingIds = new Set(allVehicles.map((v: EnhancedVehicle) => v.id));
      const newVehicles = result.vehicles.filter((v: EnhancedVehicle) => !existingIds.has(v.id));
      
      if (newVehicles.length === 0) {
        // Debug logging removed for production deployment
        setHasMore(false);
        return;
      }
      
      // Append new vehicles to our existing list
      setAllVehicles(prev => [...prev, ...newVehicles]);
      
      // Update current page reference
      currentLoadedPageRef.current = nextPage;
      
      // Update if we have more to load
      setHasMore(nextPage < result.totalPages);
    } catch (error) {
      console.error('Error loading more vehicles:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [data, hasMore, loadingMore, allVehicles, searchParams]);
  
  // Setup intersection observer to detect when user scrolls to bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isSearching && !loadingMore) {
          loadMoreVehicles();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, loadingMore, isSearching, loadMoreVehicles]);

  // State to track if filter bar is in sticky/fixed position to adjust content margin
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  const filterBarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleResize = () => {
      if (filterBarRef.current) {
        setFilterBarHeight(filterBarRef.current.offsetHeight);
      }
    };
    
    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);
    
    // Re-calculate after component fully renders
    const timer = setTimeout(handleResize, 500);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="bg-neutral-100 min-h-screen">
      <SEO 
        title={getSeoTitle()}
        description={getSeoDescription()}
        keywords={`car dealerships near me, used cars, ${currentFilters.make ? currentFilters.make.join(', ') : ''} for sale, dealerships, vehicle listings`}
        url="https://specialoffer.autos/"
        type="website"
      />
      <Header 
        onSearch={handleSearch} 
        initialSearchValue={currentFilters.keyword || ""}
      />
      
      <div ref={filterBarRef}>
        <AlwaysVisibleFilterBar 
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
      </div>
      
      <main className="container mx-auto px-4 py-1" style={{ marginTop: filterBarHeight > 0 ? `${filterBarHeight * 0.3}px` : '0' }}>
        {/* Results Header */}
        <div className="flex flex-row flex-wrap justify-between items-center mb-1">
          <div>
            <h1 className="text-xl font-bold text-neutral-600">
              {isSearching 
                ? "Loading vehicles..." 
                : <span className="text-sm">Find the best deals across multiple dealerships</span>}
            </h1>
          </div>
          
          <div className="mt-0 md:mt-0 flex items-center">
            <span className="text-neutral-700 mr-2">Sort by:</span>
            <Select
              value={currentFilters.sortBy || 'relevance'}
              onValueChange={(value) => handleFilterChange({ sortBy: value as any })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="year_new">Year: Newest First</SelectItem>
                <SelectItem value="mileage_low">Mileage: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Vehicle Grid */}
        {isSearching && allVehicles.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md h-96 animate-pulse">
                <div className="bg-gray-300 h-60 rounded-t-xl"></div>
                <div className="p-4">
                  <div className="bg-gray-300 h-6 w-3/4 mb-2 rounded"></div>
                  <div className="bg-gray-300 h-6 w-1/4 mb-4 rounded"></div>
                  <div className="space-y-2">
                    <div className="bg-gray-300 h-4 w-2/3 rounded"></div>
                    <div className="bg-gray-300 h-4 w-1/2 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {allVehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allVehicles.map((vehicle) => (
                  <SafeVehicleCard 
                    key={vehicle.id}
                    vehicle={vehicle}
                    onClick={async () => {
                      // Track the view click
                      try {
                        await fetch(`/api/vehicles/${vehicle.id}/track-view`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                      } catch (error) {
                        console.error('Failed to track view click:', error);
                      }
                      
                      // Navigate to the vehicle details page
                      navigate(vehicle.vin ? `/vehicles/${vehicle.vin}` : `/vehicles/${vehicle.id}`);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold mb-2">No vehicles found</h3>
                <p className="text-neutral-600">Try changing your search criteria or filters</p>
              </div>
            )}
            
            {/* Load more indicator */}
            {(hasMore || loadingMore) && (
              <div 
                ref={loadMoreRef} 
                className="flex justify-center items-center py-8 mt-6"
              >
                {loadingMore ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="mt-2 text-neutral-600">Loading more vehicles...</p>
                  </div>
                ) : (
                  <p className="text-neutral-500">Scroll for more vehicles</p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
