import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  ...props
}: PaginationProps) {
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pageNumbers = [];
    
    // Always show first page
    pageNumbers.push(1);
    
    // Calculate range around current page
    const leftSiblingIndex = Math.max(2, currentPage - siblingCount);
    const rightSiblingIndex = Math.min(totalPages - 1, currentPage + siblingCount);
    
    // Add dots if needed
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;
    
    // Add the range around current page
    if (shouldShowLeftDots) {
      pageNumbers.push(-1); // -1 represents dots
    }
    
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== 1 && i !== totalPages) {
        pageNumbers.push(i);
      }
    }
    
    if (shouldShowRightDots) {
      pageNumbers.push(-2); // -2 represents dots (using different value for React key)
    }
    
    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };
  
  const pageNumbers = getPageNumbers();
  
  return (
    <nav
      className={cn("flex items-center space-x-1", className)}
      {...props}
      role="navigation"
      aria-label="Pagination Navigation"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          if (currentPage > 1) onPageChange(currentPage - 1);
        }}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {pageNumbers.map((page, index) => {
        if (page < 0) {
          // Render dots for skipped pages
          return (
            <Button
              key={page}
              variant="ghost"
              size="icon"
              disabled
              className="cursor-default"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          );
        }
        
        return (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            onClick={() => {
              if (page !== currentPage) onPageChange(page);
            }}
            aria-label={`Go to page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Button>
        );
      })}
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          if (currentPage < totalPages) onPageChange(currentPage + 1);
        }}
        disabled={currentPage === totalPages || totalPages === 0}
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
