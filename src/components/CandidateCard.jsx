import { COLORS, FONT_MONO, severityLabel, severityBadgeStyle, severitySolid } from '../lib/designTokens';
import { hashHue } from '../lib/partyTile';
import PartyTile from './PartyTile';
import { Check } from 'lucide-react';

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarStyle(name) {
  const h = hashHue(name);
  return { background: `oklch(0.93 0.035 ${h})`, color: `oklch(0.45 0.08 ${h})` };
}

// `candidate` from search.js today is just { id, name, party, constituency,
// totalCases } — no per-case breakdown, no is_winner, no photo_url. The
// stacked severity bar + "highest tier" badge from the Claude Design export
// need classified case data to draw, which search.js doesn't return (it
// only returns the aggregate count). So this renders the rich bar *only*
// if a full `cases` array is present (future-proofed in case you later
// extend search.js to include classified cases or a precomputed severity
// summary per candidate) — otherwise it falls back to a plain count line.
export default function CandidateCard({ candidate, onOpen }) {
  const hasClassifiedCases = Array.isArray(candidate.cases);
  const total = hasClassifiedCases ? candidate.cases.length : candidate.totalCases ?? 0;

  let cnt, highest;
  if (hasClassifiedCases) {
    cnt = { 3: 0, 4: 0 };
    for (const c of candidate.cases) if (c.numericTier) cnt[c.numericTier]++;
    highest = [4, 3].find((t) => cnt[t] > 0) || 0;
  }

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 17,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'box-shadow .12s, border-color .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#cfd1d6';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(20,22,30,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
        {candidate.photoUrl ? (
          <img src={candidate.photoUrl} alt={candidate.name} style={{ width: 48, height: 48, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 16,
              flexShrink: 0,
              ...avatarStyle(candidate.name),
            }}
          >
            {initials(candidate.name)}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 600, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.ink }}>
              {candidate.name}
            </span>
            {/* search.js doesn't return is_winner today — this only shows up
                if/when that field is added to the search response. */}
            {candidate.isWinner && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: COLORS.winnerText,
                  background: COLORS.winnerBg,
                  borderRadius: 5,
                  padding: '2px 6px',
                  flexShrink: 0,
                }}
              >
                <Check size={11} strokeWidth={3} /> Won
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, fontSize: 12.5, color: COLORS.faint }}>
            <PartyTile partyName={candidate.party} size={18} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.constituency}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.divider}`, paddingTop: 13 }}>
        {total === 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: COLORS.winnerText }}>
            <Check size={14} strokeWidth={2.2} /> No declared criminal cases
          </span>
        ) : hasClassifiedCases ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.muted }}>
                {total} declared {total === 1 ? 'case' : 'cases'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COLORS.muted }}>
                highest
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600, borderRadius: 5, padding: '2px 7px', ...severityBadgeStyle(highest) }}>
                  {severityLabel(highest)}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: COLORS.divider }}>
              {[3, 4].filter((t) => cnt[t] > 0).map((t) => (
                <span key={t} style={{ display: 'block', width: `${(cnt[t] / total) * 100}%`, background: severitySolid(t) }} />
              ))}
            </div>
          </>
        ) : (
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.muted }}>
            {total} declared {total === 1 ? 'case' : 'cases'} — open profile for severity breakdown
          </span>
        )}
      </div>
    </button>
  );
}
