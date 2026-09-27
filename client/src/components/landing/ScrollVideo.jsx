import { useRef, useEffect, useCallback } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';
import { ChevronDown, SkipForward } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

// Drop your generated resort walkthrough frames into /public/frames/
// named frame_0001.jpg ... frame_0240.jpg (or update FRAME_COUNT below
// to match however many frames you export).
const FRAME_COUNT = 240;

function getFrameSrc(index) {
  const num = Math.min(Math.max(Math.round(index), 1), FRAME_COUNT);
  return `/frames/frame_${String(num).padStart(4, '0')}.jpg`;
}

export default function ScrollVideo() {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const currentFrameRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const frameIndex = useTransform(scrollYProgress, [0, 1], [1, FRAME_COUNT]);

  useEffect(() => {
    const imgs = [];
    let loadedCount = 0;
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getFrameSrc(i);
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1) {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      imgs[i] = img;
    }
    imagesRef.current = imgs;
  }, []);

  const renderFrame = useCallback((index) => {
    const roundedIndex = Math.min(Math.max(Math.round(index), 1), FRAME_COUNT);
    if (roundedIndex === currentFrameRef.current) return;
    currentFrameRef.current = roundedIndex;

    const canvas = canvasRef.current;
    const img = imagesRef.current[roundedIndex];
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  }, []);

  useEffect(() => {
    const unsubscribe = frameIndex.on('change', renderFrame);
    return () => unsubscribe();
  }, [frameIndex, renderFrame]);

  // Skips straight past the entire pinned/scrubbed hero section to whatever
  // comes next, so people don't have to manually scroll through it.
  const handleSkip = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const targetY = el.offsetTop + el.offsetHeight;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }, []);

  const skipOpacity = useTransform(scrollYProgress, [0, 0.92, 0.98], [1, 1, 0]);

  return (
    <div id="hero" ref={containerRef} style={{ height: isMobile ? '300vh' : '500vh', position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Skip Intro — jumps past the whole scrubbed hero section */}
        <motion.button
          onClick={handleSkip}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute', top: isMobile ? '5rem' : '1.75rem', right: isMobile ? '1.25rem' : '1.75rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem', zIndex: 5,
            padding: '0.55rem 1rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.92)', background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
            cursor: 'pointer', opacity: skipOpacity,
          }}
        >
          Skip Intro
          <SkipForward size={14} />
        </motion.button>

        {/* Gradient transition into the next section */}
        <motion.div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(to top, var(--bg-primary), transparent)',
            opacity: useTransform(scrollYProgress, [0.7, 1], [0, 1]),
          }}
        />

        {/* Title overlay */}
        <motion.div
          style={{
            position: 'absolute', bottom: '15%', left: '50%', x: '-50%', textAlign: 'center',
            opacity: useTransform(scrollYProgress, [0, 0.15, 0.5, 0.7], [1, 1, 0.8, 0]),
          }}
        >
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, color: 'white',
              textShadow: '0 4px 30px rgba(0,0,0,0.6)', lineHeight: 1.1,
            }}
          >
            Resort 360
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.3rem)', color: 'rgba(255,255,255,0.82)',
              marginTop: '1rem', fontWeight: 300,
            }}
          >
            Simulate the decision before you make it
          </p>

          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.3rem)', color: 'rgba(255,255,255,0.82)',
              marginTop: '1rem', fontWeight: 300,
            }}
          >
            Scroll To Enter the Resort
          </p>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}
          >
            <ChevronDown size={22} color="rgba(255,255,255,0.75)" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
