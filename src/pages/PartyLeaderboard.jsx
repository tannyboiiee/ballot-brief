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
  textAlign: 'left',
};

// party-stats.js now filters on `HAVING seats_won >= 3` (was `total >= 10`
// candidates fielded) — the case-rate percentage's real sample size is
// seats won, not candidates fielded, so the "enough data to be meaningful"
// threshold moved to match. This means the party list shown here can look
// different from before even for the same election, and will look VERY
// different across election types — Tamil Nadu's 234 seats are split much
// more evenly across parties than Lok Sabha's national numbers, so expect
// more parties to clear the bar there than you might expect from the LS view.
//
// electionType / state props: not yet wired to an actual scope-selector UI
// (that doesn't exist yet) — default to Lok Sabha so the existing view keeps
// working unchanged. Once a scope switcher exists, pass the selected scope
// down as these two props and this component will fetch the right data.
export default function PartyLeaderboard({ onSelectParty, electionType = 'LS', state = null }) {
  const [parties, setParties] = useState([]);
  const [sort, setSort] = useState({ key: 'seatsWon', dir: -1 });
  const isMobile = useIsMobile();

  useEffect(() => {
    const params = new URLSearchParams({ electionType });
    if (state) params.set('state', state);

    fetch(`/api/party-stats?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const stats = (data.stats || []).map((s) => ({
          name: s.party,
          seatsWon: s.seatsWon,
          candidateCount: s.totalFielded,
          winnersWithCases: s.winnersWithCases,
          caseRate: s.caseRatePct,
        }));
        setParties(stats);
      })
      .catch(() => {});
  }, [electionType, state]);

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
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.header, margin: '0 auto', padding: isMobile ? '20px 14px 60px' : '34px 28px 80px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', color: COLORS.ink }}>Parties</h1>
      <p style={{ fontSize: 14, color: COLORS.faint, margin: '0 0 22px' }}>
        {parties.length} parties shown (3+ seats won) · case rate is share of each party's actual winners with a
        declared case, not their whole candidate pool · sorted live. Click a column to re-sort.
      </p>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '36px minmax(0, 1fr) 56px' : '44px minmax(0, 1fr) 145px 130px 120px',
            alignItems: 'center',
            gap: isMobile ? 10 : 20,
            padding: isMobile ? '10px 14px' : '12px 20px',
            borderBottom: `1px solid ${COLORS.border}`,
            background: '#fbfbfc',
          }}
        >
          {/* CHANGELOG (alignment consistency with Home.jsx): "Party" used to
              span columns 1-2 (tile + name) as one sort button with
              textAlign:'left', which put its text flush at the left edge of
              column 1 (the 44px tile slot) — same underlying pattern that
              needed fixing on the home page's "Criminals in parties by seats
              won" widget, even though here it happened to look OK visually
              since there's no separate rank-number column ahead of the tile
              to throw things off. Restructured to match Home.jsx's fixed
              pattern anyway, for consistency: an empty placeholder for the
              tile column, then "Party" as its own sort button starting
              exactly at column 2, directly above where each row's party
              name text begins. */}
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
              <button onClick={() => toggleSort('candidateCount')} style={{ ...sortHeadStyle, paddingLeft: 60 }}>
                Fielded {arrow('candidateCount')}
              </button>
              <button onClick={() => toggleSort('caseRate')} style={{ ...sortHeadStyle, textAlign: 'right' }}>
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
              gridTemplateColumns: isMobile ? '36px minmax(0, 1fr) 56px' : '44px minmax(0, 1fr) 145px 130px 120px',
              alignItems: 'center',
              gap: isMobile ? 10 : 20,
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
                    {p.winnersWithCases}/{p.seatsWon} winners with cases
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
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLORS.ink3, textAlign: 'left', paddingLeft: 60 }}>{p.candidateCount}</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.faintest2 }}>
                    {p.winnersWithCases}/{p.seatsWon}
                  </span>
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
