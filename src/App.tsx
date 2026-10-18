import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const Login = lazy(() => import("./pages/Login"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProductionExecution = lazy(() => import("./pages/ProductionExecution"));
const ShipmentManagement = lazy(() => import("./pages/ShipmentManagement"));
const FinancialStatements = lazy(() => import("./pages/FinancialStatements"));
const BomProductionSlip = lazy(() => import("./pages/BomProductionSlip"));
const InvoiceManagement = lazy(() => import("./pages/InvoiceManagement"));
const EmployeeMaster = lazy(() => import("./pages/EmployeeMaster"));
const ItemMaster = lazy(() => import("./pages/ItemMaster"));
const WarehouseMaster = lazy(() => import("./pages/WarehouseMaster"));
const ProductionSlipCreate = lazy(() => import("./pages/ProductionSlipCreate"));
const ShipmentSlipCreate = lazy(() => import("./pages/ShipmentSlipCreate"));
const BomSlipCreate = lazy(() => import("./pages/BomSlipCreate"));
const CompanyIntro = lazy(() => import("./pages/CompanyIntro"));
const SlipListPage = lazy(() => import("./pages/SlipListPage"));
const DesignSystem = lazy(() => import("./pages/DesignSystem"));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={
          <div role="status" aria-label="読み込み中" className="min-h-screen flex items-center justify-center bg-background text-primary">
            <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" />
          </div>
        }>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/production" element={<Navigate to="/production/execution" replace />} />
          <Route path="/production/slips" element={<ProtectedRoute><SlipListPage /></ProtectedRoute>} />
          <Route path="/production/execution" element={<ProtectedRoute><ProductionExecution /></ProtectedRoute>} />
          <Route path="/production/execution/new" element={<ProtectedRoute><ProductionSlipCreate /></ProtectedRoute>} />
          <Route path="/production/shipping" element={<ProtectedRoute><ShipmentManagement /></ProtectedRoute>} />
          <Route path="/production/shipping/new" element={<ProtectedRoute><ShipmentSlipCreate /></ProtectedRoute>} />
          <Route path="/documents" element={<Navigate to="/documents/bom" replace />} />
          <Route path="/documents/finance" element={<ProtectedRoute><FinancialStatements /></ProtectedRoute>} />
          <Route path="/documents/bom" element={<ProtectedRoute><BomProductionSlip /></ProtectedRoute>} />
          <Route path="/documents/bom/new" element={<ProtectedRoute><BomSlipCreate /></ProtectedRoute>} />
          <Route path="/documents/invoice" element={<ProtectedRoute><InvoiceManagement /></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute><CompanyIntro /></ProtectedRoute>} />
          <Route path="/master" element={<Navigate to="/master/item" replace />} />
          <Route path="/master/employee" element={<ProtectedRoute><EmployeeMaster /></ProtectedRoute>} />
          <Route path="/master/item" element={<ProtectedRoute><ItemMaster /></ProtectedRoute>} />
          <Route path="/master/warehouse" element={<ProtectedRoute><WarehouseMaster /></ProtectedRoute>} />
          <Route path="/design-system" element={<DesignSystem />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;