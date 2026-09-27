import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-resort-surface)' }}>
      <div className="text-center max-w-md px-6 animate-fade-in">
        <div
          className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(220, 38, 38, 0.1)' }}
        >
          <ShieldOff className="w-10 h-10" style={{ color: 'var(--color-resort-error)' }} />
        </div>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-resort-primary)' }}
        >
          Access Denied
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-resort-muted)' }}>
          You do not have permission to access this page. Please contact your administrator if you
          believe this is an error.
        </p>
        <button
          id="go-back-btn"
          onClick={() => navigate(-1)}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    </div>
  );
}
