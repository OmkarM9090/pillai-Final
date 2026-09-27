import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { TimeMachine } from './pages/TimeMachine';
import WhatIfSimulator from './pages/WhatIfSimulator';
import { ReviewAndKanban } from './pages/ReviewAndKanban';
import { GuestRequestsPage } from './pages/GuestRequestsPage';
import { GuestPortal } from './pages/GuestPortal';
import { WorkerPortal } from './pages/WorkerPortal';
import { IncidentsAndReallocation } from './pages/IncidentsAndReallocation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Landing from './pages/Landing';
import { ThemeProvider } from './ThemeContext';
import LiveIntel from './pages/LiveIntel';
import WeatherTwin from './pages/WeatherTwin';
import AICopilot from './components/AICopilot';

const MANAGER_ROLES = ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'];
const SUPERVISOR_ROLES = [...MANAGER_ROLES, 'SUPERVISOR', 'VENDOR_MANAGER'];

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
          <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
            <Navbar />
            <main className="pb-12">
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route path="/" element={<Landing />} />
                
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><DashboardPage /></ProtectedRoute>} />
                <Route path="/guest-requests" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><GuestRequestsPage /></ProtectedRoute>} />
                <Route path="/time-machine" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><TimeMachine /></ProtectedRoute>} />
                <Route path="/what-if" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><WhatIfSimulator /></ProtectedRoute>} />
                <Route path="/world-intel" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><LiveIntel /></ProtectedRoute>} />
                <Route path="/live-intel" element={<Navigate to="/world-intel" replace />} />
                <Route path="/weather-twin" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><WeatherTwin /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><ReviewAndKanban /></ProtectedRoute>} />
                <Route path="/incidents" element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES}><IncidentsAndReallocation /></ProtectedRoute>} />
                {/* Phase 14: retired sections redirect into the Command Center; their
                    decision logic remains available via the dashboard and Time Machine. */}
                <Route path="/safe-envelope" element={<Navigate to="/dashboard" replace />} />
                <Route path="/council" element={<Navigate to="/guest-requests" replace />} />
                <Route path="/roster" element={<Navigate to="/dashboard" replace />} />
                
                <Route path="/guest" element={<ProtectedRoute allowedRoles={['GUEST']}><GuestPortal /></ProtectedRoute>} />
                
                <Route path="/worker" element={<ProtectedRoute allowedRoles={['WORKER', ...SUPERVISOR_ROLES]}><WorkerPortal /></ProtectedRoute>} />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </main>
            <AICopilot />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
