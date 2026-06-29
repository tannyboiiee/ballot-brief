// ---------------------------------------------------------------------------
// READ THIS BEFORE TOUCHING THE SEVERITY RAMP
//
// classification.js's classifyCase() only returns a binary split via its
// `tier` field: "Special Legislation" | "Unclassified" | "Serious" |
// "Non-serious" — it has no severity-tier concept of its own beyond that.
// This matches what's already in the project notes: populating
// ipc_bns_section_reference with a real severity mapping is a "known
// future task, not started."
//
// This file derives a *placeholder* severity tier from each case's worst
// IPC_REF entry (years), so the UI has something concrete to render today.
// Originally a 4-level ramp (Minor/Moderate/Serious/Grave); collapsed to 2
// (Serious/Grave) after the Minor/Moderate boundary turned out to read as
// too lenient for things like Hurt & Assault and Rioting. Treat this file
// as a draft of the real ipc_bns_section_reference work, not a finished
// feature — review tierFromIpcRef() below if you want different thresholds.
// ---------------------------------------------------------------------------

import { IPC_REF, classifyCase } from './classification'; // adjust path to match where classification.js actually lives in your repo

function worstSectionCode(classified) {
  // classifyCase() returns `primary` as "IPC 307" for substantive cases,
  // "UAPA" for Special Legislation, or null for Unclassified.
  if (!classified.primary || !classified.primary.startsWith('IPC ')) return null;
  return classified.primary.slice(4);
}

// Heuristic threshold — see file header. Collapsed to 2 tiers (Serious /
// Grave) per feedback: the old 4-tier version was putting things like Hurt
// & Assault and Rioting under "Moderate", which read as too lenient. Now
// every substantive (classified) case is "Serious" unless it crosses into
// life-imprisonment/death-eligible territory, in which case it's "Grave".
function tierFromIpcRef(ref) {
  if (!ref) return null;
  if (ref.years >= 99) return 4; // life imprisonment / death eligible — Grave
  return 3; // everything else with a matched IPC section — Serious
}

// ---------------------------------------------------------------------------
// Grave overrides — principle agreed on: anything that causes or risks
// physical harm to a person (lethal, sexual, or loss of bodily autonomy) is
// Grave, regardless of what IPC_REF's `years` field says. `years` reflects
// formal max sentence for the specific charge (often an *attempt*), not how
// grave the underlying act actually is — that's the bug 307 exposed.
//
// Two kinds of override:
//  - GRAVE_BUCKET_OVERRIDES: every section in this offence bucket is Grave,
//    no exceptions — only for buckets that are uniformly severe.
//  - GRAVE_SECTION_OVERRIDES: specific sections, for buckets that mix
//    severity levels (e.g. "Hurt & Assault" has both simple hurt and
//    grievous-hurt-by-weapon; "Crime Against Women" has both a verbal-insult
//    section and assault sections) — only the listed codes are elevated.
// ---------------------------------------------------------------------------
const GRAVE_BUCKET_OVERRIDES = new Set([
  'Murder & Attempted Murder', // 302/303/307/308 — attempt is not a lesser charge
  'Robbery & Dacoity', // inherently force-against-a-person, not just property
]);

const GRAVE_SECTION_OVERRIDES = new Set([
  '326', // grievous hurt by dangerous weapon
  '333', // grievous hurt to a public servant, by dangerous weapon
  '366', // kidnapping/abducting a woman to compel marriage
  '354', // assault on a woman, outraging modesty — physical, not just verbal
  '498A', // cruelty by husband or relatives — domestic violence
  '370', // trafficking of persons — base offence formally caps at 10yrs,
  // years inflate to life only in aggravated sub-clauses classifyCase can't
  // distinguish from the section code alone; treat the offence as Grave
  // outright rather than relying on which sub-clause happened to apply.
  '370A', // exploitation of a trafficked person — sexual exploitation,
  // formally capped at 5-7yrs even though the harm is severe.
  '326B', // attempted acid attack — same attempt-pattern as 307/308: capped
  // at 7yrs because no injury resulted, not because the act was lesser.

  // "Weapon or grievous injury" rule — added after reviewing real case
  // data: rioting-with-a-weapon and hurt-by-a-weapon were both landing in
  // Serious purely because their years figures (3, 3) don't cross the 99
  // sentinel, the same root bug as 307. Deliberately did NOT bucket-override
  // all of "Hurt & Assault" or "Unlawful Assembly & Rioting" — those buckets
  // also contain simple, unarmed, common charges (323 plain hurt; 141/143/
  // 144/145/146/147 plain rioting/unlawful assembly) that would dilute what
  // "Grave" means if swept in wholesale; only the weapon/grievous-specific
  // sections below are elevated.
  '148', // rioting, armed with a deadly weapon
  '324', // causing hurt by a dangerous weapon
  '325', // causing grievous hurt — no weapon required, but "grievous" by
  // definition means permanent disfigurement, fracture, or danger to life;
  // arguably more severe than weapon-involvement without grievous injury.
]);

// Takes one raw case row from /api/candidate/[id] — shape:
// { id, status, sections, other, note } — and returns it enriched with
// everything the new UI components need:
//   { ...original, numericTier, offenseBucket, special, sectionsLabel }
export function classifyAndAttach(rawCase) {
  const classified = classifyCase(rawCase.sections, rawCase.other);
  const code = worstSectionCode(classified);

  let numericTier = null;
  let special = null;

  if (classified.tier === 'Special Legislation') {
    // No years/bailable data exists for UAPA-type sections (they're not in
    // IPC_REF), so there's nothing principled to derive a tier from. Defaulting
    // to 4 (Grave) since these charges are inherently severe — confirm this
    // default is the right call rather than, say, leaving Special Legislation
    // cases out of the severity ramp entirely.
    numericTier = 4;
    special = classified.primary || 'Special legislation';
  } else if (classified.tier === 'Unclassified') {
    numericTier = null; // rendered as "Not determinable", outside the ramp
  } else if (GRAVE_BUCKET_OVERRIDES.has(classified.offenseBucket)) {
    numericTier = 4;
  } else if (code && GRAVE_SECTION_OVERRIDES.has(code)) {
    numericTier = 4;
  } else {
    numericTier = tierFromIpcRef(IPC_REF[code]);
  }

  return {
    ...rawCase,
    numericTier,
    offenseBucket: classified.offenseBucket,
    offenseSubType: classified.offenseSubType,
    special,
    primaryLabel: classified.primaryLabel || null,
    primary: classified.primary || null,
    category: classified.category || null,
    verified: classified.verified,
  };
}

export function classifyAllCases(cases) {
  return (cases || []).map(classifyAndAttach);
}
