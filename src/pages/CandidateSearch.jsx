import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';
import CandidateCard from '../components/CandidateCard';

// `initialQuery` lets Home's search box / example chips deep-link in.
// `onOpenCandidate(id)` navigates to the profile screen.
//
// Note: search.js returns `{ results: [] }` immediately for an empty query
// (it doesn't fall back to listing all 7,515) — so landing on this page with
// no query shows an empty grid, by backend design, not a frontend bug. If
// you'd rather show some default list (e.g. top-by-case-count) on first
// load, that's a search.js change, not something to patch around here.
export default function CandidateSearch({ initialQuery = '', onOpenCandidate }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setResults(data.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  return (
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.candidates, margin: '0 auto', padding: '34px 28px 80px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderInput}`,
          borderRadius: 11,
          padding: '0 15px',
          maxWidth: 560,
          boxShadow: '0 1px 2px rgba(20,22,30,0.03)',
        }}
      >
        <Search size={18} color={COLORS.faint} strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a candidate, constituency or party"
          style={{ flex: 1, border: 'none', background: 'none', padding: '14px 0', fontSize: 15, outline: 'none' }}
        />
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.faint, margin: '18px 2px 16px' }}>
        {loading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'candidate' : 'candidates'}`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {results.map((c) => (
          <CandidateCard key={c.id} candidate={c} onOpen={() => onOpenCandidate(c.id)} />
        ))}
      </div>
    </main>
  );
}
