import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated || !currentUser) {
    return null; // Don't show navbar on login page
  }

  const navItems = {
    executive: [
      { name: 'Command Center', path: '/dashboard' },
      { name: 'Time Machine', path: '/time-machine' },
      { name: 'Safe Envelope', path: '/safe-envelope' },
      { name: 'Decision Council', path: '/council' },
      { name: 'Review & Kanban', path: '/reviews' },
      { name: 'Systemic Incidents', path: '/incidents' },
    ],
    guest: [
      { name: 'Guest Portal', path: '/guest' }
    ],
    worker: [
      { name: 'My Tasks', path: '/worker' }
    ],
    vendor: [
      { name: 'Vendor Portal', path: '/vendor' }
    ]
  };

  let currentNav = navItems.executive;
  if (currentUser.role === 'GUEST') currentNav = navItems.guest;
  else if (currentUser.role === 'WORKER') currentNav = navItems.worker;
  else if (currentUser.role === 'VENDOR_MANAGER') currentNav = navItems.vendor;

  const handleReset = async () => {
    try {
      // Use dev token or just fire and forget if API is unprotected
      await fetch('/api/v1/reset-demo', { 
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              360
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider text-white">SMART RESORT 360</div>
              <div className="text-[10px] text-emerald-400 font-medium tracking-tight">● CLOSED-LOOP DECISION TWIN</div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col justify-center bg-slate-800 rounded-lg px-3 py-1 border border-slate-700">
            <div className="text-xs font-bold text-white">{currentUser.name}</div>
            <div className="text-[10px] font-semibold text-indigo-400">
              {currentUser.role} {currentUser.department && `• ${currentUser.department}`}
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
          {currentNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            title="DEVELOPMENT ONLY"
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-1"
          >
            <span>↺</span> <span className="hidden xl:inline">Reset Demo</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-md text-xs font-bold transition"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </header>
  );
}
