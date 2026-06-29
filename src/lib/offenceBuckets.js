// Icon + display mapping for classification.js's REAL offense buckets.
// Previous version of this file guessed at snake_case keys from a
// screenshot — now that classification.js is in hand, these are the
// *actual* OFFENSE_BUCKETS labels (the keys classifyCase().offenseBucket
// returns), used verbatim as object keys below. No translation needed.
//
// Three buckets aren't in OFFENSE_BUCKETS itself but are real possible
// values of offenseBucket / tier from classifyCase(): "Other / Uncategorized"
// (fallback inside classifyOffenseType), "Not determinable" (Unclassified
// cases — no substantive IPC section matched), and "Special/Security Law"
// (UAPA etc. — set as offenseBucket on Special Legislation cases). All three
// are included here so every real classifyCase() output has an icon.

import { Activity, Package, Users, Shield, MessageSquare, Scale, FileText, User, AlertTriangle } from 'lucide-react';

export const OFFENCE_BUCKET_DISPLAY = {
  'Murder & Attempted Murder': { icon: Activity },
  'Crime Against Women': { icon: User },
  'Kidnapping & Abduction': { icon: User },
  'Human Trafficking': { icon: User },
  'Robbery & Dacoity': { icon: Package },
  'Hurt & Assault': { icon: Activity },
  'Wrongful Restraint / Confinement': { icon: Activity },
  'Arson & Property Destruction': { icon: Package },
  'House-trespass / Burglary': { icon: Package },
  'Unlawful Assembly & Rioting': { icon: Users },
  'Contempt of Public Authority': { icon: Shield },
  'Criminal Intimidation & Threats': { icon: Shield },
  'Promoting Enmity / Hate Speech': { icon: Users },
  'Corruption & Bribery': { icon: Scale },
  'Forgery & Cheating': { icon: FileText },
  Defamation: { icon: MessageSquare },
  'Other / Uncategorized': { icon: FileText },
  'Not determinable': { icon: FileText },
  'Special/Security Law': { icon: AlertTriangle },
};

export function getOffenceBucketDisplay(bucketLabel) {
  return OFFENCE_BUCKET_DISPLAY[bucketLabel] || { icon: FileText };
}

// Builds the "All (N)" + per-bucket filter chip options — this is the
// re-skin of your existing live filter-chip feature. `cases` here are
// already-classified case objects carrying `offenseBucket` (see
// lib/severity.js classifyAndAttach()).
export function buildOffenceFilterOptions(cases) {
  const counts = {};
  for (const c of cases) {
    const key = c.offenseBucket || 'Not determinable';
    counts[key] = (counts[key] || 0) + 1;
  }
  const options = Object.keys(counts).map((key) => ({
    key,
    label: key,
    icon: getOffenceBucketDisplay(key).icon,
    count: counts[key],
  }));
  options.sort((a, b) => {
    if (a.key === 'Not determinable') return 1;
    if (b.key === 'Not determinable') return -1;
    return b.count - a.count;
  });
  return [{ key: 'all', label: 'All', count: cases.length }, ...options];
}
