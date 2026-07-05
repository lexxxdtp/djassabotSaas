import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
    const { isAuthenticated, isLoading, user, subscriptionExpired } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-black text-white">Chargement...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Abonnement / essai expiré (402 renvoyé par le backend) : on bloque l'accès
    // au dashboard et on dirige vers l'écran de renouvellement, qui reste joignable.
    if (subscriptionExpired && location.pathname !== '/abonnement-expire') {
        return <Navigate to="/abonnement-expire" replace />;
    }
    if (!subscriptionExpired && location.pathname === '/abonnement-expire') {
        return <Navigate to="/dashboard" replace />;
    }

    // Filet de sécurité phase de test : "Vérifier plus tard" sur VerifyAccount pose ce flag.
    // TODO: retirer avec le reste du filet une fois Resend + Firebase pleinement opérationnels.
    const verificationSkipped = localStorage.getItem('verificationSkipped') === 'true';
    const isUnverified = user && !user.emailVerified && !user.phoneVerified && !verificationSkipped;

    if (isUnverified && location.pathname !== '/verify-account') {
        return <Navigate to="/verify-account" replace />;
    }

    if (!isUnverified && location.pathname === '/verify-account') {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
