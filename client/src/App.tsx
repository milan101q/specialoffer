import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";

import Home from "./pages/NewHome";
import VehicleDetail from "./pages/VehicleDetail";
import AddInventory from "./pages/AddInventory";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/not-found";
import TestPage from "./pages/TestPage";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Footer from "./components/Footer";

function Router() {
  // Clear navigation history/storage when routes are mounted to prevent page/5 issues
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('lastPageNumber');
  }
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        {/* Explicit route for pagination to handle page parameter more reliably */}
        <Route path="/page/:pageNumber" element={<Home />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/add-inventory" element={<AddInventory />} />
        <Route path="/test" element={<TestPage />} />
        
        {/* Admin routes */}
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/dealerships" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/inventory" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* Fallback to 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Router />
          <Footer />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
