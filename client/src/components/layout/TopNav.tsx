import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, User as UserIcon, ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../types';

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      className="flex items-center justify-between px-4 lg:px-6 py-3 shrink-0"
      style={{
        background: '#fff',
        borderBottom: '1px solid var(--color-resort-border)',
        height: '64px',
      }}
    >
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          id="sidebar-open-btn"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-resort-muted)' }}
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-base font-semibold leading-tight"
            style={{ color: 'var(--color-resort-primary)', fontFamily: 'var(--font-display)' }}
          >
            Smart Resort 360
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-resort-muted)' }}>
            Resort Operations Platform
          </p>
        </div>
      </div>

      {/* Right: notifications + profile */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          id="notifications-btn"
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-resort-muted)' }}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-resort-accent)' }}
          />
        </button>

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            id="profile-menu-btn"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition-colors"
            style={{ background: profileOpen ? 'var(--color-resort-surface)' : 'transparent' }}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: 'var(--color-resort-primary)' }}
            >
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium leading-tight" style={{ color: 'var(--color-resort-text)' }}>
                {user?.name}
              </p>
              <p className="text-xs leading-tight" style={{ color: 'var(--color-resort-muted)' }}>
                {user ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{
                color: 'var(--color-resort-muted)',
                transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Dropdown */}
          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl overflow-hidden animate-fade-in z-50"
              style={{
                background: '#fff',
                border: '1px solid var(--color-resort-border)',
              }}
            >
              {/* User info header */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-resort-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-resort-text)' }}>
                  {user?.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-resort-muted)' }}>
                  {user?.email}
                </p>
                <span className="badge badge-primary mt-2">
                  {user ? ROLE_LABELS[user.role] : ''}
                </span>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  id="profile-view-btn"
                  onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--color-resort-text)' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-resort-surface)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <UserIcon className="w-4 h-4" style={{ color: 'var(--color-resort-muted)' }} />
                  View Profile
                </button>

                <button
                  id="settings-nav-btn"
                  onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--color-resort-text)' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-resort-surface)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Settings className="w-4 h-4" style={{ color: 'var(--color-resort-muted)' }} />
                  Settings
                </button>
              </div>

              {/* Logout */}
              <div
                className="py-1"
                style={{ borderTop: '1px solid var(--color-resort-border)' }}
              >
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--color-resort-error)' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
