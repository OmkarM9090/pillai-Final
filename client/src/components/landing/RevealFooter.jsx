import { useState, useRef, useLayoutEffect } from 'react';
import { SlidersHorizontal, MessageSquareText, Users2, ShieldCheck, ArrowUpRight } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

// Scales the wordmark so it always fits fully inside its container —
// no more cropped/overflowing letters at the edges on any screen size.
function FitWordmark({ text, maxFontSize = 210, minFontSize = 32 }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    function fit() {
      const container = containerRef.current;
      const el = textRef.current;
      if (!container || !el) return;
      const containerWidth = container.offsetWidth;
      el.style.fontSize = `${maxFontSize}px`;
      const naturalWidth = el.scrollWidth || 1;
      const scale = containerWidth / naturalWidth;
      const next = Math.max(minFontSize, Math.min(maxFontSize, maxFontSize * scale));
      setFontSize(next);
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [text, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', textAlign: 'center' }}>
      <span
        ref={textRef}
        className="font-display"
        style={{
          display: 'inline-block', fontSize: `${fontSize}px`, fontWeight: 900, lineHeight: 0.85,
          letterSpacing: '-0.03em', color: 'var(--text-primary)', userSelect: 'none', whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}

const features = [
  { icon: SlidersHorizontal, title: 'What-If Simulator', desc: 'Test occupancy, weather and cost scenarios before committing' },
  { icon: Users2, title: 'Co-Optimized Staffing', desc: 'Conflict-free rosters balanced against demand and burnout risk' },
  { icon: MessageSquareText, title: 'Review Intelligence', desc: 'Guest feedback converted into routed department tasks' },
  { icon: ShieldCheck, title: 'Prescriptive Actions', desc: 'Every recommendation ships with impact, cost and risk' },
];

function FeatureCard({ icon: Icon, title, desc, isMobile }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 220px', padding: isMobile ? '1rem' : '1.5rem', borderRadius: '1rem',
        background: hovered ? 'var(--accent-soft)' : 'var(--bg-secondary)',
        border: `1px solid ${hovered ? 'var(--accent-soft-border)' : 'var(--border-color)'}`,
        cursor: 'default', transition: 'all 0.3s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)', marginBottom: '1rem' }}>
        <Icon size={18} style={{ color: 'var(--text-primary)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h4>
        <ArrowUpRight size={14} style={{ color: hovered ? 'var(--text-primary)' : 'transparent', transition: 'color 0.3s' }} />
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  );
}

export default function RevealFooter() {
  const isMobile = useIsMobile();
  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '100vh', zIndex: 1,
      background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', overflow: 'hidden',
    }}>
      <div style={{ padding: isMobile ? '2rem 4vw 0.5rem' : '3.5rem 5vw 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: isMobile ? '1rem' : '2rem' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--text-primary)', padding: '0.3rem 0.8rem', borderRadius: '999px',
            background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-border)',
          }}>
            What It Does
          </span>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? '0.6rem' : '1rem', flexWrap: 'wrap' }}>
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} isMobile={isMobile} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 5vw', display: 'flex', justifyContent: 'center', gap: isMobile ? '1.5rem' : '4rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Lower Costs', value: '15.3%' },
          { label: 'Faster Check-in', value: '58.7%' },
          { label: 'Less Overtime', value: '65.7%' },
          { label: 'Departments Connected', value: '5' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 'clamp(1.2rem, 2vw, 1.5rem)' : 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 800, color: 'var(--text-primary)' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', padding: isMobile ? '0 1.5rem' : '0 3vw' }}>
        <FitWordmark text="RESORTSANDBOX 360" maxFontSize={isMobile ? 90 : 210} minFontSize={isMobile ? 34 : 60} />
      </div>

      <div style={{
        padding: '1.2rem 5vw', display: 'flex', justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '0.5rem' : '0', borderTop: '1px solid var(--border-color)',
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          © 2026 ResortSandbox 360 — Team Tech Tantra, HackCelestial 3.0
        </span>
        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          Systems Online
        </span>
      </div>
    </footer>
  );
}
