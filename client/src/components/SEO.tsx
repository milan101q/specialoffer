import { Helmet } from 'react-helmet';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: Record<string, any>;
}

export default function SEO({
  title = 'Find Exclusive Car Deals Near You | SpecialOffer.Autos',
  description = 'Explore local and national car dealerships with special discounts. Browse verified listings on SpecialOffer.Autos - The Official Site for Auto Deals.',
  keywords = 'car deals near me, special car offers, vehicle inventory listings, used car dealerships online',
  image = '/banner.jpg',
  url = 'https://specialoffer.autos/',
  type = 'website',
  structuredData
}: SEOProps) {
  
  // Build full title with site name
  const fullTitle = title.includes('SpecialOffer.Autos') ? title : `${title} | SpecialOffer.Autos`;
  
  // Function to handle URL domain detection for social crawlers
  // Facebook's crawler doesn't execute JavaScript, so we need to provide complete URLs
  // We'll use a hybrid approach: for development we'll use dynamic URLs, for production we use hardcoded ones
  const getAbsoluteUrl = (path: string) => {
    // Default to production domain (this will be used by Facebook crawler)
    let baseUrl = 'https://specialoffer.autos';
    
    // In browser, try to detect development domains
    if (typeof window !== 'undefined') {
      if (window.location.hostname.includes('replit.dev')) {
        baseUrl = window.location.origin;
        
        // Also update page metadata when we're on a dev domain
        document.querySelector('meta[property="og:image:url"]')?.setAttribute('content', 
          baseUrl + '/uploads/vehicle_images/facebook_preview.jpg');
      }
    }
    
    // Return appropriate absolute URL
    return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };
  
  // Ensure URL is absolute
  const absoluteUrl = getAbsoluteUrl(url);
  
  // Default structured data for the website
  const defaultStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SpecialOffer.Autos",
    "url": "https://specialoffer.autos/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://specialoffer.autos/?keyword={search_term}",
      "query-input": "required name=search_term"
    }
  };
  
  // Use provided structured data or default website data
  const finalStructuredData = structuredData || defaultStructuredData;
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={getAbsoluteUrl(image || '')} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="SpecialOffer.Autos" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={absoluteUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={getAbsoluteUrl(image || '')} />
      <meta property="twitter:site" content="@SpecialofferAutos" />
      
      {/* Structured Data / JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(finalStructuredData)}
      </script>
      
      {/* Canonical URL */}
      <link rel="canonical" href={absoluteUrl} />
    </Helmet>
  );
}