import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useMotionValue, useInView } from 'framer-motion';

// Drop matching landscape images into /public/images/cards/
const cards = [
  {
    title: 'Bookings & Demand',
    desc: 'Occupancy forecasting from historical bookings, seasonality and live weather — the signal every other department reacts to.',
    stat: '95% peak',
    image: '/images/cards/bookings.jpg',
  },
  {
    title: 'Staffing & Scheduling',
    desc: 'Rosters generated against forecast demand, staff skills and preferences — reducing overtime and burnout risk automatically.',
    stat: '-65.7% OT',
    image: '/images/cards/staffing.jpg',
  },
  {
    title: 'Housekeeping & Maintenance',
    desc: 'Guest reviews and staff reports converted directly into routed, department-specific work orders — no manual re-entry.',
    stat: 'Auto-routed',
    image: '/images/cards/housekeeping.jpg',
  },
  {
    title: 'F&B & Inventory',
    desc: 'Ingredient demand forecasting tied to occupancy and dining trends, with purchase orders drafted before stock runs low.',
    stat: '-food waste',
    image: '/images/cards/fnb.jpg',
  },
  {
    title: 'Guest Feedback',
    desc: 'Sentiment and issue extraction from reviews, feeding straight back into the operational loop that fixes the problem.',
    stat: 'NLP-driven',
    image: '/images/cards/feedback.jpg',
  },
];

function StickyCard({ card }) {
  const vertMargin = 10;
  const container = useRef(null);
  const [maxScrollY, setMaxScrollY] = useState(Infinity);

  const scaleVal = useMotionValue(1);
  const rotateVal = useMotionValue(0);

  const { scrollY } = useScroll({ target: container });

  const isInView = useInView(container, {
    margin: `0px 0px -${100 - vertMargin}% 0px`,
    once: true,
  });

  useEffect(() => {
    if (isInView && maxScrollY === Infinity) {
      setMaxScrollY(scrollY.get());
    }
  }, [isInView]);

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (currentY) => {
      let animVal = 1;
      if (currentY > maxScrollY) {
        animVal = Math.max(0, 1 - (currentY - maxScrollY) / 8000);
      }
      scaleVal.set(animVal);
      rotateVal.set((1 - animVal) * 80);
    });
    return unsubscribe;
  }, [maxScrollY, scrollY, scaleVal, rotateVal]);

  return (
    <motion.div
      ref={container}
      style={{
        scale: scaleVal, rotate: rotateVal, position: 'sticky', top: `${vertMargin}vh`,
        height: `${100 - 2 * vertMargin}vh`, width: '100%', maxWidth: '1000px', borderRadius: '2rem',
        overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)', willChange: 'transform', transformOrigin: 'center center',
      }}
    >
      <img src={card.image} alt={card.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3rem 3.5rem',
        background: 'var(--card-fade-gradient)',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1.1rem', borderRadius: '999px', background: 'var(--bg-card)', border: '1.5px solid var(--accent-soft-border)', marginBottom: '1rem' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{card.stat}</span>
        </div>

        <h3 className="font-display" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: 1.2 }}>
          {card.title}
        </h3>

        <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, maxWidth: '550px' }}>
          {card.desc}
        </p>
      </div>
    </motion.div>
  );
}

export default function StackingCards() {
  useEffect(() => {
    let lenis;
    const initLenis = async () => {
      const Lenis = (await import('lenis')).default;
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 2,
        smoothWheel: true,
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    };
    initLenis();
    return () => {
      if (lenis) lenis.destroy();
    };
  }, []);

  return (
    <section style={{ background: 'var(--bg-primary)', position: 'relative', overflow: 'visible' }}>
      <div style={{ textAlign: 'center', padding: '6rem 4vw 3rem' }}>
        <span style={{
          display: 'inline-block', padding: '0.4rem 1.2rem', borderRadius: '999px', fontSize: '0.85rem',
          fontWeight: 600, color: 'var(--text-primary)', background: 'var(--accent-soft)',
          border: '1px solid var(--accent-soft-border)', letterSpacing: '0.05em', textTransform: 'uppercase',
          marginBottom: '1.5rem',
        }}>
          Departments
        </span>
        <h2 className="font-display" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 800, color: 'var(--text-primary)' }}>
          One Loop, Five Departments
        </h2>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10vh', padding: '0 4vw',
        paddingTop: '30vh', paddingBottom: '50vh', overflow: 'visible',
      }}>
        {cards.map((card, i) => (
          <StickyCard key={i} card={card} />
        ))}
      </div>
    </section>
  );
}
