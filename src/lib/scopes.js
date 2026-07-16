// Registry of election scopes the site can show data for. Add a new state
// here once its data is actually loaded — nothing else needs to change to
// make it selectable, since Header/ScopeSelector/App all read from this list.
//
// group: 'national' | 'state' — just for visually grouping the dropdown
// (Lok Sabha on its own, states listed together underneath).
export const SCOPES = [
  {
    id: 'LS2024',
    electionType: 'LS',
    state: null,
    label: 'Lok Sabha 2024',
    shortLabel: 'LOK SABHA 2024',
    group: 'national',
    // unchanged from the original hardcoded EXAMPLES in Home.jsx
    examples: ['K Surendran', 'Kolhapur', 'BJP'],
  },
  {
    id: 'TamilNadu2026',
    electionType: 'MLA',
    state: 'Tamil Nadu',
    label: 'Tamil Nadu Assembly 2026',
    shortLabel: 'TAMIL NADU 2026',
    group: 'state',
    // real, verified names from this session's actual scraped/loaded data —
    // Udhayanidhi Stalin and Chepauk-Thiruvallikeni confirmed via a direct
    // D1 query earlier, not placeholders.
    examples: ['Udhayanidhi Stalin', 'Chepauk-Thiruvallikeni', 'DMK'],
  },
  // Add Kerala2026 / Assam2026 / Puducherry2026 / WestBengal2026 here once
  // each state's data is actually loaded — same shape as TamilNadu2026 above,
  // including 2-3 real verified example names for that state.
];

export const DEFAULT_SCOPE = SCOPES[0];
