import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--color-resort-surface)' }}>
      {/* Top nav */}
      <Navbar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}
