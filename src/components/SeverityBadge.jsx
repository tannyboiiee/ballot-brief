import { FONT_MONO, severityBadgeStyle, severityLabel, rateChipStyle, SPECIAL_FLAG_STYLE } from '../lib/designTokens';
import { AlertTriangle } from 'lucide-react';

// Small solid square swatch carrying the severity tier as color only
// (no number — color + label is the signal, not a numeric id).
export function SeverityBadge({ tier, size = 26, showLabel = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: size <= 26 ? 7 : 9,
          ...severityBadgeStyle(tier),
        }}
      />
      {showLabel && <span style={{ fontWeight: 600, fontSize: size <= 26 ? 14.5 : 16 }}>{severityLabel(tier)}</span>}
    </span>
  );
}

// Outlined chip for special-legislation flags (UAPA/NDPS/PMLA) — deliberately
// outside the severity ramp so it reads as a different kind of thing.
export function SpecialLegislationChip({ label = 'Special legislation', small = false }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: small ? 4 : 7,
        fontSize: small ? 10.5 : 12,
        fontWeight: 600,
        borderRadius: small ? 5 : 7,
        padding: small ? '1px 6px' : '4px 9px',
        ...SPECIAL_FLAG_STYLE,
        border: small ? '1.3px solid #1c1d21' : SPECIAL_FLAG_STYLE.border,
      }}
    >
      <AlertTriangle size={small ? 10 : 13} strokeWidth={small ? 2.4 : 2} />
      {label}
    </span>
  );
}

// Light → dark chip used for case-rate on party screens.
export function RateChip({ ratePct }) {
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        padding: '4px 10px',
        ...rateChipStyle(ratePct),
      }}
    >
      {ratePct}%
    </span>
  );
}
