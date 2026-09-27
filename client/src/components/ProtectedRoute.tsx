import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-slate-400 font-bold uppercase tracking-wider text-sm animate-pulse">
          Authenticating...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-center p-4">
        <h1 className="text-4xl font-black text-rose-500 mb-4">403 FORBIDDEN</h1>
        <p className="text-slate-400 max-w-md">
          Your current role does not have authorization to view this module.
        </p>
        <button 
          onClick={() => window.history.back()}
          className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition"
        >
          GO BACK
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
