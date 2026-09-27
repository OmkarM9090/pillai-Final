import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, ArrowRight, TrendingUp, Users, Building2 } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

/* ─── Marquee ─────────────────────────────────────────────── */
const marqueeItems = [
  'SENSE', 'PREDICT', 'SIMULATE', 'DECIDE', 'APPROVE', 'ACT', 'LEARN',
];

function Marquee() {
  const row = marqueeItems.map((t, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2rem' }}>
      <span style={{
        fontSize: 'clamp(1.1rem, 2vw, 1.6rem)', fontWeight: 900, letterSpacing: '0.06em',
        color: 'var(--text-primary)', whiteSpace: 'nowrap',
      }}>
        {t}
      </span>
      <span style={{ color: 'var(--accent)', fontSize: '1.2rem' }}>&#10022;</span>
    </span>
  ));

  return (
    <div style={{ width: '100%', padding: '1.5rem 0', borderTop: '1px solid var(--border-color)', marginTop: '2.5rem' }}>
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'inline-flex', gap: '2.5rem', whiteSpace: 'nowrap' }}
      >
        {row}{row}
      </motion.div>
    </div>
  );
}

/* ─── Hover Button ────────────────────────────────────────── */
function HoverButton({ children, primary, href }) {
  const [hovered, setHovered] = useState(false);

  const baseStyle = primary
    ? {
        background: 'var(--accent)',
        color: 'var(--on-accent)',
        border: 'none',
        boxShadow: hovered ? '0 12px 36px var(--accent-soft-border)' : '0 6px 18px var(--accent-soft)',
      }
    : {
        background: hovered ? 'var(--accent-soft)' : 'transparent',
        color: 'var(--text-primary)',
        border: '1.5px solid var(--border-color)',
        boxShadow: 'none',
      };

  return (
    <a href={href || '#features'} style={{ textDecoration: 'none' }}>
      <motion.button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        animate={{ scale: hovered ? 1.05 : 1 }}
        transition={{ duration: 0.2 }}
        style={{
          ...baseStyle,
          padding: '0.9rem 2rem', borderRadius: '999px', fontSize: '0.95rem', fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          transition: 'background 0.3s, box-shadow 0.3s, border 0.3s', fontFamily: 'inherit',
        }}
      >
        {children}
      </motion.button>
    </a>
  );
}

/* ─── Hover Word ──────────────────────────────────────────── */
function HoverWord({ children, style }) {
  const [h, setH] = useState(false);
  return (
    <motion.span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      animate={h ? { scale: 1.06 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'inline-block', cursor: 'default', transformOrigin: 'center bottom', ...style }}
    >
      {children}
    </motion.span>
  );
}

/* ─── Reveal Word ─────────────────────────────────────────── */
function RevealWord({ word, scrollYProgress, start, end, style }) {
  const opacity = useTransform(scrollYProgress, [start, end], [0.08, 1]);
  const y = useTransform(scrollYProgress, [start, end], [18, 0]);
  return (
    <motion.span style={{ opacity, y, display: 'inline-block', marginRight: '0.35em' }}>
      <HoverWord style={style}>{word}</HoverWord>
    </motion.span>
  );
}

/* ─── Stat Card ───────────────────────────────────────────── */
const stats = [
  { icon: TrendingUp, label: 'Operating Cost', value: '-15.3%' },
  { icon: Users, label: 'Check-in Wait', value: '-58.7%' },
  { icon: Building2, label: 'Staff Overtime', value: '-65.7%' },
];

