import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role, Permission } from '../types';

// ============================================================
// ProtectedRoute - redirects unauthenticated users to /login
// ============================================================
interface ProtectedRouteProps {
  allowedRoles?: Role[];
  requiredPermission?: Permission;
}

export function ProtectedRoute({ allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-resort-primary/30 border-t-resort-primary rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading Smart Resort 360...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Permission check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

// ============================================================
// PublicRoute - redirects authenticated users away from login
// ============================================================
export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-resort-primary/30 border-t-resort-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
