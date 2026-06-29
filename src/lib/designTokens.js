// Design tokens — lifted directly from the Claude Design handoff.
// Source of truth: design_handoff_ballot_brief_redesign/README.md
// Keep this file as the single place these values live; components should
// import from here rather than hardcoding hex/oklch strings inline.

export const COLORS = {
  pageBg: '#fafafb',
  surface: '#ffffff',
  ink: '#1c1d21',
  ink2: '#3a3c42',
  ink3: '#5b5e66',
  muted: '#73767d',
  faint: '#8a8d94',
  faint2: '#9a9da3',
  faintest: '#a8aab0',
  faintest2: '#b0b2b8',
  border: '#e9eaed',
  borderInput: '#e0e1e5',
  divider: '#f0f1f3',
  divider2: '#f3f3f4',
  divider3: '#f5f5f6',
  accent: '#356aa6', // ship this unless product decides otherwise
  accentTintBg: 'rgba(53,106,166,0.09)',
  winnerText: '#3f7a4e',
  winnerBg: '#eaf3ec',
};

export const FONT_SANS = "'IBM Plex Sans', system-ui, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

// ---------- Severity ramp (THE key system) ----------
// Single warm hue, intensity = severity. Carried only by small solid
// badges + thin bars — never as full-card fills (keeps the page calm).
//
// Originally 4 tiers (Minor/Moderate/Serious/Grave). Collapsed to 2 (Serious
// + Grave) per feedback — the Minor/Moderate boundary was putting things
// like Hurt & Assault and Rioting under "Moderate", which read as too
// lenient. Numeric keys 3/4 kept as-is (rather than renumbering to 1/2) so
// existing severity.js / oklch values didn't need touching beyond the tier
// derivation logic itself.
const SEVERITY = {
  3: {
    label: 'Serious',
    solid: 'oklch(0.62 0.13 46)',
    text: 'oklch(0.98 0.02 60)',
    desc: 'Has a matched IPC section, unarmed and non-grievous — plain rioting, simple hurt, cheating',
  },
  4: {
    label: 'Grave',
    solid: 'oklch(0.42 0.21 25)',
    text: 'oklch(0.98 0.01 25)',
    desc: 'Life/death eligible, weapon-involved, or grievous injury — murder, rape, robbery, dacoity, armed rioting',
  },
};

export function severityLabel(tier) {
  return SEVERITY[tier]?.label ?? '—';
}

export function severityDesc(tier) {
  return SEVERITY[tier]?.desc ?? '';
}

// Returns a React style object for a solid severity badge/bar.
export function severityBadgeStyle(tier) {
  const s = SEVERITY[tier];
  if (!s) return { background: COLORS.divider, color: COLORS.muted };
  return { background: s.solid, color: s.text };
}

export function severitySolid(tier) {
  return SEVERITY[tier]?.solid ?? COLORS.divider;
}

export const SEVERITY_TIERS = [3, 4];
export const SEVERITY_TIERS_DESC = [4, 3]; // most serious first

// ---------- Special legislation flag ----------
// Deliberately outside the warm ramp — outlined chip, ink text/border.
export const SPECIAL_FLAG_STYLE = {
  border: `1.5px solid ${COLORS.ink}`,
  color: COLORS.ink,
};

// ---------- Case-rate intensity chip (party screens) ----------
// Single warm hue, darker = higher rate.
export function rateChipStyle(ratePct) {
  const t = Math.max(0, Math.min(100, ratePct)) / 100;
  const L = 0.95 - 0.42 * t;
  const C = 0.025 + 0.11 * t;
  return {
    background: `oklch(${L.toFixed(3)} ${C.toFixed(3)} 52)`,
    color: t > 0.45 ? 'oklch(0.98 0.02 60)' : 'oklch(0.4 0.09 50)',
  };
}

// ---------- Radius / layout constants ----------
export const RADIUS = {
  card: 14,
  cardLg: 16,
  input: 11,
  buttonPill: 11,
  navButton: 8,
  badge: 7,
  badgeSm: 6,
};

export const LAYOUT_MAX_WIDTH = {
  header: 1100,
  home: 1100,
  candidates: 1100,
  profile: 920,
  leaderboard: 1000,
};
