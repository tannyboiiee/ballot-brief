import { COLORS, FONT_MONO } from '../lib/designTokens';

// Re-skin of your existing offense-category filter chips (the dark-theme
// "All (243) / Murder & Attempted Murder (18) / ..." row). Same behaviour —
// click a chip to filter the case record to that offence bucket — just
// restyled to match the new light design system instead of the old dark one.
//
// `options` comes from buildOffenceFilterOptions() in lib/offenceBuckets.js.
// `active` is the currently-selected bucket key ('all' by default).
export default function OffenceFilterChips({ options, active, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? COLORS.accent : COLORS.ink3,
              background: isActive ? COLORS.accentTintBg : COLORS.divider,
              border: `1px solid ${isActive ? 'rgba(53,106,166,0.25)' : '#e6e7ea'}`,
              borderRadius: 20,
              padding: '7px 13px',
              transition: 'color .12s, background .12s, border-color .12s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: isActive ? COLORS.accent : COLORS.faint,
              }}
            >
              ({opt.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
