import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { SlidersHorizontal, Users2, MessageSquareText, UtensilsCrossed, ShieldCheck } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

// Drop matching portrait images (3:4) into /public/images/horizontal/
// named exactly as referenced below.
const infoItems = [
  {
    num: 1,
    icon: SlidersHorizontal,
    title: 'What-If Simulator',
    desc: 'Change occupancy, weather or ingredient cost and instantly see the effect on revenue, staffing, housekeeping and guest experience — before committing to anything.',
    image: '/images/horizontal/sandbox.jpg',
  },
  {
    num: 2,
    icon: Users2,
    title: 'Co-Optimized Staffing',
    desc: 'Generates conflict-free, cost-efficient rosters across departments — balancing demand forecasts against staff skills, preferences and burnout risk.',
    image: '/images/horizontal/staffing.jpg',
  },
  {
    num: 3,
    icon: MessageSquareText,
    title: 'Guest Review Intelligence',
    desc: 'Reads guest reviews, identifies the exact issue — a leaking AC, a rattling noise — and routes a department-wise work order automatically.',
    image: '/images/horizontal/reviews.jpg',
  },
  {
    num: 4,
    icon: UtensilsCrossed,
    title: 'Plate-to-Pantry F&B Loop',
    desc: 'Links occupancy and dining trends to kitchen inventory — forecasting ingredient demand, adjusting menu pricing and auto-drafting purchase orders.',
    image: '/images/horizontal/fnb.jpg',
  },
  {
    num: 5,
    icon: ShieldCheck,
    title: 'Prescriptive Action Cards',
    desc: 'Every recommendation ships with impact, cost, confidence and risk — for a manager to approve, modify or reject before anything executes.',
    image: '/images/horizontal/actions.jpg',
  },
];

export default function HorizontalInfoSection() {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  if (isMobile) {
    return (
      <section id="features" ref={containerRef} style={{ height: `${infoItems.length * 100}vh`, position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', paddingTop: '4rem' }}>
          <div style={{ padding: '0 6vw', marginBottom: '1.5rem' }}>
            <div style={{ width: '100%', height: '3px', background: 'var(--border-color)', borderRadius: '2px', position: 'relative' }}>
              <motion.div style={{ width: progressWidth, height: '100%', background: 'var(--accent)', borderRadius: '2px' }} />
              {infoItems.map((item, i) => {
                const dotPos = i / (infoItems.length - 1);
                return (
                  <motion.div key={i} style={{
                    position: 'absolute', left: `${dotPos * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
                    width: '1.4rem', height: '1.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 800,
                    color: useTransform(scrollYProgress, [Math.max(0, dotPos - 0.03), dotPos + 0.02], ['var(--text-muted)', 'var(--on-accent)']),
                    background: useTransform(scrollYProgress, [Math.max(0, dotPos - 0.03), dotPos + 0.02], ['var(--bg-secondary)', 'var(--accent)']),
                  }}>
                    {item.num}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {infoItems.map((item, i) => {
              const segStart = i / infoItems.length;
              const segPeak = (i + 0.3) / infoItems.length;
              const segEnd = (i + 0.85) / infoItems.length;
              const segFadeOut = (i + 1) / infoItems.length;
              const cardOpacity = useTransform(scrollYProgress, [segStart, segPeak, segEnd, segFadeOut], [0, 1, 1, i === infoItems.length - 1 ? 1 : 0]);
              const cardY = useTransform(scrollYProgress, [segStart, segPeak], ['30px', '0px']);
              const IconComp = item.icon;

              return (
                <motion.div key={i} style={{ opacity: cardOpacity, y: cardY, position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 6vw', gap: '1rem' }}>
                  <div style={{ width: '55vw', maxWidth: '220px', aspectRatio: '3 / 4', borderRadius: '1rem', overflow: 'hidden', background: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--card-border)', flexShrink: 0 }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                      <IconComp size={18} color="var(--text-primary)" />
                    </div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="features" ref={containerRef} style={{ height: `${infoItems.length * 120}vh`, position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden', minHeight: 0, padding: '1rem 6vw 1.5rem' }}>
          <div style={{ display: 'flex', gap: '3vw', width: '100%' }}>
            {infoItems.map((item, i) => {
              const segStart = i / infoItems.length;
              const segPeak = (i + 0.4) / infoItems.length;
              const segEnd = (i + 1) / infoItems.length;
              const y = useTransform(scrollYProgress, [segStart, segPeak, segEnd], ['-120%', '0%', '0%']);
              const opacity = useTransform(scrollYProgress, [segStart, segPeak - 0.02, segPeak], [0, 0.8, 1]);
              const scale = useTransform(scrollYProgress, [segStart, segPeak, segEnd], [0.7, 1, 0.95]);
              return (
                <motion.div key={i} style={{ y, opacity, scale, flex: '0 0 auto', width: `${100 / infoItems.length - 2}%`, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '75%', maxWidth: '180px', aspectRatio: '3 / 4', borderRadius: '1rem', overflow: 'hidden', background: 'var(--bg-secondary)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--card-border)', position: 'relative' }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, var(--accent-soft), transparent)', pointerEvents: 'none' }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '0 6vw', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', position: 'relative' }}>
            <motion.div style={{ width: progressWidth, height: '100%', background: 'var(--accent)', borderRadius: '2px' }} />
            {infoItems.map((item, i) => {
              const dotPos = i / (infoItems.length - 1);
              return (
                <motion.div key={i} style={{
                  position: 'absolute', left: `${dotPos * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
                  width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 800,
                  color: useTransform(scrollYProgress, [Math.max(0, dotPos - 0.03), dotPos + 0.02], ['var(--text-muted)', 'var(--on-accent)']),
                  background: useTransform(scrollYProgress, [Math.max(0, dotPos - 0.03), dotPos + 0.02], ['var(--bg-secondary)', 'var(--accent)']),
                }}>
                  {item.num}
                </motion.div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', position: 'relative', overflow: 'hidden', padding: '2.5rem 6vw 3rem', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '3vw', width: '100%' }}>
            {infoItems.map((item, i) => {
              const segStart = i / infoItems.length;
              const segPeak = (i + 0.4) / infoItems.length;
              const segEnd = (i + 1) / infoItems.length;
              const y = useTransform(scrollYProgress, [segStart, segPeak, segEnd], ['80px', '0px', '0px']);
              const opacity = useTransform(scrollYProgress, [segStart, segPeak - 0.02, segPeak, segEnd - 0.05, segEnd], [0, 0.6, 1, 1, 1]);
              const IconComp = item.icon;
              return (
                <motion.div key={i} style={{ y, opacity, flex: '0 0 auto', width: `${100 / infoItems.length - 2}%` }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <IconComp size={18} color="var(--text-primary)" />
                  </div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 'clamp(0.8rem, 1vw, 0.92rem)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
