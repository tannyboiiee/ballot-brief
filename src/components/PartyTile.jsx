import { FONT_MONO } from '../lib/designTokens';
import { generatedTileStyle, abbreviate } from '../lib/partyTile';
import { PARTY_SYMBOLS, shortPartyName } from '../lib/partySymbols'; // adjust path if partySymbols.js lives somewhere else in your repo

// Looks up the real symbol + short label internally — callers just pass the
// exact party name string from D1 (the one already used for filtering/
// matching elsewhere, with its en-dash/no-space quirks intact).
//
// `size` in px. Radius is 6px at <=22px, 9px above that, per the tokens.
export default function PartyTile({ partyName, size = 32 }) {
  const symbolSrc = PARTY_SYMBOLS[partyName];
  const label = abbreviate(shortPartyName(partyName));
  const radius = size <= 22 ? 6 : 9;
  const fontSize = size <= 22 ? 8 : label.length > 4 ? 8.5 : 10.5;

  if (symbolSrc) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: '#ffffff',
          border: '1px solid #e3e4e8',
          overflow: 'hidden',
        }}
        title={partyName}
      >
        {/* Real party flags, not isolated icons (per partySymbols.js notes) —
            cropped to the tile via object-fit: cover, same treatment as a
            circular country-flag icon. */}
        <img src={symbolSrc} alt={partyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: FONT_MONO,
        fontWeight: 600,
        fontSize,
        letterSpacing: '0.01em',
        ...generatedTileStyle(partyName),
      }}
      title={partyName}
    >
      {label}
    </span>
  );
}
