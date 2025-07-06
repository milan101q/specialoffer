import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";

export default function AddInventory() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    // Clear any session or local storage items that might affect navigation
    sessionStorage.removeItem('lastPageNumber');
    localStorage.removeItem('lastPageNumber');
    
    // Use React Router's navigate instead of direct location changes
    // Replace:true ensures we replace the current URL in history rather than adding to it
    navigate('/', { replace: true });
  };

  return (
    <div className="bg-neutral-100 min-h-screen">
      <SEO
        title="Join Our Dealer Network | SpecialOffer.Autos"
        description="List your car dealership on SpecialOffer.Autos to showcase your exclusive deals."
        keywords="car dealership listing, auto dealer network, dealership advertising, vehicle special offers, auto promotions"
        url="https://specialoffer.autos/add-inventory"
        type="website"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Dealership Listing Service",
          "description": "List your car dealership on SpecialOffer.Autos to showcase your exclusive deals.",
          "provider": {
            "@type": "Organization",
            "name": "SpecialOffer.Autos",
            "url": "https://specialoffer.autos/"
          },

          "termsOfService": "https://specialoffer.autos/terms",
          "serviceType": "Dealership Listing"
        }}
      />
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost" 
          className="mb-6 flex items-center text-neutral-700"
          onClick={handleGoBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vehicles
        </Button>

        <div className="max-w-3xl mx-auto bg-white shadow-md rounded-xl p-8 md:p-12">
          <div className="text-center mb-10">
            <p className="text-lg text-neutral-600">
              Join our network of trusted automotive dealers
            </p>
          </div>

          <div className="mb-10 p-6 border border-primary-100 bg-primary-50 rounded-lg">
            <p className="text-lg md:text-xl text-neutral-800 mb-6">
              To list your dealership's inventory on SpecialOffer.Autos, please email us your dealership name and website at <span className="font-semibold text-primary-700">contact@specialoffer.autos</span> and our team will get back to you shortly.
            </p>


            <Button 
              className="w-full md:w-auto"
              size="lg"
              onClick={() => {
                const emailLink = "mailto:contact@specialoffer.autos?subject=Add%20My%20Dealership%20to%20SpecialOffer.Autos";
                // Using a new anchor element is more React-friendly than directly changing window.location
                const link = document.createElement('a');
                link.href = emailLink;
                link.target = '_blank';
                link.click();
              }}
            >
              <Mail className="w-5 h-5 mr-2" />
              Email Us Now
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center text-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-16 h-16 flex items-center justify-center bg-primary-100 text-primary-800 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Simple Onboarding</h3>
              <p className="text-neutral-600">
                Quick and easy process to get your inventory synced with our platform
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-16 h-16 flex items-center justify-center bg-primary-100 text-primary-800 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Increased Visibility</h3>
              <p className="text-neutral-600">
                Expand your reach to potential buyers searching for vehicles in your area
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-16 h-16 flex items-center justify-center bg-primary-100 text-primary-800 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Automatic Syncing</h3>
              <p className="text-neutral-600">
                Your inventory updates automatically with our smart sync technology
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 bg-neutral-50 rounded-lg">
              <div className="w-16 h-16 flex items-center justify-center bg-primary-100 text-primary-800 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">More Customers</h3>
              <p className="text-neutral-600">
                Connect with motivated buyers looking for exactly what you offer
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}