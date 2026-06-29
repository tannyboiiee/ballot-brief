import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';
import CandidateCard from '../components/CandidateCard';
import { useIsMobile } from '../lib/useIsMobile';

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
  const isMobile = useIsMobile();

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
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.candidates, margin: '0 auto', padding: isMobile ? '20px 14px 60px' : '34px 28px 80px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderInput}`,
          borderRadius: 11,
          padding: '0 15px',
          width: '100%',
          maxWidth: 560,
          boxSizing: 'border-box',
          boxShadow: '0 1px 2px rgba(20,22,30,0.03)',
        }}
      >
        <Search size={18} color={COLORS.faint} strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a candidate, constituency or party"
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: '14px 0', fontSize: 15, outline: 'none' }}
        />
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.faint, margin: '18px 2px 16px' }}>
        {loading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'candidate' : 'candidates'}`}
      </div>

      {/* minmax(330px,...) was forcing a 330px-wide column even on phones
          narrower than 330px + side padding, which forced the whole grid
          into horizontal scroll. Single column on mobile instead. */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {results.map((c) => (
          <CandidateCard key={c.id} candidate={c} onOpen={() => onOpenCandidate(c.id)} />
        ))}
      </div>
    </main>
  );
}
