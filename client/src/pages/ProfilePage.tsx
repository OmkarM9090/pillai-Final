import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../types';
import { User, Mail, Phone, Shield, Building2, Calendar } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in max-w-2xl space-y-6">
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-resort-primary)' }}
        >
          My Profile
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-resort-muted)' }}>
          Your account details and access information
        </p>
      </div>

      <div className="card">
        {/* Avatar section */}
        <div className="flex items-center gap-5 mb-6 pb-6" style={{ borderBottom: '1px solid var(--color-resort-border)' }}>
          <div
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-bold text-[var(--text-primary)] shrink-0"
            style={{ background: 'var(--color-resort-primary)' }}
          >
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3
              className="text-lg font-bold mb-0.5"
              style={{ color: 'var(--color-resort-text)', fontFamily: 'var(--font-display)' }}
            >
              {user?.name}
            </h3>
            <span className="badge badge-primary">
              {user ? ROLE_LABELS[user.role] : ''}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          {[
            { label: 'Full Name', value: user?.name, icon: User },
            { label: 'Email Address', value: user?.email, icon: Mail },
            { label: 'Phone Number', value: user?.phone ?? 'Not provided', icon: Phone },
            { label: 'Role', value: user ? ROLE_LABELS[user.role] : '—', icon: Shield },
            { label: 'Department', value: user?.department ?? 'Not assigned', icon: Building2 },
            {
              label: 'Account Created',
              value: user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—',
              icon: Calendar,
            },
          ].map((field) => (
            <div key={field.label} className="flex items-center gap-4">
              <div
                className="w-9 h-9 rounded-[1rem] flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-resort-surface)' }}
              >
                <field.icon className="w-4 h-4" style={{ color: 'var(--color-resort-muted)' }} />
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-resort-muted)' }}>
                  {field.label}
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--color-resort-text)' }}>
                  {field.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
