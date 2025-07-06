import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange
}: SimplePaginationProps) {
  const [displayedPage, setDisplayedPage] = useState(currentPage);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Keep our displayed page in sync with the actual current page
  useEffect(() => {
    setDisplayedPage(currentPage);
    setIsNavigating(false);
  }, [currentPage]);
  
  // Handle direct button clicks
  const handlePageClick = (page: number) => {
    if (page < 1 || page > totalPages || isNavigating) return;
    
    // Set navigating state to prevent multiple clicks
    setIsNavigating(true);
    
    // Update local state for immediate visual feedback
    setDisplayedPage(page);

    // Wait a tiny bit before actual navigation to allow UI to update
    setTimeout(() => {
      // Call the actual page change handler
      onPageChange(page);
      
      // Reset the navigation lock after a delay
      setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    }, 10);
  };
  
  // Calculate which page numbers to display
  const getPageNumbers = () => {
    const maxPageNumbersToShow = 7; // Increased for better navigation
    const pageNumbers: number[] = [];
    
    if (totalPages <= maxPageNumbersToShow) {
      // Show all pages if there are fewer than maxPageNumbersToShow
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always include the first page
      pageNumbers.push(1);
      
      // Calculate how many pages to show to the left and right of the current page
      const siblingCount = 1;
      const leftSiblingIndex = Math.max(displayedPage - siblingCount, 1);
      const rightSiblingIndex = Math.min(displayedPage + siblingCount, totalPages);
      
      // Determine if we should show ellipses
      const shouldShowLeftDots = leftSiblingIndex > 2;
      const shouldShowRightDots = rightSiblingIndex < totalPages - 1;
      
      // Special case: if we're close to the beginning
      if (!shouldShowLeftDots && shouldShowRightDots) {
        const leftItemCount = 3 + 2 * siblingCount;
        for (let i = 2; i <= leftItemCount; i++) {
          if (i <= totalPages - 1) {
            pageNumbers.push(i);
          }
        }
        
        if (pageNumbers[pageNumbers.length - 1] < totalPages - 1) {
          pageNumbers.push(-1); // Right ellipsis
        }
        
        // Add the last page
        pageNumbers.push(totalPages);
        return pageNumbers;
      }
      
      // Special case: if we're close to the end
      if (shouldShowLeftDots && !shouldShowRightDots) {
        // Add left ellipsis
        pageNumbers.push(-1);
        
        const rightItemCount = 3 + 2 * siblingCount;
        for (let i = totalPages - rightItemCount + 1; i <= totalPages - 1; i++) {
          if (i > 1) {
            pageNumbers.push(i);
          }
        }
        
        // Add the last page
        pageNumbers.push(totalPages);
        return pageNumbers;
      }
      
      // Standard case: somewhere in the middle
      if (shouldShowLeftDots && shouldShowRightDots) {
        // Add left ellipsis
        pageNumbers.push(-1);
        
        // Add siblings and current page
        for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
          pageNumbers.push(i);
        }
        
        // Add right ellipsis
        pageNumbers.push(-2);
        
        // Add the last page
        pageNumbers.push(totalPages);
        return pageNumbers;
      }
    }
    
    return pageNumbers;
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-2 mt-8">
      <div className="flex items-center text-sm shadow rounded-md bg-white p-1">
        {/* Previous Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageClick(displayedPage - 1)}
          disabled={displayedPage <= 1 || isNavigating}
          className={`font-medium ${displayedPage <= 1 ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
        >
          <span className="flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </span>
        </Button>
        
        <div className="mx-2 h-6 w-px bg-gray-300"></div>
        
        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((pageNum, idx) => {
            // Render ellipsis
            if (pageNum < 0) {
              return (
                <span 
                  key={`ellipsis-${idx}`} 
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-600"
                >
                  …
                </span>
              );
            }
            
            // Render page number button
            return (
              <Button
                key={`page-${pageNum}`}
                variant={pageNum === displayedPage ? "default" : "ghost"}
                size="sm"
                onClick={() => pageNum !== displayedPage && handlePageClick(pageNum)}
                disabled={pageNum === displayedPage || isNavigating}
                className={`w-8 h-8 p-0 rounded-md font-medium transition-all ${
                  pageNum === displayedPage
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        <div className="mx-2 h-6 w-px bg-gray-300"></div>
        
        {/* Next Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageClick(displayedPage + 1)}
          disabled={displayedPage >= totalPages || isNavigating}
          className={`font-medium ${displayedPage >= totalPages ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
        >
          <span className="flex items-center">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </span>
        </Button>
      </div>
      
      {/* Page Info Text */}
      <div className="text-sm text-gray-600 ml-1 md:ml-3 mt-2 md:mt-0">
        Page {displayedPage} of {totalPages}
      </div>
    </div>
  );
}