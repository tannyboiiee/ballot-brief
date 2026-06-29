// Party tile system — one identical container shape, two possible fills:
//   (a) an official symbol image (only the 16 sourced/cropped parties), or
//   (b) a generated-identity tile: solid hashed hue + mono abbreviation.
// Cohesion comes from the container, not the contents — see PartyTile.jsx.

export function hashHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}

// Style for the generated-identity fill (no official symbol available).
export function generatedTileStyle(partyName) {
  const hue = hashHue(partyName);
  return {
    background: `oklch(0.6 0.075 ${hue})`,
    border: `1px solid oklch(0.54 0.085 ${hue})`,
    color: `oklch(0.98 0.01 ${hue})`,
  };
}

// Style for the official-symbol slot background (striped placeholder is
// only shown if the image hasn't loaded / as a design reference — in the
// real app this container just frames the real <img>).
export const SYMBOL_SLOT_STYLE = {
  background: 'repeating-linear-gradient(135deg,#eef0f3 0 5px,#e2e5ea 5px 10px)',
  border: '1px solid #e3e4e8',
};

// partySymbols.js's shortPartyName() already shortens the handful of long
// names it knows about (e.g. "ShivSena (Uddhav Balasaheb Thackeray)" →
// "Shiv Sena (UBT)") but for the ~50+ parties it doesn't cover, the input
// here is still the full D1 party string. This derives a compact label for
// the generated-identity tile: pass through names that are already short
// (many D1 party values are literally "BJP", "AAP", etc.), otherwise take
// initials of each word, capped at 4 characters.
export function abbreviate(name) {
  const trimmed = name.trim();
  if (trimmed.length <= 8) return trimmed.toUpperCase();
  const initials = trimmed
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (initials || trimmed.slice(0, 3).toUpperCase()).slice(0, 4);
}
