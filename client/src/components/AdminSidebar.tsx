import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Store, 
  Car, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeTab: string;
}

export default function AdminSidebar({ activeTab }: AdminSidebarProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);
  
  // Toggle sidebar when screen size changes
  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);
  
  // Close sidebar when navigating on mobile
  const handleNavigation = (path: string) => {
    setLocation(path);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/admin');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: 'dealerships', label: 'Dealerships', icon: <Store className="h-5 w-5" /> },
    { id: 'inventory', label: 'Inventory', icon: <Car className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> }
  ];

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-primary-600 text-white hover:bg-primary-700 rounded-full shadow-lg"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "bg-neutral-800 text-white h-screen p-4 transition-all duration-300 fixed lg:relative z-40",
        isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:w-20 lg:translate-x-0",
        isMobile && isOpen ? "shadow-2xl" : ""
      )}>
        {/* Overlay for mobile */}
        {isMobile && isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30" 
            onClick={() => setIsOpen(false)}
          />
        )}
        
        <div className={cn(
          "flex items-center mb-8",
          !isOpen && !isMobile ? "justify-center" : ""
        )}>
          <i className="ri-car-fill text-3xl text-primary-400 mr-2"></i>
          {(isOpen || !isMobile) && (
            <span className={cn(
              "text-xl font-bold whitespace-nowrap overflow-hidden transition-all",
              !isOpen && !isMobile ? "hidden" : "block"
            )}>AutoHub Admin</span>
          )}
        </div>
        
        <nav className={cn("overflow-hidden", !isOpen && !isMobile ? "px-0" : "")}>
          <ul className="space-y-2">
            {menuItems.map(item => (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex items-center w-full justify-start py-2 rounded-lg text-white",
                    !isOpen && !isMobile ? "px-2 justify-center" : "px-4",
                    activeTab === item.id 
                      ? 'bg-primary-600 hover:bg-primary-700' 
                      : 'hover:bg-neutral-700'
                  )}
                  onClick={() => handleNavigation(`/admin/${item.id}`)}
                >
                  <div className={cn(
                    "flex items-center",
                    !isOpen && !isMobile ? "justify-center" : "mr-3"
                  )}>
                    {item.icon}
                  </div>
                  {(isOpen || isMobile) && (
                    <span className="whitespace-nowrap overflow-hidden transition-all">
                      {item.label}
                    </span>
                  )}
                </Button>
              </li>
            ))}
            <li>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center w-full justify-start py-2 rounded-lg text-white hover:bg-neutral-700",
                  !isOpen && !isMobile ? "px-2 justify-center" : "px-4"
                )}
                onClick={handleLogout}
              >
                <div className={cn(
                  "flex items-center",
                  !isOpen && !isMobile ? "justify-center" : "mr-3"
                )}>
                  <LogOut className="h-5 w-5" />
                </div>
                {(isOpen || isMobile) && (
                  <span className="whitespace-nowrap overflow-hidden transition-all">
                    Logout
                  </span>
                )}
              </Button>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  );
}
