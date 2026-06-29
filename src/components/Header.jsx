import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';
import { useIsMobile } from '../lib/useIsMobile';

// Sticky global header. `active` is 'home' | 'candidates' | 'parties'.
// `onNavigate(view)` should drive whatever routing/state switch the app uses.
export default function Header({ active, onNavigate }) {
  const isMobile = useIsMobile();

  const navItem = (view, label) => {
    const isActive = active === view;
    return (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        style={{
          fontSize: isMobile ? 12 : 14,
          fontWeight: isActive ? 600 : 500,
          padding: isMobile ? '5px 7px' : '7px 13px',
          borderRadius: 8,
          color: isActive ? COLORS.accent : COLORS.muted,
          background: isActive ? COLORS.accentTintBg : 'transparent',
          transition: 'color .12s, background .12s',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(250,250,251,0.86)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          maxWidth: LAYOUT_MAX_WIDTH.header,
          margin: '0 auto',
          padding: isMobile ? '8px 12px' : '13px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 6 : 24,
        }}
      >
        <button onClick={() => onNavigate('home')} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 11, flexShrink: 0 }}>
          <span
            style={{
              width: isMobile ? 22 : 28,
              height: isMobile ? 22 : 28,
              borderRadius: 7,
              background: COLORS.ink,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ width: isMobile ? 8 : 11, height: isMobile ? 8 : 11, borderRadius: 2, border: `2.5px solid ${COLORS.pageBg}` }} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
            <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15, letterSpacing: '-0.01em', color: COLORS.ink, whiteSpace: 'nowrap' }}>
              Ballot Brief
            </span>
            {!isMobile && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.faint, letterSpacing: '0.04em' }}>
                LOK SABHA 2024
              </span>
            )}
          </span>
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 4, flexShrink: 1, minWidth: 0 }}>
          {navItem('home', isMobile ? 'Home' : 'Overview')}
          {navItem('candidates', isMobile ? 'Search' : 'Candidates')}
          {navItem('parties', 'Parties')}
        </nav>
      </div>
    </header>
  );
}
