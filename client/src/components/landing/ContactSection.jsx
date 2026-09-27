import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

// Placeholder details — swap these for the real address/contact info any time.
const ADDRESS = 'Plot 12, Sector 15, CBD Belapur, Navi Mumbai, Maharashtra 400614';
const PHONE = '+91 98765 43210';
const EMAIL = 'hello@resortsandbox360.com';
const HOURS = 'Mon – Sat, 9:00 AM – 7:00 PM IST';
const MAP_QUERY = encodeURIComponent(ADDRESS);

const details = [
  { icon: MapPin, label: 'Address', value: ADDRESS },
  { icon: Phone, label: 'Phone', value: PHONE },
  { icon: Mail, label: 'Email', value: EMAIL },
  { icon: Clock, label: 'Hours', value: HOURS },
];

export default function ContactSection() {
  const isMobile = useIsMobile();

  return (
    <section
      id="contact"
      style={{
        background: 'var(--bg-primary)',
        padding: isMobile
          ? 'clamp(3rem, 8vw, 4rem) clamp(1rem, 4vw, 2rem)'
          : 'clamp(5rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)',
        position: 'relative',
      }}
    >
      <div style={{ marginBottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
        <span
          style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--text-primary)', padding: '0.3rem 0.8rem', borderRadius: '999px',
            background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-border)', display: 'inline-block',
          }}
        >
          Contact
        </span>
      </div>

      <h2
        className="font-display"
        style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)', marginBottom: '0.75rem', maxWidth: '780px', lineHeight: 1.1,
        }}
      >
        Let's talk resort ops.
      </h2>
      <p
        style={{
          fontSize: 'clamp(0.92rem, 1.1vw, 1.05rem)', color: 'var(--text-muted)', maxWidth: '560px',
          marginBottom: 'clamp(2.5rem, 4vw, 3.5rem)', lineHeight: 1.6,
        }}
      >
        Reach out for a walkthrough of the sandbox, the staffing engine, or the review-to-task loop.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 380px) 1fr',
          gap: isMobile ? '2rem' : 'clamp(2rem, 4vw, 4rem)',
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {details.map((d, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: '0.9rem', padding: '1.1rem', borderRadius: '1rem',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  width: '2.4rem', height: '2.4rem', borderRadius: '0.7rem', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)',
                }}
              >
                <d.icon size={17} style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {d.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid var(--border-color)',
            minHeight: isMobile ? '280px' : '100%',
          }}
        >
          <iframe
            title="ResortSandbox 360 location"
            src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block', minHeight: isMobile ? 280 : 380, filter: 'var(--map-filter, none)' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
