import { KeyboardEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

export default function SearchBar({ 
  value, 
  onChange, 
  onSubmit,
  placeholder = "Search by make, model, year, city, state or dealership"
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  
  // Update local state when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit();
    }
  };
  
  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [inputValue, onChange, value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  const clearSearch = () => {
    setInputValue('');
    onChange('');
  };

  return (
    <div className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full py-2 px-4 pr-16 bg-neutral-100 rounded-full border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
      />
      {inputValue && (
        <Button 
          type="button"
          variant="ghost"
          size="icon"
          onClick={clearSearch}
          className="absolute right-10 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-primary-500"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Button 
        type="button"
        variant="ghost"
        size="icon"
        onClick={onSubmit}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-primary-500"
      >
        <Search className="h-5 w-5" />
      </Button>
    </div>
  );
}
