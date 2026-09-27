import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="animate-fade-in max-w-2xl space-y-6">
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-resort-primary)' }}
        >
          Settings
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-resort-muted)' }}>
          Platform and account configuration
        </p>
      </div>

      <div className="card flex flex-col items-center text-center py-12">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(30, 58, 95, 0.08)' }}
        >
          <Settings className="w-7 h-7" style={{ color: 'var(--color-resort-primary)' }} />
        </div>
        <h3
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--color-resort-text)', fontFamily: 'var(--font-display)' }}
        >
          Settings Coming Soon
        </h3>
        <p className="text-sm max-w-sm" style={{ color: 'var(--color-resort-muted)' }}>
          Platform settings, notification preferences, and user management features will be
          available in future releases of Smart Resort 360.
        </p>
      </div>
    </div>
  );
}
