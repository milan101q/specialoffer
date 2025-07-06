import { Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-center items-center">
          <p className="text-neutral-600 text-sm flex items-center">
            © 2025 All Rights Reserved. SpecialOffer.Autos - 
            <a 
              href="mailto:contact@specialoffer.autos" 
              className="text-primary-600 hover:text-primary-700 ml-1 transition-colors flex items-center"
            >
              <Mail className="h-4 w-4 mx-1 text-primary-600" />
              contact@specialoffer.autos
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}