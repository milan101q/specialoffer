import { useState, useEffect } from "react";
import { VehicleFilter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { X, SlidersHorizontal, Car, Calendar, DollarSign, Gauge, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FilterSystemProps {
  isOpen: boolean;
  onFilterChange: (filters: Partial<VehicleFilter>) => void;
  currentFilters: VehicleFilter;
}

// This should ideally come from the API for dynamic options
const makeOptions = [
  "Toyota", "Honda", "Ford", "Chevrolet", "BMW", 
  "Mercedes-Benz", "Audi", "Lexus", "Tesla", "Volkswagen",
  "Nissan", "Mazda", "Hyundai", "Kia", "Subaru", "Jeep", 
  "Ram", "Dodge", "Cadillac", "Lincoln", "Volvo"
];

const yearOptions = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString());

const priceRanges = [0, 200000];
const mileageRanges = [0, 200000];

export default function FilterSystem({ isOpen, onFilterChange, currentFilters }: FilterSystemProps) {
  const [tempFilters, setTempFilters] = useState<Partial<VehicleFilter>>(currentFilters);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    tempFilters.priceMin || priceRanges[0], 
    tempFilters.priceMax || priceRanges[1]
  ]);
  const [mileageRange, setMileageRange] = useState<[number, number]>([
    tempFilters.mileageMin || mileageRanges[0], 
    tempFilters.mileageMax || mileageRanges[1]
  ]);
  const [selectedMakes, setSelectedMakes] = useState<string[]>(tempFilters.make || []);
  const [yearMin, setYearMin] = useState<number | undefined>(tempFilters.yearMin);
  const [yearMax, setYearMax] = useState<number | undefined>(tempFilters.yearMax);
  const [zipCode, setZipCode] = useState<string>(tempFilters.zipCode || "");
  const [location, setLocation] = useState<string>(tempFilters.location || "");
  const [distance, setDistance] = useState<number | undefined>(tempFilters.distance);
  
  // Get dealerships for dealership filter
  const { data: dealershipsData } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/dealerships'],
    enabled: isOpen, // Only fetch when filter is open
  });
  
  // Update local state when currentFilters change
  useEffect(() => {
    setTempFilters(currentFilters);
    setPriceRange([
      currentFilters.priceMin || priceRanges[0], 
      currentFilters.priceMax || priceRanges[1]
    ]);
    setMileageRange([
      currentFilters.mileageMin || mileageRanges[0], 
      currentFilters.mileageMax || mileageRanges[1]
    ]);
    setSelectedMakes(currentFilters.make || []);
    setYearMin(currentFilters.yearMin);
    setYearMax(currentFilters.yearMax);
    setZipCode(currentFilters.zipCode || "");
    setLocation(currentFilters.location || "");
    setDistance(currentFilters.distance);
  }, [currentFilters]);

  // Apply changes in real-time debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      const newFilters = {
        ...tempFilters,
        make: selectedMakes,
        priceMin: priceRange[0] > 0 ? priceRange[0] : undefined,
        priceMax: priceRange[1] < priceRanges[1] ? priceRange[1] : undefined,
        mileageMin: mileageRange[0] > 0 ? mileageRange[0] : undefined,
        mileageMax: mileageRange[1] < mileageRanges[1] ? mileageRange[1] : undefined,
        yearMin,
        yearMax,
        zipCode,
        location,
        distance
      };
      
      console.log('Sending filter update to parent with make:', JSON.stringify(newFilters.make));
      onFilterChange(newFilters);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [priceRange, mileageRange, selectedMakes, yearMin, yearMax, zipCode, location, distance]);

  const toggleMake = (make: string) => {
    console.log('Toggling make filter:', make);
    setSelectedMakes(prev => {
      const newMakes = prev.includes(make) 
        ? prev.filter(m => m !== make)
        : [...prev, make];
      console.log('Updated selected makes:', newMakes);
      return newMakes;
    });
  };

  const removeMake = (make: string) => {
    setSelectedMakes(prev => prev.filter(m => m !== make));
  };

  const handleResetFilters = () => {
    // Create a hard reset filters object that explicitly sets all filters to undefined
    const resetFilters: Partial<VehicleFilter> = {
      page: 1, // Always go back to page 1 on filter reset
      limit: currentFilters.limit, // Preserve items per page
      make: [],
      yearMin: undefined,
      yearMax: undefined,
      priceMin: undefined,
      priceMax: undefined,
      mileageMin: undefined, 
      mileageMax: undefined,
      zipCode: undefined,
      location: undefined,
      distance: undefined,
      dealershipId: undefined,
      sortBy: 'relevance', // Reset sort to default
      keyword: undefined, // Clear search keyword too
    };
    
    // Reset all local state values - ensure they are completely cleared
    setTempFilters(resetFilters);
    setSelectedMakes([]);
    setPriceRange([priceRanges[0], priceRanges[1]]);
    setMileageRange([mileageRanges[0], mileageRanges[1]]);
    setYearMin(undefined);
    setYearMax(undefined);
    setZipCode("");
    setLocation("");
    setDistance(undefined);
    
    // Force a small delay to ensure UI updates before making the API call
    setTimeout(() => {
      // Apply the reset filters with a force flag
      onFilterChange({...resetFilters, _forceReset: true});
    }, 10);
  };

  const formatPrice = (value: number) => 
    value >= priceRanges[1] ? 
      "Any Price" : 
      `$${value.toLocaleString()}`;

  const formatMileage = (value: number) => 
    value >= mileageRanges[1] ? 
      "Any Mileage" : 
      `${value.toLocaleString()} mi`;

  const hasActiveFilters = selectedMakes.length > 0 || yearMin || yearMax || 
    priceRange[0] > priceRanges[0] || priceRange[1] < priceRanges[1] || 
    mileageRange[0] > mileageRanges[0] || mileageRange[1] < mileageRanges[1] || 
    tempFilters.dealershipId !== undefined || 
    (zipCode && zipCode.trim() !== "") || 
    (location && location.trim() !== "") ||
    distance !== undefined;

  return (
    <div 
      className={`mt-4 bg-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden ${
        isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      {isOpen && (
        <div className="p-4">
          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Active Filters</h3>
                <Button 
                  variant="ghost" 
                  onClick={handleResetFilters}
                  size="sm"
                  className="text-xs h-7 px-2 text-red-600 hover:text-red-800 font-medium"
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMakes.map(make => (
                  <Badge key={make} variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    {make}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeMake(make)}
                    />
                  </Badge>
                ))}
                {yearMin && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    From: {yearMin}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setYearMin(undefined)}
                    />
                  </Badge>
                )}
                {yearMax && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    To: {yearMax}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setYearMax(undefined)}
                    />
                  </Badge>
                )}
                {priceRange[0] > priceRanges[0] && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Min: {formatPrice(priceRange[0])}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setPriceRange([priceRanges[0], priceRange[1]])}
                    />
                  </Badge>
                )}
                {priceRange[1] < priceRanges[1] && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Max: {formatPrice(priceRange[1])}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setPriceRange([priceRange[0], priceRanges[1]])}
                    />
                  </Badge>
                )}
                {mileageRange[0] > mileageRanges[0] && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Min: {formatMileage(mileageRange[0])}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setMileageRange([mileageRanges[0], mileageRange[1]])}
                    />
                  </Badge>
                )}
                {mileageRange[1] < mileageRanges[1] && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Max: {formatMileage(mileageRange[1])}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setMileageRange([mileageRange[0], mileageRanges[1]])}
                    />
                  </Badge>
                )}
                {tempFilters.dealershipId && dealershipsData && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Dealership: {dealershipsData.find(d => d.id === tempFilters.dealershipId)?.name}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setTempFilters({...tempFilters, dealershipId: undefined})}
                    />
                  </Badge>
                )}
                {zipCode && zipCode.trim() !== "" && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    ZIP: {zipCode}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setZipCode("");
                        onFilterChange({zipCode: ""});
                      }}
                    />
                  </Badge>
                )}
                {location && location.trim() !== "" && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Location: {location}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setLocation("");
                        onFilterChange({location: ""});
                      }}
                    />
                  </Badge>
                )}
                {distance && (
                  <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    Distance: {distance} miles
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setDistance(undefined);
                        onFilterChange({distance: undefined});
                      }}
                    />
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Mobile-friendly Filter Accordion for small screens */}
          <div className="block md:hidden">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700">Filter Options</h3>
              <Button 
                variant="ghost" 
                onClick={handleResetFilters}
                size="sm"
                className="text-xs h-7 px-2 text-red-600 hover:text-red-800 font-medium"
              >
                Reset All
              </Button>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="make">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-blue-600" />
                    <span>Make/Brand</span>
                    {selectedMakes.length > 0 && (
                      <Badge className="ml-2 bg-blue-600">{selectedMakes.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-4">
                      {makeOptions.map((make) => (
                        <div key={make} className="flex items-center space-x-2 mb-1">
                          <Checkbox 
                            id={`mob-make-${make}`} 
                            checked={selectedMakes.includes(make)}
                            onCheckedChange={() => toggleMake(make)}
                          />
                          <Label 
                            htmlFor={`mob-make-${make}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            {make}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="year">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>Year Range</span>
                    {(yearMin || yearMax) && (
                      <Badge className="ml-2 bg-blue-600">Active</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex space-x-2">
                    <Select
                      value={yearMin?.toString() || "any_year_min"}
                      onValueChange={(value) => setYearMin((value && value !== "any_year_min") ? parseInt(value, 10) : undefined)}
                    >
                      <SelectTrigger className="w-1/2">
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any_year_min">Any Year</SelectItem>
                        {yearOptions.map((year) => (
                          <SelectItem key={`min-${year}`} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={yearMax?.toString() || "any_year_max"}
                      onValueChange={(value) => setYearMax((value && value !== "any_year_max") ? parseInt(value, 10) : undefined)}
                    >
                      <SelectTrigger className="w-1/2">
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any_year_max">Any Year</SelectItem>
                        {yearOptions.map((year) => (
                          <SelectItem key={`max-${year}`} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="price">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span>Price Range</span>
                    {(priceRange[0] > priceRanges[0] || priceRange[1] < priceRanges[1]) && (
                      <Badge className="ml-2 bg-blue-600">Active</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-2">
                    <div className="flex justify-between items-center mb-2 text-xs">
                      <span className="font-medium">{formatPrice(priceRange[0])}</span>
                      <span className="font-medium">{formatPrice(priceRange[1])}</span>
                    </div>
                    <Slider
                      defaultValue={[priceRanges[0], priceRanges[1]]}
                      value={priceRange}
                      max={priceRanges[1]}
                      step={1000}
                      onValueChange={(value) => setPriceRange(value as [number, number])}
                      className="mb-4"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="mileage">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-blue-600" />
                    <span>Mileage</span>
                    {(mileageRange[0] > mileageRanges[0] || mileageRange[1] < mileageRanges[1]) && (
                      <Badge className="ml-2 bg-blue-600">Active</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-2">
                    <div className="flex justify-between items-center mb-2 text-xs">
                      <span className="font-medium">{formatMileage(mileageRange[0])}</span>
                      <span className="font-medium">{formatMileage(mileageRange[1])}</span>
                    </div>
                    <Slider
                      defaultValue={[mileageRanges[0], mileageRanges[1]]}
                      value={mileageRange}
                      max={mileageRanges[1]}
                      step={1000}
                      onValueChange={(value) => setMileageRange(value as [number, number])}
                      className="mb-4"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              {dealershipsData && dealershipsData.length > 0 && (
                <AccordionItem value="dealership">
                  <AccordionTrigger className="py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-blue-600" />
                      <span>Dealership</span>
                      {tempFilters.dealershipId && (
                        <Badge className="ml-2 bg-blue-600">Selected</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Select
                      value={tempFilters.dealershipId?.toString() || "all_dealerships"}
                      onValueChange={(value) => {
                        setTempFilters({
                          ...tempFilters, 
                          dealershipId: (value && value !== "all_dealerships") ? parseInt(value, 10) : undefined
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Dealerships" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_dealerships">All Dealerships</SelectItem>
                        {dealershipsData.map((dealership) => (
                          <SelectItem key={dealership.id} value={dealership.id.toString()}>
                            {dealership.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AccordionContent>
                </AccordionItem>
              )}
              
              <AccordionItem value="location">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-600">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Location</span>
                    {((zipCode && zipCode.trim() !== "") || (location && location.trim() !== "") || distance) && (
                      <Badge className="ml-2 bg-blue-600">Active</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="mob-zipCode" className="text-sm font-medium">
                        ZIP Code
                      </Label>
                      <Input
                        id="mob-zipCode"
                        type="text"
                        pattern="[0-9]*"
                        maxLength={5}
                        placeholder="Enter ZIP code"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mob-location" className="text-sm font-medium">
                        Location
                      </Label>
                      <Input
                        id="mob-location"
                        type="text"
                        placeholder="Enter city, state (e.g. Chantilly, VA)"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mob-distance" className="text-sm font-medium">
                        Distance (miles)
                      </Label>
                      <Select
                        value={distance?.toString() || ""}
                        onValueChange={(value) => {
                          setDistance(value ? parseInt(value, 10) : undefined);
                        }}
                      >
                        <SelectTrigger id="mob-distance" className="mt-1 h-8">
                          <SelectValue placeholder="Select distance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any distance</SelectItem>
                          <SelectItem value="5">5 miles</SelectItem>
                          <SelectItem value="10">10 miles</SelectItem>
                          <SelectItem value="25">25 miles</SelectItem>
                          <SelectItem value="50">50 miles</SelectItem>
                          <SelectItem value="100">100 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          {/* Desktop Filter Layout */}
          <div className="hidden md:block">
            <div className="grid grid-cols-12 gap-6">
              {/* Make/Brand Multi-Select Filter */}
              <div className="col-span-4">
                <div className="filter-card">
                  <div className="filter-header">
                    <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                      <Car className="h-4 w-4" />
                      <span>Make/Brand</span>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                    <div className="grid grid-cols-2 gap-x-4">
                      {makeOptions.map((make) => (
                        <div key={make} className="flex items-center space-x-2 mb-1">
                          <Checkbox 
                            id={`make-${make}`} 
                            checked={selectedMakes.includes(make)}
                            onCheckedChange={() => {
                              console.log('CHECKBOX - toggling make:', make, 'was checked:', selectedMakes.includes(make));
                              toggleMake(make);
                            }}
                          />
                          <Label 
                            htmlFor={`make-${make}`}
                            className="cursor-pointer text-sm font-normal"
                            onClick={() => {
                              console.log('LABEL - toggling make:', make, 'was checked:', selectedMakes.includes(make));
                              toggleMake(make);
                            }}
                          >
                            {make}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-span-8">
                <div className="grid grid-cols-2 gap-4">
                  {/* Year Range */}
                  <div>
                    <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                      <Calendar className="h-4 w-4" />
                      <span>Year Range</span>
                    </div>
                    <div className="flex space-x-2">
                      <Select
                        value={yearMin?.toString() || "any_year_min"}
                        onValueChange={(value) => setYearMin((value && value !== "any_year_min") ? parseInt(value, 10) : undefined)}
                      >
                        <SelectTrigger className="w-1/2">
                          <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any_year_min">Any Year</SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem key={`min-${year}`} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={yearMax?.toString() || "any_year_max"}
                        onValueChange={(value) => setYearMax((value && value !== "any_year_max") ? parseInt(value, 10) : undefined)}
                      >
                        <SelectTrigger className="w-1/2">
                          <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any_year_max">Any Year</SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem key={`max-${year}`} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Dealership Filter */}
                  {dealershipsData && dealershipsData.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                        <Store className="h-4 w-4" />
                        <span>Dealership</span>
                      </div>
                      <Select
                        value={tempFilters.dealershipId?.toString() || "all_dealerships"}
                        onValueChange={(value) => {
                          setTempFilters({
                            ...tempFilters, 
                            dealershipId: (value && value !== "all_dealerships") ? parseInt(value, 10) : undefined
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Dealerships" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_dealerships">All Dealerships</SelectItem>
                          {dealershipsData.map((dealership) => (
                            <SelectItem key={dealership.id} value={dealership.id.toString()}>
                              {dealership.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Location Filter */}
                  <div>
                    <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>Location</span>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <Input
                          type="text"
                          pattern="[0-9]*"
                          maxLength={5}
                          placeholder="ZIP Code"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          className="h-9"
                        />
                        <Input
                          type="text"
                          placeholder="City, State (e.g. Chantilly, VA)"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Select
                          value={distance?.toString() || ""}
                          onValueChange={(value) => {
                            setDistance(value ? parseInt(value, 10) : undefined);
                          }}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Distance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Any distance</SelectItem>
                            <SelectItem value="5">5 miles</SelectItem>
                            <SelectItem value="10">10 miles</SelectItem>
                            <SelectItem value="25">25 miles</SelectItem>
                            <SelectItem value="50">50 miles</SelectItem>
                            <SelectItem value="100">100 miles</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Price Range Slider */}
                  <div className="col-span-2 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-800 font-medium">
                        <DollarSign className="h-4 w-4" />
                        <span>Price Range</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{formatPrice(priceRange[0])}</span>
                        <span className="mx-2">-</span>
                        <span className="font-medium">{formatPrice(priceRange[1])}</span>
                      </div>
                    </div>
                    <Slider
                      defaultValue={[priceRanges[0], priceRanges[1]]}
                      value={priceRange}
                      max={priceRanges[1]}
                      step={1000}
                      onValueChange={(value) => setPriceRange(value as [number, number])}
                      className="mb-4"
                    />
                  </div>
                  
                  {/* Mileage Range Slider */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-800 font-medium">
                        <Gauge className="h-4 w-4" />
                        <span>Mileage</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{formatMileage(mileageRange[0])}</span>
                        <span className="mx-2">-</span>
                        <span className="font-medium">{formatMileage(mileageRange[1])}</span>
                      </div>
                    </div>
                    <Slider
                      defaultValue={[mileageRanges[0], mileageRanges[1]]}
                      value={mileageRange}
                      max={mileageRanges[1]}
                      step={1000}
                      onValueChange={(value) => setMileageRange(value as [number, number])}
                      className="mb-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Filters Button (Desktop only) */}
          <div className="hidden md:flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={handleResetFilters}
              size="sm"
              className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              Reset All Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}