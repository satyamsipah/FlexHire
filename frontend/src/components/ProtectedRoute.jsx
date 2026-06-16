import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

// Role-to-dashboard mapping — used to redirect users who hit the wrong role's page
const ROLE_HOME = {
  client:     '/client',
  freelancer: '/freelancer',
  admin:      '/admin',
};

// allowedRole — the single role string this route is restricted to.
// Leave undefined to allow any authenticated user regardless of role.
export default function ProtectedRoute({ allowedRole }) {
  const { user, isChecking, checkAuth } = useAuthStore();

  useEffect(() => {
    // Only call the server if we don't already have user in memory.
    // This prevents a redundant /me call when navigating between protected pages.
    if (!user && !isChecking) checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Redirect to the user's own dashboard if they try to access another role's page
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
  }

  return <Outlet />;
}
