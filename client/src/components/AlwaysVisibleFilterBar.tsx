import { useState, useEffect } from "react";
import { VehicleFilter } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, SlidersHorizontal, Car, Calendar, DollarSign, Gauge, Filter, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import prePurchaseInspection from "../assets/pre-purchase-inspection.svg";

interface AlwaysVisibleFilterBarProps {
  onFilterChange: (filters: Partial<VehicleFilter>) => void;
  currentFilters: VehicleFilter;
}

// Complete list of makes from the database, alphabetically sorted
const makeOptions = [
  "Aston Martin", "Audi", "BMW", "Cadillac", "Chevrolet", 
  "Chrysler", "Dodge", "Ford", "GMC", "Honda", 
  "Hyundai", "Infiniti", "Jaguar", "Jeep", "Land Rover", 
  "Lexus", "Lincoln", "Maserati", "Mazda", "Mercedes-Benz", 
  "Mini", "Nissan", "Porsche", "Ram", "Subaru", 
  "Tesla", "Toyota", "Volkswagen", "Volvo"
];

const yearOptions = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString());

const maxPriceValue = 200000;
const maxMileageValue = 200000;

export default function AlwaysVisibleFilterBar({ onFilterChange, currentFilters }: AlwaysVisibleFilterBarProps) {
  const isMobile = useIsMobile();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedMakes, setSelectedMakes] = useState<string[]>(currentFilters.make || []);
  const [yearMin, setYearMin] = useState<number | undefined>(currentFilters.yearMin);
  const [yearMax, setYearMax] = useState<number | undefined>(currentFilters.yearMax);
  const [maxPrice, setMaxPrice] = useState<number>(currentFilters.priceMax || maxPriceValue);
  const [maxMileage, setMaxMileage] = useState<number>(currentFilters.mileageMax || maxMileageValue);
  const [zipCode, setZipCode] = useState<string>(currentFilters.zipCode || "");
  const [location, setLocation] = useState<string>(currentFilters.location || "");
  const [distance, setDistance] = useState<number | undefined>(currentFilters.distance);
  
  // Fetch available locations
  const { data: locations = [] } = useQuery<{ location: string }[]>({
    queryKey: ['/api/locations'],
    refetchOnWindowFocus: false,
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  
  // Track scroll position for sticky behavior
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);
      setIsCompact(scrollPosition > 200); // Further scrolling makes it compact
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update local state when currentFilters change
  useEffect(() => {
    setSelectedMakes(currentFilters.make || []);
    setYearMin(currentFilters.yearMin);
    setYearMax(currentFilters.yearMax);
    setMaxPrice(currentFilters.priceMax || maxPriceValue);
    setMaxMileage(currentFilters.mileageMax || maxMileageValue);
    setZipCode(currentFilters.zipCode || "");
    setLocation(currentFilters.location || "");
    setDistance(currentFilters.distance);
  }, [currentFilters]);

  // Apply filters
  const applyFilters = () => {
    const newFilters = {
      make: selectedMakes,
      priceMax: maxPrice < maxPriceValue ? maxPrice : undefined,
      mileageMax: maxMileage < maxMileageValue ? maxMileage : undefined,
      yearMin,
      yearMax,
      zipCode: zipCode.trim() || undefined,
      location: location || undefined,
      distance: distance
    };
    
    onFilterChange(newFilters);
  };

  // Auto-apply filters when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [maxPrice, maxMileage, selectedMakes, yearMin, yearMax, zipCode, distance, location]);

  const toggleMake = (make: string) => {
    setSelectedMakes(prev => {
      return prev.includes(make) 
        ? prev.filter(m => m !== make)
        : [...prev, make];
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
      location: undefined, // Reset location filter
      distance: undefined,
      sortBy: 'relevance', // Reset sort to default
      _forceReset: true
    };
    
    // Reset all local state values
    setSelectedMakes([]);
    setMaxPrice(maxPriceValue);
    setMaxMileage(maxMileageValue);
    setYearMin(undefined);
    setYearMax(undefined);
    setZipCode("");
    setLocation(""); // Reset location state
    setDistance(undefined);
    
    // Apply the reset
    onFilterChange(resetFilters);
  };

  const formatPrice = (value: number) => 
    value >= maxPriceValue ? 
      "No Limit" : 
      `$${value.toLocaleString()}`;

  const formatMileage = (value: number) => 
    value >= maxMileageValue ? 
      "No Limit" : 
      `${value.toLocaleString()} mi`;

  const hasActiveFilters = selectedMakes.length > 0 || yearMin || yearMax || 
    maxPrice < maxPriceValue || maxMileage < maxMileageValue || 
    (zipCode && zipCode.trim() !== "") || distance !== undefined || 
    (location && location.trim() !== "");

  // For mobile, we'll show a button that expands the filters
  if (isMobile) {
    return (
      <div className={`${isScrolled ? 'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out' : 'relative'} 
                     ${isCompact ? 'shadow-xl bg-white/95 backdrop-blur-sm' : 'bg-white shadow-md rounded-lg'} 
                     mb-4 overflow-hidden ${isScrolled ? 'px-4' : ''}`}>
        <div className={`p-3 border-b ${isCompact ? 'border-transparent' : ''}`}>
          <div className="flex justify-between items-center">
            <Button 
              variant={isCompact ? "default" : "outline"}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`flex items-center justify-between ${isCompact ? 'w-auto px-3 rounded-full shadow-md' : 'w-full'}`}
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>{isCompact ? 'Filter' : `Filters ${hasActiveFilters && `(${selectedMakes.length + (yearMin ? 1 : 0) + (yearMax ? 1 : 0) + (maxPrice < maxPriceValue ? 1 : 0) + (maxMileage < maxMileageValue ? 1 : 0) + ((zipCode && zipCode.trim() !== "") ? 1 : 0) + (distance !== undefined ? 1 : 0)})`}`}</span>
              </div>
              {showMobileFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {/* Mobile Pre Purchase Inspection Banner */}
            <a 
              href="https://prepurchaseinspection.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2"
            >
              <img 
                src={prePurchaseInspection} 
                alt="Pre Purchase Inspection" 
                className="h-10 hover:opacity-90 transition-opacity" 
              />
            </a>
          </div>
          
          {/* Active Filter Pills */}
          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedMakes.map(make => (
                <Badge key={make} variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  {make}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeMake(make)}
                  />
                </Badge>
              ))}
              {(yearMin || yearMax) && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Year: {yearMin || ''}{yearMin && yearMax ? ' - ' : ''}{yearMax || ''}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => { setYearMin(undefined); setYearMax(undefined); }}
                  />
                </Badge>
              )}
              {maxPrice < maxPriceValue && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Max: ${maxPrice.toLocaleString()}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setMaxPrice(maxPriceValue)}
                  />
                </Badge>
              )}
              {maxMileage < maxMileageValue && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Max: {maxMileage.toLocaleString()} mi
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setMaxMileage(maxMileageValue)}
                  />
                </Badge>
              )}
              {(zipCode && zipCode.trim() !== "") && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Zip: {zipCode.trim()}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setZipCode("")}
                  />
                </Badge>
              )}
              {(location && location.trim() !== "") && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Location: {location}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      setLocation("");
                      // Direct callback to apply filter immediately
                      onFilterChange({...currentFilters, location: undefined});
                    }}
                  />
                </Badge>
              )}
              {distance !== undefined && (
                <Badge variant="outline" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700">
                  Within: {distance} miles
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setDistance(undefined)}
                  />
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Expandable filters for mobile */}
        {showMobileFilters && (
          <div className="p-3 border-t">
            <div className="space-y-4">
              {/* Make Selector */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        <span>Make/Brand {selectedMakes.length > 0 && `(${selectedMakes.length})`}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-[300px] overflow-y-auto">
                        {makeOptions.map((make) => (
                          <div key={make} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`make-${make}`} 
                              checked={selectedMakes.includes(make)}
                              onCheckedChange={() => toggleMake(make)}
                            />
                            <Label 
                              htmlFor={`make-${make}`}
                              className="cursor-pointer text-sm font-normal"
                            >
                              {make}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Year Range Selector */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium">From Year - To Year</Label>
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
              
              {/* Price Range Slider */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <div className="flex justify-between w-full">
                    <Label className="text-sm font-medium">Price: {formatPrice(maxPrice)}</Label>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={maxPriceValue}
                  step={1000}
                  value={[maxPrice]}
                  onValueChange={(value) => setMaxPrice(value[0])}
                  className="w-full"
                />
              </div>
              
              {/* Mileage Range Slider */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gauge className="h-4 w-4 text-blue-600" />
                  <div className="flex justify-between w-full">
                    <Label className="text-sm font-medium">Mileage: {formatMileage(maxMileage)}</Label>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={maxMileageValue}
                  step={1000}
                  value={[maxMileage]}
                  onValueChange={(value) => setMaxMileage(value[0])}
                  className="w-full"
                />
              </div>
              
              {/* Location Filter */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium">Location</Label>
                </div>
                <Select
                  value={location || "any_location"}
                  onValueChange={(value) => {
                    const newLocation = value !== "any_location" ? value : "";
                    setLocation(newLocation);
                    onFilterChange({...currentFilters, location: newLocation || undefined});
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_location">All Locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.location} value={loc.location}>
                        {loc.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Reset Filters Button */}
              <Button 
                variant="outline" 
                onClick={handleResetFilters}
                size="sm"
                className="w-full mt-4 text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Reset All Filters
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop version with horizontal layout
  return (
    <div className={`${isScrolled ? 'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out' : 'relative'} 
                   ${isCompact ? 'shadow-xl bg-white/95 backdrop-blur-sm rounded-b-lg' : 'bg-white shadow-md rounded-lg'} 
                   p-4 mb-4`}>
      <div className="flex flex-wrap gap-3 items-center justify-between container mx-auto">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Make Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Car className="h-4 w-4 mr-2" />
                Make/Brand {selectedMakes.length > 0 && `(${selectedMakes.length})`}
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start">
              <div className="p-4">
                <div className="grid grid-cols-1 gap-y-2 max-h-[300px] overflow-y-auto">
                  {makeOptions.map((make) => (
                    <div key={make} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`make-${make}`} 
                        checked={selectedMakes.includes(make)}
                        onCheckedChange={() => toggleMake(make)}
                      />
                      <Label 
                        htmlFor={`make-${make}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {make}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Year Range */}
          <div className="flex items-center gap-1">
            <Select
              value={yearMin?.toString() || "any_year_min"}
              onValueChange={(value) => setYearMin((value && value !== "any_year_min") ? parseInt(value, 10) : undefined)}
            >
              <SelectTrigger className="w-[120px] h-9">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                <SelectValue placeholder="Year From" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any_year_min">Any Year</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={`min-${year}`} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mx-1">-</span>
            <Select
              value={yearMax?.toString() || "any_year_max"}
              onValueChange={(value) => setYearMax((value && value !== "any_year_max") ? parseInt(value, 10) : undefined)}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Year To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any_year_max">Any Year</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={`max-${year}`} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Price Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <DollarSign className="h-4 w-4 mr-2" />
                Price
                {maxPrice < maxPriceValue && (
                  <Badge className="ml-2 bg-blue-600">Max: ${maxPrice.toLocaleString()}</Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Max Price</Label>
                    <div className="text-sm">
                      {formatPrice(maxPrice)}
                    </div>
                  </div>
                  <Slider
                    defaultValue={[maxPrice]}
                    value={[maxPrice]}
                    min={0}
                    max={maxPriceValue}
                    step={1000}
                    onValueChange={(value) => setMaxPrice(value[0])}
                    className="my-6"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Mileage Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Gauge className="h-4 w-4 mr-2" />
                Mileage
                {maxMileage < maxMileageValue && (
                  <Badge className="ml-2 bg-blue-600">Max: {maxMileage.toLocaleString()} mi</Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Max Miles</Label>
                    <div className="text-sm">
                      {formatMileage(maxMileage)}
                    </div>
                  </div>
                  <Slider
                    defaultValue={[maxMileage]}
                    value={[maxMileage]}
                    min={0}
                    max={maxMileageValue}
                    step={1000}
                    onValueChange={(value) => setMaxMileage(value[0])}
                    className="my-6"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Location Filter */}
          <Select
            value={location || "any_location"}
            onValueChange={(value) => {
              // Debug logs
              console.log("Location selected:", value);
              const newLocation = value !== "any_location" ? value : "";
              console.log("Setting location to:", newLocation);
              setLocation(newLocation);
              
              // Apply the filter directly instead of relying on the useEffect
              const newFilters = {
                ...currentFilters,
                location: newLocation || undefined
              };
              
              // Use direct callback instead of setTimeout
              onFilterChange(newFilters);
            }}
          >
            <SelectTrigger className="h-9 w-auto">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="truncate max-w-[100px]">{location ? location : "Location"}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any_location">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.location} value={loc.location}>
                  {loc.location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Clear Filters Button - only show when filters are active */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              onClick={handleResetFilters}
              size="sm"
              className="text-red-600 hover:text-red-800 hover:bg-red-50 h-9"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
        
        {/* Pre Purchase Inspection Banner */}
        <a 
          href="https://prepurchaseinspection.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-shrink-0 hover:opacity-90 transition-opacity"
        >
          <img 
            src={prePurchaseInspection} 
            alt="Pre Purchase Inspection" 
            className="h-10"
          />
        </a>
      </div>
      
      {/* Active Filter Pills - desktop version */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedMakes.map(make => (
            <Badge key={make} variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              {make}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeMake(make)}
              />
            </Badge>
          ))}
          {(yearMin || yearMax) && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Year: {yearMin || ''}{yearMin && yearMax ? ' - ' : ''}{yearMax || ''}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => { setYearMin(undefined); setYearMax(undefined); }}
              />
            </Badge>
          )}
          {maxPrice < maxPriceValue && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Max: ${maxPrice.toLocaleString()}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setMaxPrice(maxPriceValue)}
              />
            </Badge>
          )}
          {maxMileage < maxMileageValue && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Max: {maxMileage.toLocaleString()} mi
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setMaxMileage(maxMileageValue)}
              />
            </Badge>
          )}
          {(zipCode && zipCode.trim() !== "") && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Zip: {zipCode.trim()}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setZipCode("")}
              />
            </Badge>
          )}
          {(location && location.trim() !== "") && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Location: {location}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                setLocation("");
                // Direct callback to apply filter immediately
                onFilterChange({...currentFilters, location: undefined});
              }}
              />
            </Badge>
          )}
          {distance !== undefined && (
            <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              Within: {distance} miles
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setDistance(undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}