/* ─── Main Component ──────────────────────────────────────── */
export default function ExpandingCTA() {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const boxScale = useTransform(scrollYProgress, [0, 0.35], [0.65, 1]);
  const borderRadius = useTransform(scrollYProgress, [0, 0.35], [50, 0]);
  const boxOpacity = useTransform(scrollYProgress, [0, 0.12], [0, 1]);

  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.45], [0, 1]);
  const buttonsOpacity = useTransform(scrollYProgress, [0.55, 0.65], [0, 1]);
  const buttonsY = useTransform(scrollYProgress, [0.55, 0.65], [30, 0]);
  const statsOpacity = useTransform(scrollYProgress, [0.65, 0.75], [0, 1]);
  const statsY = useTransform(scrollYProgress, [0.65, 0.75], [30, 0]);
  const marqueeOpacity = useTransform(scrollYProgress, [0.75, 0.85], [0, 1]);

  const titleText = 'Every Resort Decision, Tested Before It Happens';
  const titleWords = titleText.split(' ');

  const descText =
    'Bookings, staffing, housekeeping, F&B and guest feedback — connected into one simulator. Change occupancy, weather or cost, see the impact instantly, and approve the recommended action.';
  const descWords = descText.split(' ');

  return (
    <section ref={containerRef} style={{ height: isMobile ? '400vh' : '600vh', position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', overflow: 'hidden' }}>
        <motion.div
          style={{
            scale: boxScale, borderRadius, opacity: boxOpacity, width: '100%', height: '100%',
            background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative',
            boxShadow: '0 20px 80px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0)',
            backgroundSize: '32px 32px', pointerEvents: 'none',
          }} />

          <motion.div style={{ opacity: contentOpacity, position: 'relative', zIndex: 2, maxWidth: '920px', padding: isMobile ? '0 1rem' : '0 2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? '1rem' : '2rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 1.2rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text-primary)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-border)',
                letterSpacing: '0.08em',
              }}>
                <Sparkles size={14} />
                AI Decision Intelligence for Resorts
              </span>
            </div>

            <h2 className="font-display" style={{
              fontSize: 'clamp(2.2rem, 5.2vw, 4.2rem)', fontWeight: 900,
              lineHeight: 1.12, letterSpacing: '-0.03em', marginBottom: isMobile ? '0.75rem' : '1.5rem',
            }}>
              {titleWords.map((word, i) => {
                const start = 0.35 + (i / titleWords.length) * 0.12;
                const end = start + 0.03;
                return (
                  <RevealWord key={i} word={word} scrollYProgress={scrollYProgress} start={start} end={end}
                    style={{ color: 'var(--text-primary)', fontWeight: 900 }} />
                );
              })}
            </h2>

            <div style={{ maxWidth: '700px', margin: '0 auto', lineHeight: 1.8 }}>
              {descWords.map((word, i) => {
                const start = 0.45 + (i / descWords.length) * 0.1;
                const end = start + 0.025;
                return (
                  <RevealWord key={i} word={word} scrollYProgress={scrollYProgress} start={start} end={end}
                    style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }} />
                );
              })}
            </div>
          </motion.div>

          <motion.div style={{ opacity: buttonsOpacity, y: buttonsY, display: 'flex', flexDirection: 'row', gap: isMobile ? '0.5rem' : '1rem', marginTop: isMobile ? '1rem' : '2.5rem', position: 'relative', zIndex: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <HoverButton primary href="#features">
              <Sparkles size={16} />
              Explore the Sandbox
              <ArrowRight size={16} />
            </HoverButton>
            <HoverButton href="#about">See How It Works</HoverButton>
          </motion.div>

          <motion.div style={{
            opacity: statsOpacity, y: statsY,
            display: 'flex', flexDirection: 'row', gap: isMobile ? '0.5rem' : '1.5rem', marginTop: isMobile ? '1rem' : '2.5rem',
            position: 'relative', zIndex: 2, alignItems: 'center', justifyContent: 'center',
          }}>
            {stats.map((s, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, borderColor: 'var(--accent-soft-border)' }}
                style={{
                  padding: isMobile ? '0.6rem 1rem' : '1rem 2rem', borderRadius: '1rem',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  textAlign: 'center', cursor: 'default', transition: 'border 0.3s',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
              </motion.div>
            ))}
          </motion.div>

          {!isMobile && (
            <motion.div style={{ opacity: marqueeOpacity, width: '100%', position: 'relative', zIndex: 2 }}>
              <Marquee />
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
