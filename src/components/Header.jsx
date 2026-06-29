import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';

// Sticky global header. `active` is 'home' | 'candidates' | 'parties'.
// `onNavigate(view)` should drive whatever routing/state switch the app uses.
export default function Header({ active, onNavigate }) {
  const navItem = (view, label) => {
    const isActive = active === view;
    return (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        style={{
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          padding: '7px 13px',
          borderRadius: 8,
          color: isActive ? COLORS.accent : COLORS.muted,
          background: isActive ? COLORS.accentTintBg : 'transparent',
          transition: 'color .12s, background .12s',
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
          padding: '13px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <button onClick={() => onNavigate('home')} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: COLORS.ink,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ width: 11, height: 11, borderRadius: 2, border: `2.5px solid ${COLORS.pageBg}` }} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: COLORS.ink }}>
              Ballot Brief
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.faint, letterSpacing: '0.04em' }}>
              LOK SABHA 2024
            </span>
          </span>
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navItem('home', 'Overview')}
          {navItem('candidates', 'Candidates')}
          {navItem('parties', 'Parties')}
        </nav>
      </div>
    </header>
  );
}
