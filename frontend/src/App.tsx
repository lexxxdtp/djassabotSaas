import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLayout from './layouts/AuthLayout';

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
const SubscriptionExpired = lazy(() => import('./pages/SubscriptionExpired'));
const Terms = lazy(() => import('./pages/Legal').then(m => ({ default: m.Terms })));
const Privacy = lazy(() => import('./pages/Legal').then(m => ({ default: m.Privacy })));

const PageLoader = () => (
  <div className="app-loader" role="status">
    <span className="app-brand-mark" aria-hidden="true">D</span>
    <p>Votre espace se prépare…</p>
    <div className="app-loading-line" aria-hidden="true" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            </Route>
            <Route path="/conditions" element={<Terms />} />
            <Route path="/confidentialite" element={<Privacy />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AuthLayout />}>
              <Route path="/verify-account" element={<VerifyAccount />} />
              <Route path="/abonnement-expire" element={<SubscriptionExpired />} />
              <Route path="/onboarding" element={<Onboarding />} />
              </Route>
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
            {/* Catch-all route to redirect invalid URLs to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
      {/* Sans ce point d'ancrage, AUCUN toast de l'application ne s'affichait :
          neuf écrans appelaient toast.success/error dans le vide (« Produit
          créé », « Limite du forfait atteinte », « Message non envoyé »…).
          Le vendeur ne voyait donc ni ses réussites ni ses échecs. */}
      <Toaster
        position="top-center"
        // La barre du haut fait 78 px (68 sur téléphone) : sans ce décalage,
        // le message recouvrait le logo et devenait illisible.
        containerStyle={{ top: 88 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-panel)',
            fontSize: '14px',
            maxWidth: 'min(92vw, 420px)',
          },
          success: { iconTheme: { primary: '#00D97E', secondary: '#000' } },
          // Un échec doit rester lisible le temps de le comprendre.
          error: { duration: 6000, iconTheme: { primary: '#f87171', secondary: '#000' } },
        }}
      />
    </AuthProvider>
  );
}

export default App;
