import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import VehicleCard from "@/components/VehicleCard";
import FilterSystem from "@/components/FilterSystem";
import { Pagination } from "@/components/ui/pagination";
import { Vehicle, VehicleFilter } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(() => searchParams.get('keyword') || "");
  
  // Convert search params to filter params object
  const getFilterParamsFromUrl = (): VehicleFilter => {
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12;
    const sortBy = (searchParams.get('sortBy') as any) || 'relevance';
    const keyword = searchParams.get('keyword') || undefined;
    
    const filterParams: VehicleFilter = {
      page,
      limit,
      sortBy
    };
    
    // Add optional params if they exist in URL
    if (keyword) filterParams.keyword = keyword;
    if (searchParams.get('yearMin')) filterParams.yearMin = parseInt(searchParams.get('yearMin')!);
    if (searchParams.get('yearMax')) filterParams.yearMax = parseInt(searchParams.get('yearMax')!);
    if (searchParams.get('priceMin')) filterParams.priceMin = parseInt(searchParams.get('priceMin')!);
    if (searchParams.get('priceMax')) filterParams.priceMax = parseInt(searchParams.get('priceMax')!);
    if (searchParams.get('mileageMin')) filterParams.mileageMin = parseInt(searchParams.get('mileageMin')!);
    if (searchParams.get('mileageMax')) filterParams.mileageMax = parseInt(searchParams.get('mileageMax')!);
    if (searchParams.get('zipCode')) filterParams.zipCode = searchParams.get('zipCode')!;
    if (searchParams.get('distance')) filterParams.distance = parseInt(searchParams.get('distance')!);
    if (searchParams.get('dealershipId')) filterParams.dealershipId = parseInt(searchParams.get('dealershipId')!);
    
    // Handle multi-value params (make)
    const makes = searchParams.getAll('make');
    if (makes.length > 0) {
      filterParams.make = makes;
    }
    
    return filterParams;
  };

  // Build query string from filter params
  const buildQueryString = (params: VehicleFilter) => {
    const queryParams = new URLSearchParams();
    
    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.make && params.make.length > 0) {
      params.make.forEach(make => queryParams.append('make', make));
    }
    if (params.yearMin) queryParams.append('yearMin', params.yearMin.toString());
    if (params.yearMax) queryParams.append('yearMax', params.yearMax.toString());
    if (params.priceMin) queryParams.append('priceMin', params.priceMin.toString());
    if (params.priceMax) queryParams.append('priceMax', params.priceMax.toString());
    if (params.mileageMin) queryParams.append('mileageMin', params.mileageMin.toString());
    if (params.mileageMax) queryParams.append('mileageMax', params.mileageMax.toString());
    if (params.zipCode) queryParams.append('zipCode', params.zipCode);
    if (params.distance) queryParams.append('distance', params.distance.toString());
    if (params.sortBy && params.sortBy !== 'relevance') queryParams.append('sortBy', params.sortBy);
    if (params.page && params.page > 1) queryParams.append('page', params.page.toString());
    if (params.limit && params.limit !== 12) queryParams.append('limit', params.limit.toString());
    if (params.dealershipId) queryParams.append('dealershipId', params.dealershipId.toString());
    
    return queryParams.toString();
  };

  // Fetch vehicles with filters
  const { data, isLoading, isFetching, refetch } = useQuery<{
    vehicles: EnhancedVehicle[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }>({
    queryKey: ['/api/vehicles', JSON.stringify(filterParams)], // Use JSON.stringify to ensure query key changes
    queryFn: async () => {
      const queryString = buildQueryString(filterParams);
      console.log("Fetching with query:", queryString, "Page:", filterParams.page);
      const response = await fetch(`/api/vehicles?${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      const result = await response.json();
      console.log("Server response data:", result);
      console.log("Received page:", result.currentPage, "of", result.totalPages);
      return result;
    },
    // Disable caching
    staleTime: 0, 
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  // Handle search from header - this is now live/instant
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setFilterParams({
      ...filterParams,
      keyword,
      page: 1 // Reset to first page when searching
    });
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<VehicleFilter>) => {
    setFilterParams({
      ...filterParams,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    });
  };

  // Handle pagination
  const handlePageChange = async (page: number) => {
    console.log(`Changing to page ${page}`);
    
    if (page === filterParams.page) {
      console.log("Already on page", page);
      return; // Avoid unnecessary re-renders if already on the page
    }
    
    // Create a completely new object to ensure React detects the change
    const updatedFilters = {
      ...JSON.parse(JSON.stringify(filterParams)), // Create a deep copy
      page: page
    };
    
    console.log("Updated filters:", updatedFilters);
    
    // Update state with the new page
    setFilterParams(updatedFilters);
    
    // Force URL update immediately
    const queryString = buildQueryString(updatedFilters);
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
    window.history.pushState({}, '', newUrl);
    
    // DIRECT APPROACH: Manually fetch the data for the new page without relying on React Query
    try {
      console.log("DIRECT FETCH for page:", page);
      const response = await fetch(`/api/vehicles?${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      // Force React Query to update with new data
      queryClient.setQueryData(['/api/vehicles', JSON.stringify(updatedFilters)], await response.json());
      
      // Now trigger a refetch to ensure everything is in sync
      refetch();
    } catch (error) {
      console.error("Error with direct page fetch:", error);
      // Fall back to normal refetch
      refetch();
    }
    
    // Scroll to top when changing pages
    window.scrollTo(0, 0);
  };

  const isSearching = isLoading || isFetching;

  return (
    <div className="bg-neutral-100 min-h-screen">
      <Header 
        onSearch={handleSearch} 
        onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
        isFilterOpen={isFilterOpen}
        initialSearchValue={searchKeyword}
      />
      
      <FilterSystem 
        isOpen={isFilterOpen} 
        onFilterChange={handleFilterChange}
        currentFilters={filterParams}
      />
      
      <main className="container mx-auto px-4 py-8">
        {/* Results Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Available Vehicles</h1>
            <p className="text-neutral-600">
              {isSearching 
                ? "Loading vehicles..." 
                : `Showing ${data?.vehicles.length || 0} of ${data?.totalCount || 0} vehicles matching your criteria`}
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center">
            <span className="text-neutral-700 mr-2">Sort by:</span>
            <Select
              value={filterParams.sortBy || 'relevance'}
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
        {isSearching ? (
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
            {data?.vehicles && data.vehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data.vehicles.map((vehicle) => (
                  <VehicleCard 
                    key={vehicle.id}
                    vehicle={vehicle}
                    onClick={() => setLocation(`/vehicles/${vehicle.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold mb-2">No vehicles found</h3>
                <p className="text-neutral-600">Try changing your search criteria or filters</p>
              </div>
            )}
          </>
        )}
        
        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="mt-10 flex justify-center">
            <div className="flex flex-col items-center">
              <Pagination
                currentPage={filterParams.page || 1} // Use our local state instead of API response
                totalPages={data.totalPages}
                onPageChange={handlePageChange}
              />
              <div className="text-sm text-gray-500 mt-2">
                Page {filterParams.page || 1} of {data.totalPages}
                {filterParams.page !== data.currentPage && (
                  <span className="ml-2 text-red-500">
                    (API returned page {data.currentPage})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
