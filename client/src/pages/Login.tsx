import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { BoxSelect, Mail, Lock, ArrowLeft, LogIn } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';

export default function Login() {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<'staff' | 'guest'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(mode === 'guest' ? '/api/v1/auth/guest-login' : '/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          mode === 'guest'
            ? { room_number: roomNumber, booking_reference: bookingRef }
            : { email, password }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to connect. Please try again.');
      }

      if (data.success && data.data) {
        login(data.data.token, data.data.user);
        
        // Role-based routing
        const role = data.data.user.role;
        if (role === 'GUEST') navigate('/guest');
        else if (role === 'WORKER') navigate('/worker');
        else navigate('/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Network unavailable. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem 0.85rem 2.6rem',
    borderRadius: '0.85rem',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: isMobile ? '6rem 1.25rem 2rem' : '2rem',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg-card)',
          border: '1px solid var(--card-border)',
          borderRadius: '1.5rem',
          boxShadow: 'var(--card-shadow)',
          padding: isMobile ? '2rem 1.5rem' : '2.75rem 2.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '2.25rem', height: '2.25rem', borderRadius: '0.7rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent)', flexShrink: 0,
            }}
          >
            <BoxSelect size={16} color="var(--on-accent)" />
          </div>
          <span className="font-display" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ResortSandbox 360
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {([['staff', 'Staff & Managers'], ['guest', 'Guest (check-in)']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: '0.7rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                border: mode === m ? '1.5px solid var(--accent)' : '1.5px solid var(--border-color)',
                background: mode === m ? 'var(--accent)' : 'var(--bg-secondary)',
                color: mode === m ? 'var(--on-accent)' : 'var(--text-muted)',
              }}>
              {label}
            </button>
          ))}
        </div>

        <h1 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 1.85rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          {mode === 'staff' ? 'Manager sign in' : 'Guest sign in'}
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.5 }}>
          {mode === 'staff'
            ? 'Access the dashboard to review simulations, rosters and prescriptive actions.'
            : 'Use your room number and the booking reference from check-in. Demo: Room 105 · BK-RESORT-105.'}
        </p>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'rgb(251, 113, 133)', fontSize: '0.875rem', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'staff' ? (
            <>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Room number (e.g. 105)"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  placeholder="Booking reference (e.g. BK-RESORT-105)"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              marginTop: '0.5rem', padding: '0.85rem 1rem', borderRadius: '0.85rem', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '0.92rem', fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <>
                <LogIn size={16} />
                Sign in
              </>
            )}
          </motion.button>
        </form>

        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1.75rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft size={14} />
          Back to home
        </button>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>DEMO CREDENTIALS</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            <span style={{ background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>manager@smartresort.demo</span>
            <span style={{ background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>housekeeper@smartresort.demo</span>
            <span style={{ background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>guest@smartresort.demo</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Password: <span style={{ fontFamily: 'monospace' }}>demo123</span></p>
        </div>
      </motion.div>
    </div>
  );
}
