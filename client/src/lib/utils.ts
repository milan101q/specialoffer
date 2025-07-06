import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function generateImagePlaceholder(text: string): string {
  return `https://via.placeholder.com/640x480.png?text=${encodeURIComponent(text)}`;
}

export function parseQueryParams(queryString: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  const searchParams = new URLSearchParams(queryString);
  
  searchParams.forEach((value, key) => {
    if (params[key]) {
      // If we already have this parameter, convert to array if not already
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });
  
  return params;
}

export function buildQueryString(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== undefined && item !== null && item !== '') {
          queryParams.append(key, item.toString());
        }
      });
    } else {
      queryParams.append(key, value.toString());
    }
  });
  
  return queryParams.toString();
}

export function extractDomainFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
}
