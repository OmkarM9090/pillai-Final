import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Settings,
  ChevronRight,
  X,
  History,
  ShieldAlert,
  BrainCircuit,
  MessageSquare,
  RefreshCw,
  Brain
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../types';
import { cn } from '../../utils/cn';
import api from '../../services/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', href: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Time Machine', href: '/time-machine', icon: History },
  { label: 'What-If Agent', href: '/what-if', icon: Brain },
  { label: 'Safe Envelope', href: '/safe-envelope', icon: ShieldAlert },
  { label: 'Decision Council', href: '/council', icon: BrainCircuit },
  { label: 'Review Intel', href: '/reviews', icon: MessageSquare },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();

  const handleReset = async () => {
    try {
      await api.post('/v1/reset-demo');
    } catch (e) {
      console.warn('Reset demo failed, but reloading anyway.');
    }
    window.location.reload();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          width: '260px',
          background: 'var(--color-resort-primary)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo header */}
        <div
          className="flex items-center justify-between px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-resort-accent)' }}
            >
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p
                className="text-sm font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Resort 360
              </p>
              <p className="text-xs font-semibold px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--color-resort-accent-light)' }}>
                Demo Mode
              </p>
            </div>
          </div>

          {/* Mobile close */}
          <button
            id="sidebar-close-btn"
            className="lg:hidden p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                  isActive
                    ? 'text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                )
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'rgba(255,255,255,0.12)' }
                  : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'w-4.5 h-4.5 shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                  )}
                </>
              )}
            </NavLink>
          ))}
          
          <div className="pt-6 mt-6 px-3 border-t border-white/10">
            <button
              onClick={handleReset}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-4.5 h-4.5 shrink-0 text-white/60" />
              Reset Demo
            </button>
          </div>
        </nav>

        {/* User info at bottom */}
        {user && (
          <div
            className="px-4 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                style={{ background: 'var(--color-resort-accent)' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
