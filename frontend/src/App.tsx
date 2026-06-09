import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Today = lazy(() => import('./pages/Today'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const Inbox = lazy(() => import('./pages/Inbox'));
const MarketingTools = lazy(() => import('./pages/Marketing'));
const Overview = lazy(() => import('./pages/Overview'));
const Settings = lazy(() => import('./pages/Settings'));
const WhatsAppConnect = lazy(() => import('./pages/WhatsAppConnect'));
const Subscription = lazy(() => import('./pages/Subscription'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount'));

// Loading fallback — matches landing page design (pure black, #00D97E accent)
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#000'
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #1a1a1a',
        borderTop: '3px solid #00D97E',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ color: '#888', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Chargement</span>
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/verify-account" element={<VerifyAccount />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                {/* New home: operational dashboard */}
                <Route index element={<Today />} />
                {/* Detailed analytics — accessible via "voir l'analyse détaillée" link */}
                <Route path="analytics" element={<Overview />} />
                <Route path="products" element={<Products />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="orders" element={<Orders />} />
                <Route path="inbox" element={<Inbox />} />
                {/* Hidden from nav but route preserved — coming back when functional */}
                <Route path="marketing" element={<MarketingTools />} />
                {/* Moved under Settings UX but routes kept for direct links */}
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
