import ScrollVideo from '../components/landing/ScrollVideo';
import ExpandingCTA from '../components/landing/ExpandingCTA';
import ScrollTextSection from '../components/landing/ScrollTextSection';
import HorizontalInfoSection from '../components/landing/HorizontalInfoSection';
import StackingCards from '../components/landing/StackingCards';
import ExpandCards from '../components/landing/ExpandCards';
import ContactSection from '../components/landing/ContactSection';
import RevealFooter from '../components/landing/RevealFooter';
import Navbar from '../components/landing/Navbar';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar view="landing" onNavigateHome={() => window.scrollTo(0, 0)} onLoginClick={() => navigate('/login')} />
      {/* Footer sits fixed behind everything */}
      <RevealFooter />

      {/* Main content sits on top, z-index 2 */}
      <div style={{ background: 'var(--bg-primary)', position: 'relative', zIndex: 2 }}>
        {/* Section 1: Scroll-scrubbed hero video (canvas frame sequence) */}
        <ScrollVideo />

        {/* Section 2: Expanding box CTA */}
        <ExpandingCTA />

        {/* Section 3: About — pinned text animations */}
        <ScrollTextSection />

        {/* Section 4: Horizontal pinned feature cards */}
        <HorizontalInfoSection />

        {/* Section 5: Stacking department cards */}
        <StackingCards />

        {/* Section 6: Expand-on-hover technical capability cards */}
        <ExpandCards />

        {/* Section 7: Contact */}
        <ContactSection />
      </div>

      {/* Spacer that lets the fixed footer reveal underneath */}
      <div style={{ height: '100vh', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />
    </>
  );
}
