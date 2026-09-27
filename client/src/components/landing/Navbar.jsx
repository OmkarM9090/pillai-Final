import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BoxSelect, Menu, X, Moon, Sun, LogIn } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import useIsMobile from '../../hooks/useIsMobile';

const navLinks = [
  { href: '#hero', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#features', label: 'Features' },
  { href: '#contact', label: 'Contact' },
];

export default function Navbar({ view = 'landing', onNavigateHome, onLoginClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const { isDark, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  // The login page has no tall hero to scroll through, so force the
  // "scrolled" (solid) nav style there rather than the transparent hero style.
  const effectiveScrolled = view === 'login' ? true : scrolled;

  useEffect(() => {
    if (view === 'login') return;
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * (isMobile ? 2.5 : 4.8));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile, view]);

  // Track which section is currently in view so the nav pill highlights
  // the right link instead of always showing "Home". IntersectionObserver's
  // ratio-based thresholds don't work reliably here because several sections
  // are pinned/scrubbed and 3-5x the viewport tall (their intersection ratio
  // never reaches the threshold), so we compare scroll offsets directly instead.
  useEffect(() => {
    if (view !== 'landing') return;

    let ticking = false;

    const computeActive = () => {
      const sections = navLinks
        .map((link) => document.getElementById(link.href.slice(1)))
        .filter(Boolean)
        .sort((a, b) => a.offsetTop - b.offsetTop);
      if (!sections.length) return;

      const referencePoint = window.scrollY + window.innerHeight * 0.35;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.offsetTop <= referencePoint) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        computeActive();
        ticking = false;
      });
    };

    computeActive();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [view]);

  const handleNavClick = (e, href) => {
    setMenuOpen(false);
    if (view !== 'landing') {
      e.preventDefault();
      onNavigateHome?.();
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.querySelector(href)?.scrollIntoView({ block: 'start' });
        }, 60);
      });
    }
  };

  const handleLoginClick = () => {
    setMenuOpen(false);
    onLoginClick?.();
  };

  const textColor = effectiveScrolled ? 'var(--text-primary)' : 'rgba(255,255,255,0.85)';
  const activeTextColor = effectiveScrolled ? 'var(--on-accent)' : '#ffffff';
  const activeBg = effectiveScrolled ? 'var(--accent)' : 'rgba(255,255,255,0.22)';
  const pillBg = effectiveScrolled ? 'var(--nav-bg)' : 'rgba(255,255,255,0.1)';
  const pillBorder = effectiveScrolled ? 'var(--glass-border)' : 'rgba(255,255,255,0.18)';
  const pillShadow = effectiveScrolled ? 'var(--nav-shadow)' : 'none';
  const logoColor = effectiveScrolled ? 'var(--text-primary)' : 'white';
  const logoShadow = effectiveScrolled ? 'none' : '0 1px 8px rgba(0,0,0,0.35)';
  const loginBorder = effectiveScrolled ? 'var(--border-color)' : 'rgba(255,255,255,0.35)';
  const loginBg = effectiveScrolled ? 'var(--accent)' : 'rgba(255,255,255,0.14)';
  const loginColor = effectiveScrolled ? 'var(--on-accent)' : '#ffffff';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'transparent',
        transition: 'all 0.4s ease',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Left Zone: Logo */}
          <div className="flex-1 flex justify-start">
            <a href="#hero" className="flex items-center gap-3 no-underline" onClick={(e) => handleNavClick(e, '#hero')}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: 'var(--accent)', transition: 'background 0.4s' }}
              >
                <BoxSelect size={20} color="var(--on-accent)" />
              </div>
              <span
                className="text-xl font-bold font-display tracking-tight"
                style={{ color: logoColor, textShadow: logoShadow, transition: 'color 0.4s, text-shadow 0.4s' }}
              >
                Resort360
              </span>
            </a>
          </div>

          {/* Desktop Nav & Actions */}
          <div className="hidden md:flex items-center gap-8 ml-auto">
            <div
              className="flex items-center gap-2"
              style={{
                background: pillBg,
                backdropFilter: 'blur(16px)',
                borderRadius: '999px',
                padding: '0.375rem 0.75rem',
                border: `1px solid ${pillBorder}`,
                boxShadow: pillShadow,
                transition: 'all 0.4s ease',
              }}
            >
              {navLinks.map((link) => {
                const isActive = view === 'landing' && activeSection === link.href.slice(1);
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="flex items-center justify-center px-5 py-2 rounded-full text-[0.9rem] font-semibold no-underline tracking-wide"
                    style={{
                      color: isActive ? activeTextColor : textColor,
                      background: isActive ? activeBg : 'transparent',
                      transition: 'all 0.4s ease',
                    }}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            <div className="flex items-center gap-5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLoginClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.5rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 600,
                  border: `1px solid ${loginBorder}`, background: loginBg, color: loginColor,
                  cursor: 'pointer', transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
              >
                <LogIn size={16} />
                Login
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '44px', height: '44px', borderRadius: '50%', border: `1px solid ${loginBorder}`, cursor: 'pointer',
                  background: effectiveScrolled ? 'var(--pill-bg)' : 'rgba(255,255,255,0.12)',
                  color: effectiveScrolled ? 'var(--text-primary)' : 'rgba(255,255,255,0.9)',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </motion.button>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-full border-0 bg-transparent cursor-pointer"
              style={{ color: logoColor, transition: 'color 0.4s' }}
            >
              {isDark ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-full border-0 bg-transparent cursor-pointer"
              style={{ color: logoColor, transition: 'color 0.4s' }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden px-4 py-4"
          style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = view === 'landing' && activeSection === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 text-sm font-medium no-underline py-3 px-3 rounded-xl"
                  style={{
                    color: isActive ? 'var(--on-accent)' : 'var(--text-primary)',
                    background: isActive ? 'var(--accent)' : 'transparent',
                  }}
                  onClick={(e) => handleNavClick(e, link.href)}
                >
                  {link.label}
                </a>
              );
            })}
            <button
              className="flex items-center gap-2 text-sm font-medium py-3 px-3 rounded-xl border-0 cursor-pointer"
              style={{ color: 'var(--on-accent)', background: 'var(--accent)', marginTop: '0.25rem' }}
              onClick={handleLoginClick}
            >
              <LogIn size={16} />
              Login
            </button>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
