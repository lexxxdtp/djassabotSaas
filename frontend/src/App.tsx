import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const MarketingTools = lazy(() => import('./pages/Marketing'));
const Overview = lazy(() => import('./pages/Overview'));
const Settings = lazy(() => import('./pages/Settings'));
const WhatsAppConnect = lazy(() => import('./pages/WhatsAppConnect'));
const Subscription = lazy(() => import('./pages/Subscription'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '3px solid rgba(99, 102, 241, 0.3)',
        borderTop: '3px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ color: '#a5b4fc', fontSize: '14px' }}>Chargement...</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Overview />} />
                <Route path="products" element={<Products />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="orders" element={<Orders />} />
                <Route path="marketing" element={<MarketingTools />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="settings" element={<Settings />} />
                <Route path="whatsapp" element={<WhatsAppConnect />} />
              </Route>
            </Route>

            <Route path="/" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
