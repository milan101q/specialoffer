import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import SEO from "@/components/SEO";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  
  const handleReturn = () => {
    navigate('/');
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <SEO
        title="404 - Page Not Found | SpecialOffer.Autos"
        description="The page you're looking for doesn't exist. Return to our home page to browse vehicle listings with special offers from trusted dealerships."
        keywords="page not found, specialoffer.autos, car deals, car offers"
        url="https://specialoffer.autos/404"
      />
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 pb-8">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-gray-600 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <Button 
            onClick={handleReturn}
            className="mt-4"
          >
            <Home className="w-4 h-4 mr-2" />
            Return to Home Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
