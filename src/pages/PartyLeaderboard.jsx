import { useState, useEffect, useMemo } from 'react';
import { COLORS, FONT_MONO, LAYOUT_MAX_WIDTH } from '../lib/designTokens';
import { generatedTileStyle } from '../lib/partyTile';
import PartyTile from '../components/PartyTile';
import { RateChip } from '../components/SeverityBadge';
import { PARTY_SYMBOLS } from '../lib/partySymbols'; // adjust path if partySymbols.js lives somewhere else in your repo
import { useIsMobile } from '../lib/useIsMobile';

const sortHeadStyle = {
  fontFamily: FONT_MONO,
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: COLORS.faint,
  fontWeight: 600,
  textAlign: 'right',
};

// party-stats.js has `HAVING total >= 10` — it deliberately excludes parties
// with fewer than 10 candidates, so this list will show noticeably fewer
// than the dataset's full 68 parties. That's a backend filtering choice
// (the project notes' "68 parties" / "Show all 68" expectation predates
// this endpoint), not something to patch around in the frontend — if you
// want a true full-68 leaderboard, that's a party-stats.js change (drop or
// loosen the HAVING clause for this specific view).
export default function PartyLeaderboard({ onSelectParty }) {
  const [parties, setParties] = useState([]);
  const [sort, setSort] = useState({ key: 'seatsWon', dir: -1 });
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
        setParties(stats);
      })
      .catch(() => {});
  }, []);

  const toggleSort = (key) => {
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'name' ? 1 : -1 }));
  };

  const arrow = (key) => (sort.key === key ? (sort.dir === 1 ? '▴' : '▾') : '');

  const sorted = useMemo(() => {
    const arr = [...parties];
    arr.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * sort.dir;
      return ((a[sort.key] || 0) - (b[sort.key] || 0)) * sort.dir;
    });
    return arr;
  }, [parties, sort]);

  const maxSeats = Math.max(1, ...parties.map((p) => p.seatsWon || 0));

  return (
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.leaderboard, margin: '0 auto', padding: isMobile ? '20px 14px 60px' : '34px 28px 80px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', color: COLORS.ink }}>Parties</h1>
      <p style={{ fontSize: 14, color: COLORS.faint, margin: '0 0 22px' }}>
        {parties.length} parties shown (10+ candidates) · sorted live. Click a column to re-sort.
      </p>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '36px 1fr 56px' : '44px 1fr 160px 130px 150px',
            alignItems: 'center',
            gap: isMobile ? 10 : 14,
            padding: isMobile ? '10px 14px' : '12px 20px',
            borderBottom: `1px solid ${COLORS.border}`,
            background: '#fbfbfc',
          }}
        >
          <span />
          <button onClick={() => toggleSort('name')} style={{ ...sortHeadStyle, textAlign: 'left' }}>
            Party {arrow('name')}
          </button>
          {isMobile ? (
            <button onClick={() => toggleSort('caseRate')} style={sortHeadStyle}>
              Cases {arrow('caseRate')}
            </button>
          ) : (
            <>
              <button onClick={() => toggleSort('seatsWon')} style={sortHeadStyle}>
                Seats won {arrow('seatsWon')}
              </button>
              <button onClick={() => toggleSort('candidateCount')} style={sortHeadStyle}>
                Candidates {arrow('candidateCount')}
              </button>
              <button onClick={() => toggleSort('caseRate')} style={sortHeadStyle}>
                Case rate {arrow('caseRate')}
              </button>
            </>
          )}
        </div>

        {sorted.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelectParty?.(p.name)}
            title={`See ${p.name}'s candidates, sorted by case count`}
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: isMobile ? '36px 1fr 56px' : '44px 1fr 160px 130px 150px',
              alignItems: 'center',
              gap: isMobile ? 10 : 14,
              padding: isMobile ? '10px 14px' : '12px 20px',
              borderBottom: `1px solid ${COLORS.divider2}`,
              textAlign: 'left',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.pageBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <PartyTile partyName={p.name} size={isMobile ? 32 : 44} />
            {isMobile ? (
              <>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.ink }}>
                    {p.name}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.faintest2 }}>
                    {p.seatsWon} seats · {p.candidateCount} candidates
                  </span>
                </span>
                <RateChip ratePct={p.caseRate} />
              </>
            ) : (
              <>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 14.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.ink }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: COLORS.faintest2 }}>{PARTY_SYMBOLS[p.name] ? 'Official symbol' : 'Generated identity'}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ flex: 1, height: 7, background: COLORS.divider, borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', background: COLORS.ink2, borderRadius: 4, width: `${(p.seatsWon / maxSeats) * 100}%` }} />
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right' }}>{p.seatsWon}</span>
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLORS.ink3, textAlign: 'right', paddingRight: 34 }}>{p.candidateCount}</span>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <RateChip ratePct={p.caseRate} />
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16, fontSize: 12, color: COLORS.faint }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fff', border: '1px solid #e3e4e8' }} />
          Official symbol — {Object.keys(PARTY_SYMBOLS).length} parties
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, ...generatedTileStyle('Sample') }} />
          Generated identity — fallback for the rest
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,oklch(0.95 0.03 52),oklch(0.55 0.13 44))' }} />
          Case rate: light → dark
        </span>
      </div>
    </main>
  );
}
