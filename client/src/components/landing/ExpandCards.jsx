import { useState } from 'react';
import { motion } from 'framer-motion';
import useIsMobile from '../../hooks/useIsMobile';

// Drop matching images into /public/images/expand/
const cards = [
  {
    title: 'Demand Forecasting',
    subtitle: 'Ridge Regression Model',
    desc: 'Predicts room demand and departmental workload from historical bookings, seasonality and weather — the base signal every other module reacts to.',
    image: '/images/expand/forecasting.jpg',
  },
  {
    title: 'What-If Simulation',
    subtitle: 'Scenario Engine',
    desc: 'Adjusts occupancy, weather or ingredient cost and instantly recalculates the effect on revenue, staffing capacity and guest experience.',
    image: '/images/expand/simulation.jpg',
  },
  {
    title: 'Staff Allocation',
    subtitle: 'Co-Optimized Scheduler',
    desc: 'Generates conflict-free, cost-efficient rosters across departments using constraint-based optimization on skills, cost and demand.',
    image: '/images/expand/staffing.jpg',
  },
  {
    title: 'Review Intelligence',
    subtitle: 'NLP + Aspect Sentiment',
    desc: 'Converts guest reviews into structured, actionable tasks — identifying the exact issue, its department and its urgency.',
    image: '/images/expand/reviews.jpg',
  },
  {
    title: 'Dynamic Pricing',
    subtitle: 'Labor-Aware Revenue',
    desc: 'Room pricing that accounts for staff and service capacity, preventing demand from exceeding safe operational limits.',
    image: '/images/expand/pricing.jpg',
  },
  {
    title: 'Predictive Maintenance',
    subtitle: 'Anomaly Detection',
    desc: 'Flags equipment issues from usage and complaint patterns before they escalate into guest-facing failures.',
    image: '/images/expand/maintenance.jpg',
  },
  {
    title: 'Decision Engine',
    subtitle: 'Risk-Scored Recommendations',
    desc: 'Rule-based thresholds and risk scoring produce prescriptive action cards for manager approval — never a silent auto-decision.',
    image: '/images/expand/decision.jpg',
  },
  {
    title: 'Explainability',
    subtitle: 'SHAP-Style Reasoning',
    desc: 'Every alert and recommendation shows the exact signal that triggered it, so managers can trust and verify the system.',
    image: '/images/expand/explainability.jpg',
  },
];

export default function ExpandCards() {
  const [activeIdx, setActiveIdx] = useState(null);
  const isMobile = useIsMobile();

  return (
    <section style={{ background: 'var(--bg-primary)', padding: 'clamp(3rem, 6vw, 5rem) 5vw', position: 'relative', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--text-primary)', padding: '0.3rem 0.8rem', borderRadius: '999px',
          background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-border)',
          display: 'inline-block', marginBottom: '1.2rem',
        }}>
          Under the Hood
        </span>
        <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, margin: 0 }}>
          The Engine Behind the Decisions
        </h2>
      </div>

      <div
        onMouseLeave={() => !isMobile && setActiveIdx(null)}
        style={{
          display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch',
          gap: isMobile ? '8px' : 'clamp(6px, 0.8vw, 12px)', height: isMobile ? 'auto' : 'clamp(380px, 50vw, 540px)',
          maxWidth: '1300px', margin: '0 auto',
        }}
      >
        {cards.map((card, i) => {
          const isActive = i === activeIdx;
          const hasActive = activeIdx !== null;

          return (
            <motion.div
              key={i}
              onMouseEnter={() => !isMobile && setActiveIdx(i)}
              onClick={() => isMobile && setActiveIdx(activeIdx === i ? null : i)}
              animate={{ flex: isMobile ? 'none' : isActive ? 5 : hasActive ? 0.6 : 1 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'relative', borderRadius: 'clamp(14px, 1.8vw, 22px)', overflow: 'hidden',
                cursor: 'pointer', minWidth: 0, border: '1px solid var(--border-color)',
                ...(isMobile ? { height: isActive ? '320px' : '80px', transition: 'height 0.4s ease' } : {}),
              }}
            >
              <img
                src={card.image}
                alt={card.title}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isActive ? 'scale(1.05)' : 'scale(1.2)',
                }}
              />

              <div style={{
                position: 'absolute', inset: 0,
                background: isActive
                  ? 'linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.05) 100%)'
                  : 'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.25) 100%)',
                transition: 'background 0.5s ease',
              }} />

              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: isActive ? 'clamp(20px, 2.2vw, 32px)' : 'clamp(12px, 1.2vw, 18px)',
                transition: 'padding 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', color: '#ffffff',
                  textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem',
                  opacity: isActive ? 1 : 0.5, transition: 'opacity 0.4s ease',
                }}>
                  0{i + 1}
                </span>

                <h3 style={{
                  fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2,
                  fontSize: isActive ? 'clamp(1.2rem, 2vw, 1.7rem)' : 'clamp(0.65rem, 0.85vw, 0.8rem)',
                  transition: 'font-size 0.5s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  {card.title}
                </h3>

                <div style={{
                  maxHeight: isActive ? '300px' : '0px', opacity: isActive ? 1 : 0, overflow: 'hidden',
                  transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
                }}>
                  <p style={{ fontSize: 'clamp(0.72rem, 0.85vw, 0.82rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.3, margin: 0, marginTop: '0.4rem', letterSpacing: '0.01em' }}>
                    {card.subtitle}
                  </p>
                  <p style={{ fontSize: 'clamp(0.72rem, 0.85vw, 0.82rem)', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0, marginTop: '0.5rem', maxWidth: '520px' }}>
                    {card.desc}
                  </p>
                </div>

                <div style={{
                  height: '3px', borderRadius: '2px', background: '#ffffff',
                  marginTop: isActive ? '0.8rem' : '0.35rem', width: isActive ? '48px' : '16px',
                  opacity: isActive ? 1 : 0.4, transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
