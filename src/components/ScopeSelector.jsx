import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { COLORS, FONT_MONO } from '../lib/designTokens';
import { SCOPES } from '../lib/scopes';

// `scope` = the currently selected scope object (see lib/scopes.js).
// `onChange(scope)` fires when the user picks a different one.
export default function ScopeSelector({ scope, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const nationalScopes = SCOPES.filter((s) => s.group === 'national');
  const stateScopes = SCOPES.filter((s) => s.group === 'state');

  const renderOption = (s) => {
    const isActive = s.id === scope.id;
    return (
      <button
        key={s.id}
        onClick={() => {
          onChange(s);
          setOpen(false);
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? COLORS.accent : COLORS.ink,
          background: isActive ? COLORS.accentTintBg : 'transparent',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = COLORS.pageBg;
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        {s.label}
      </button>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: COLORS.faint,
          letterSpacing: '0.04em',
        }}
      >
        {scope.shortLabel}
        <ChevronDown size={11} strokeWidth={2.5} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            minWidth: 220,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(20,22,30,0.12)',
            padding: 6,
            zIndex: 50,
          }}
        >
          {nationalScopes.map(renderOption)}

          {stateScopes.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: COLORS.faintest2,
                  padding: '8px 12px 4px',
                  textTransform: 'uppercase',
                }}
              >
                State Assemblies
              </div>
              {stateScopes.map(renderOption)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
