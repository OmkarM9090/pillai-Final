import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { TimeMachine } from './pages/TimeMachine';
import { SafeEnvelope } from './pages/SafeEnvelope';
import { CouncilAndApproval } from './pages/CouncilAndApproval';
import { ReviewAndKanban } from './pages/ReviewAndKanban';
import { GuestPortal } from './pages/GuestPortal';
import { WorkerPortal } from './pages/WorkerPortal';
import { IncidentsAndReallocation } from './pages/IncidentsAndReallocation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Landing from './pages/Landing';
import { ThemeProvider } from './ThemeContext';

const MANAGER_ROLES = ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'];
const SUPERVISOR_ROLES = [...MANAGER_ROLES, 'SUPERVISOR'];

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
          <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
            <Navbar />
            <main className="pb-12">
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route path="/" element={<Landing />} />
                
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><DashboardPage /></ProtectedRoute>} />
                <Route path="/time-machine" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><TimeMachine /></ProtectedRoute>} />
                <Route path="/safe-envelope" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><SafeEnvelope /></ProtectedRoute>} />
                <Route path="/council" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><CouncilAndApproval /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><ReviewAndKanban /></ProtectedRoute>} />
                <Route path="/incidents" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><IncidentsAndReallocation /></ProtectedRoute>} />
                
                <Route path="/guest" element={<ProtectedRoute allowedRoles={['GUEST']}><GuestPortal /></ProtectedRoute>} />
                
                <Route path="/worker" element={<ProtectedRoute allowedRoles={['WORKER', ...SUPERVISOR_ROLES]}><WorkerPortal /></ProtectedRoute>} />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
