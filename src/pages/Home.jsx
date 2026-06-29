import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH, severityBadgeStyle, severityLabel, severityDesc } from '../lib/designTokens';
import { RateChip, SpecialLegislationChip } from '../components/SeverityBadge';
import PartyTile from '../components/PartyTile';
import { useIsMobile } from '../lib/useIsMobile';

const EXAMPLES = ['Devraj Naik', 'Kolhapur', 'BJP'];

// Stat-strip numbers are hardcoded — there's no single endpoint that
// returns total candidates/seats/parties across the whole dataset.
// party-stats.js specifically excludes small parties (`HAVING total >= 10`),
// so summing its response would undercount. These four figures are the
// known fixed facts about this dataset (per the project notes) rather than
// something derived live; update them here directly if the dataset changes.
const STATS = { candidates: '7,515', seats: 543, parties: 68, tiers: 2 };

// `onSearch(query)` navigates to the Candidates view with the query applied.
// `onNavigateParties()` navigates to the Parties view.
export default function Home({ onSearch, onNavigateParties }) {
  const [query, setQuery] = useState('');
  const [topParties, setTopParties] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch('/api/party-stats')
      .then((r) => r.json())
      .then((data) => {
        const stats = (data.stats || []).map((s) => ({
          name: s.party,
          seatsWon: s.seatsWon,
          candidateCount: s.total,
          caseRate: s.total > 0 ? Math.round((s.withCases / s.total) * 100) : 0,
        }));
        // party-stats.js itself sorts by case-rate descending; re-sort by
        // seats won for this "by seats won" section specifically.
        const bySeats = [...stats].sort((a, b) => b.seatsWon - a.seatsWon).slice(0, 10);
        setTopParties(bySeats);
      })
      .catch(() => {});
  }, []);

  const maxSeats = Math.max(1, ...topParties.map((p) => p.seatsWon || 0));

  return (
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.home, margin: '0 auto', padding: isMobile ? '28px 14px 60px' : '52px 28px 80px' }}>
      {/* Hero */}
      <section style={{ maxWidth: 680 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', color: COLORS.faint, textTransform: 'uppercase' }}>
          Criminal &amp; financial disclosures · ADR / MyNeta affidavits
        </span>
        <h1 style={{ fontSize: 43, lineHeight: 1.06, letterSpacing: '-0.025em', fontWeight: 700, margin: '14px 0 16px', color: COLORS.ink }}>
          See past the case count.
        </h1>
        <p style={{ fontSize: 17, color: COLORS.ink3, margin: '0 0 26px', maxWidth: 560 }}>
          A raw number — "12 pending cases" — hides everything that matters. Ballot Brief grades every declared case by
          severity and offence type, so you can tell a defamation complaint from an attempt to murder at a glance.
        </p>

        <div style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderInput}`,
              borderRadius: 11,
              padding: '0 14px',
              boxShadow: '0 1px 2px rgba(20,22,30,0.03)',
            }}
          >
            <Search size={18} color={COLORS.faint} strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
              placeholder="Search a candidate, constituency or party"
              style={{ flex: 1, border: 'none', background: 'none', padding: '14px 0', fontSize: 15, color: COLORS.ink, outline: 'none' }}
            />
          </div>
          <button onClick={() => onSearch(query)} style={{ background: COLORS.accent, color: '#fff', fontWeight: 600, fontSize: 14.5, padding: '0 22px', borderRadius: 11 }}>
            Search
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 13, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: COLORS.faint2 }}>Try</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => onSearch(ex)} style={{ fontSize: 12.5, color: COLORS.ink3, background: COLORS.divider, border: '1px solid #e6e7ea', borderRadius: 20, padding: '4px 11px' }}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Stat strip */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 1,
          background: COLORS.border,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 13,
          overflow: 'hidden',
          marginTop: 46,
        }}
      >
        {[
          { value: STATS.candidates, label: 'candidates' },
          { value: STATS.seats, label: 'seats' },
          { value: STATS.parties, label: 'parties' },
          { value: STATS.tiers, label: 'severity tiers' },
        ].map((st) => (
          <div key={st.label} style={{ background: COLORS.surface, padding: '20px 22px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', color: COLORS.ink }}>{st.value}</div>
            <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 3 }}>{st.label}</div>
          </div>
        ))}
      </section>

      {/* How we grade a case */}
      <section style={{ marginTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: COLORS.ink }}>How we grade a case</h2>
          <span style={{ fontSize: 13, color: COLORS.faint2, fontFamily: FONT_MONO }}>CrPC First Schedule · IPC chapters</span>
        </div>
        {/* Heads up: this severity ramp doesn't exist in classification.js yet
            — see lib/severity.js for the placeholder heuristic deriving it. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {[4, 3].map((t) => (
            <div key={t} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '16px 16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, ...severityBadgeStyle(t) }} />
                <span style={{ fontWeight: 600, fontSize: 14.5, color: COLORS.ink }}>{severityLabel(t)}</span>
              </div>
              <p style={{ fontSize: 12.5, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>{severityDesc(t)}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '13px 16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: COLORS.divider, color: COLORS.muted, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            —
          </span>
          <span style={{ fontSize: 12.5, color: COLORS.muted }}>
            <strong style={{ color: COLORS.ink2, fontWeight: 600 }}>Not determinable</strong> — some cases don't cite a section we can match to a clear category. Shown separately rather than guessed.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '13px 16px' }}>
          <SpecialLegislationChip />
          <span style={{ fontSize: 12.5, color: COLORS.muted }}>
            Charges under special acts — UAPA, NDPS, PMLA — are flagged separately from the severity ramp, never folded into it.
          </span>
        </div>
      </section>

      {/* Parties by seats won */}
      <section style={{ marginTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: COLORS.ink }}>Parties by seats won</h2>
          <button onClick={onNavigateParties} style={{ color: COLORS.accent, fontSize: 13.5, fontWeight: 500 }}>
            View all parties →
          </button>
        </div>
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 13, overflow: 'hidden' }}>
          {topParties.map((p, i) => (
            <button
              key={p.name}
              onClick={() => onSearch(p.name)}
              title={`See ${p.name}'s candidates, sorted by case count`}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: isMobile ? '32px 1fr 64px' : '30px 38px 1fr 116px 132px',
                alignItems: 'center',
                gap: isMobile ? 10 : 14,
                padding: isMobile ? '10px 14px' : '11px 18px',
                borderBottom: `1px solid ${COLORS.divider}`,
                textAlign: 'left',
                transition: 'background .12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.pageBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {isMobile ? (
                <>
                  <PartyTile partyName={p.name} size={32} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.ink }}>
                      {p.name}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.faint2 }}>{p.seatsWon} seats</span>
                  </span>
                  <RateChip ratePct={p.caseRate} />
                </>
              ) : (
                <>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLORS.faintest2, textAlign: 'right' }}>{i + 1}</span>
                  <PartyTile partyName={p.name} size={38} />
                  <span style={{ fontWeight: 500, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.ink }}>{p.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ flex: 1, height: 7, background: COLORS.divider, borderRadius: 4, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', background: COLORS.ink2, borderRadius: 4, width: `${(p.seatsWon / maxSeats) * 100}%` }} />
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, width: 30, textAlign: 'right' }}>{p.seatsWon}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: COLORS.faint2 }}>cases</span>
                    <RateChip ratePct={p.caseRate} />
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: COLORS.faintest, margin: '10px 2px 0' }}>
          "Cases" = share of the party's candidates with at least one declared criminal case. Only parties with 10+
          candidates are included (party-stats.js excludes smaller ones). Click a party to see its candidates, top
          case-count first.
        </p>
      </section>
    </main>
  );
}
