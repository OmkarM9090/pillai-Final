import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import useIsMobile from '../../hooks/useIsMobile';

const heroLine1 = 'One Brain,';
const heroLine2 = 'Every Department.';
const tagline = 'No silos. No guesswork. Just an approved next step.';

const paragraphs = [
  {
    label: '01 — WHAT',
    words: 'ResortSandbox 360 is a decision layer that sits above bookings staffing housekeeping F&B and guest feedback connecting them into one simulate-before-you-decide system'.split(' '),
  },
  {
    label: '02 — HOW',
    words: 'It forecasts demand runs What-If scenarios on occupancy and cost then converts guest reviews into department tasks and staffing plans automatically using AI'.split(' '),
  },
  {
    label: '03 — WHO',
    words: 'Built for resort managers who need one unified view of revenue operations and guest experience instead of switching between five disconnected systems'.split(' '),
  },
];

function HoverWord({ children, style }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={hovered ? { color: 'var(--text-primary)', scale: 1.08 } : { color: style?.color || 'var(--text-secondary)', scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ display: 'inline-block', cursor: 'default', transformOrigin: 'center bottom', ...style }}
    >
      {children}
    </motion.span>
  );
}

function RevealWord({ word, scrollYProgress, start, end }) {
  const opacity = useTransform(scrollYProgress, [start, end], [0.1, 1]);
  const y = useTransform(scrollYProgress, [start, end], [12, 0]);
  const blur = useTransform(scrollYProgress, [start, end], [4, 0]);
  const filterVal = useTransform(blur, (v) => `blur(${v}px)`);

  return (
    <motion.span style={{ opacity, y, filter: filterVal, display: 'inline-block', marginRight: '0.35em' }}>
      <HoverWord>{word}</HoverWord>
    </motion.span>
  );
}

function AnimatedChar({ char, scrollYProgress, start, end }) {
  const opacity = useTransform(scrollYProgress, [start, end], [0, 1]);
  const y = useTransform(scrollYProgress, [start, end], [60, 0]);
  const rotateX = useTransform(scrollYProgress, [start, end], [45, 0]);

  return (
    <motion.span style={{ opacity, y, rotateX, display: 'inline-block', transformPerspective: 600, transformOrigin: 'center bottom' }}>
      <HoverWord style={{ color: 'var(--text-primary)', fontWeight: 900 }}>
        {char === ' ' ? '\u00A0' : char}
      </HoverWord>
    </motion.span>
  );
}

export default function ScrollTextSection() {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const titleOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const labelOpacity = useTransform(scrollYProgress, [0, 0.03], [0, 1]);
  const taglineOpacity = useTransform(scrollYProgress, [0.08, 0.14], [0, 1]);
  const taglineY = useTransform(scrollYProgress, [0.08, 0.14], [30, 0]);
  const dividerWidth = useTransform(scrollYProgress, [0.14, 0.2], ['0%', '100%']);

  return (
    <section id="about" ref={containerRef} style={{ height: isMobile ? '300vh' : '400vh', position: 'relative' }}>
      <div
        style={{
          position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column',
          justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '5rem 5vw 2rem' : '0 8vw',
          background: 'var(--bg-primary)', overflow: 'hidden',
        }}
      >
        <motion.div style={{ opacity: labelOpacity, marginBottom: isMobile ? '1rem' : '2rem' }}>
          <span style={{
            display: 'inline-block', padding: '0.4rem 1.2rem', borderRadius: '999px',
            fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 700, color: 'var(--text-primary)',
            background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-border)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            About the Platform
          </span>
        </motion.div>

        <motion.div style={{ opacity: titleOpacity, marginBottom: isMobile ? '0.25rem' : '0.5rem' }}>
          <h2 className="font-display" style={{
            fontSize: isMobile ? 'clamp(1.8rem, 6vw, 3rem)' : 'clamp(3rem, 7vw, 6rem)',
            fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-primary)',
          }}>
            {heroLine1.split('').map((char, i) => {
              const total = heroLine1.length;
              const start = (i / total) * 0.06;
              return <AnimatedChar key={`l1-${i}`} char={char} scrollYProgress={scrollYProgress} start={start} end={start + 0.03} />;
            })}
            <br />
            {heroLine2.split('').map((char, i) => {
              const total = heroLine2.length;
              const start = 0.03 + (i / total) * 0.06;
              return <AnimatedChar key={`l2-${i}`} char={char} scrollYProgress={scrollYProgress} start={start} end={start + 0.03} />;
            })}
          </h2>
        </motion.div>

        <motion.p className="font-display" style={{
          opacity: taglineOpacity, y: taglineY, fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
          fontWeight: 400, color: 'var(--text-muted)', marginBottom: isMobile ? '1.5rem' : '3rem', letterSpacing: '-0.01em',
        }}>
          {tagline}
        </motion.p>

        <motion.div style={{
          width: dividerWidth, height: '2px',
          background: 'linear-gradient(90deg, var(--accent), transparent)',
          marginBottom: isMobile ? '1.5rem' : '3rem',
        }} />

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? '2rem' : '3rem', maxWidth: '1100px',
        }}>
          {paragraphs.map((para, pi) => {
            const sectionStart = 0.2 + pi * 0.25;
            return (
              <div key={pi}>
                <motion.span style={{
                  display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem',
                  opacity: useTransform(scrollYProgress, [sectionStart, sectionStart + 0.05], [0, 1]),
                }}>
                  {para.label}
                </motion.span>
                <div style={{ lineHeight: 1.8, fontSize: '1rem' }}>
                  {para.words.map((word, wi) => {
                    const wordStart = sectionStart + 0.03 + (wi / para.words.length) * 0.18;
                    return <RevealWord key={wi} word={word} scrollYProgress={scrollYProgress} start={wordStart} end={wordStart + 0.04} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
