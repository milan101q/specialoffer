import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to login if not authenticated (after auth check completes)
    if (!loading && !isAuthenticated) {
      setLocation('/admin');
    }
  }, [isAuthenticated, loading, setLocation]);

  // Show loading spinner during authentication check
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="animate-spin text-primary-500">
          <Loader className="h-8 w-8" />
        </div>
      </div>
    );
  }

  // Don't render children until authentication is confirmed
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}