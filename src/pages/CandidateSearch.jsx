import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';
import CandidateCard from '../components/CandidateCard';
import { useIsMobile } from '../lib/useIsMobile';

// `initialQuery` lets Home's search box / example chips deep-link in.
// `onOpenCandidate(id)` navigates to the profile screen.
// `electionType`/`state` scope which election's candidates get searched.
//
// CHANGELOG: replaced client-side sort + a fixed results cap with real
// server-side pagination. Found via actual use: clicking a large party
// (Tamilaga Vettri Kazhagam, 224 candidates fielded) only ever showed a
// capped slice of its roster, with nothing indicating more existed. A
// bigger cap just moves the same problem to a bigger party later, and
// doesn't fix it. Sort now happens in SQL (search.js's ORDER BY) instead
// of in the browser, since client-side sort only ever had access to
// whichever page was currently loaded — sorting "by Name" client-side
// would have silently only reordered the current page, not the true
// alphabetical order across all matches. Switching sort now refetches
// page 1 with the new order, same as switching pages does.
//
// Note: search.js returns an empty result set immediately for an empty
// query (it doesn't fall back to listing all candidates) — so landing on
// this page with no query shows an empty grid, by backend design, not a
// frontend bug.
export default function CandidateSearch({ initialQuery = '', onOpenCandidate, electionType = 'LS', state = null }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('cases');
  const isMobile = useIsMobile();

  // Reset back to page 1 whenever the search itself changes — staying on
  // e.g. page 4 after typing a new query would silently show "page 4 of a
  // completely different result set," which makes no sense to land on.
  useEffect(() => {
    setPage(1);
  }, [query, electionType, state, sortBy]);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, electionType, sortBy, page: String(page) });
    if (state) params.set('state', state);

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setResults(data.results || []);
        setTotalMatches(data.totalMatches || 0);
        setTotalPages(data.totalPages || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, electionType, state, sortBy, page]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, margin: '18px 2px 16px' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.faint }}>
          {loading
            ? 'Searching…'
            : totalMatches > results.length
            ? `Showing ${results.length} of ${totalMatches} ${totalMatches === 1 ? 'candidate' : 'candidates'}`
            : `${totalMatches} ${totalMatches === 1 ? 'candidate' : 'candidates'}`}
        </span>
        {totalMatches > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.faint2 }}>Sort</span>
            {[
              { key: 'cases', label: 'Most cases' },
              { key: 'winner', label: 'Winners first' },
              { key: 'name', label: 'Name' },
              { key: 'constituency', label: 'Constituency' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                style={{
                  fontSize: 12.5,
                  fontWeight: sortBy === opt.key ? 600 : 400,
                  color: sortBy === opt.key ? COLORS.accent : COLORS.ink3,
                  background: sortBy === opt.key ? COLORS.accentTintBg : COLORS.divider,
                  border: '1px solid ' + (sortBy === opt.key ? COLORS.accent : '#e6e7ea'),
                  borderRadius: 20,
                  padding: '4px 11px',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* minmax(330px,...) was forcing a 330px-wide column even on phones
          narrower than 330px + side padding, which forced the whole grid
          into horizontal scroll. Single column on mobile instead. */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {results.map((c) => (
          <CandidateCard key={c.id} candidate={c} onOpen={() => onOpenCandidate(c.id)} />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 28 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              color: page <= 1 ? COLORS.faintest2 : COLORS.ink3,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '7px 14px',
              cursor: page <= 1 ? 'default' : 'pointer',
            }}
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.faint }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              color: page >= totalPages ? COLORS.faintest2 : COLORS.ink3,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '7px 14px',
              cursor: page >= totalPages ? 'default' : 'pointer',
            }}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
