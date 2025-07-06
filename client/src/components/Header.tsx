import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/SearchBar";
import { PlusCircle } from "lucide-react";
import bannerImage from "../assets/specialoffer-autos-logo.jpg";

interface HeaderProps {
  onSearch?: (keyword: string) => void;
  initialSearchValue?: string;
}

interface SiteSettings {
  showListDealershipButton: boolean;
}

export default function Header({ onSearch, initialSearchValue = "" }: HeaderProps) {
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState(initialSearchValue);
  
  // Fetch site settings to determine if we should show the List Dealership button
  const { data: siteSettings, isLoading: isLoadingSettings } = useQuery<SiteSettings>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    if (initialSearchValue !== undefined) {
      setSearchKeyword(initialSearchValue);
    }
  }, [initialSearchValue]);

  const handleSearchChange = (value: string) => {
    setSearchKeyword(value);
    // Trigger search immediately for real-time results
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleSearchSubmit = () => {
    // This is still useful for the Enter key or search button clicks
    if (onSearch) {
      onSearch(searchKeyword);
    }
  };

  const handleAdminClick = () => {
    navigate("/admin");
  };
  
  const handleAddInventoryClick = () => {
    console.log("Add Inventory button clicked");
    navigate("/add-inventory");
  };

  return (
    <header className="bg-gradient-to-r from-gray-50 to-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row justify-between items-center">
          <div className="flex items-center mb-4 lg:mb-0">
            <Link to="/" className="flex items-center">
              <img src={bannerImage} alt="SpecialOffer.Autos Logo" className="h-16 max-w-xs object-contain transition-transform hover:scale-105 duration-300" />
              <span className="ml-4 font-bold tracking-wide text-base hidden sm:block bg-gradient-to-r from-indigo-800 to-red-600 bg-clip-text text-transparent drop-shadow-sm" style={{ fontFamily: 'Tahoma, Geneva, sans-serif' }}>Exclusive Auto Deals from Trusted Dealerships</span>
            </Link>
          </div>
          
          {/* Search Bar */}
          <div className="w-full lg:w-1/3 mb-4 lg:mb-0">
            <SearchBar 
              value={searchKeyword}
              onChange={handleSearchChange}
              onSubmit={handleSearchSubmit}
            />
          </div>
          
          <div className="flex items-center">
            {/* Only show the button if settings are loaded and the setting is true */}
            {!isLoadingSettings && siteSettings?.showListDealershipButton === true && (
              <Link to="/add-inventory">
                <Button 
                  variant="default"
                  className="relative bg-blue-600 text-white hover:bg-blue-700 font-semibold px-3 py-1.5 text-sm shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center">
                    <PlusCircle className="h-4 w-4 mr-1.5" /> List Your Dealership
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 hover:opacity-100 transition-opacity"></span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
