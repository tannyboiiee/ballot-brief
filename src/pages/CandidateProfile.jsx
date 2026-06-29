import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, MapPin, Trophy, Check } from 'lucide-react';
import {
  COLORS,
  FONT_MONO,
  LAYOUT_MAX_WIDTH,
  SEVERITY_TIERS_DESC,
  severityLabel,
  severityBadgeStyle,
  severitySolid,
} from '../lib/designTokens';
import PartyTile from '../components/PartyTile';
import { SpecialLegislationChip } from '../components/SeverityBadge';
import CaseRecord from '../components/CaseRecord';
import { getOffenceBucketDisplay } from '../lib/offenceBuckets';
import { classifyAllCases } from '../lib/severity';
import { useIsMobile } from '../lib/useIsMobile';

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// Builds the "In context" callout sentence from classified case counts.
function buildContextSentence(cases) {
  const total = cases.length;
  if (total === 0) return '';
  const cnt = { 3: 0, 4: 0 };
  let unclassified = 0;
  for (const c of cases) {
    if (c.numericTier) cnt[c.numericTier]++;
    else unclassified++;
  }
  let s = `${total} declared ${total === 1 ? 'case' : 'cases'}.`;
  if (cnt[4] > 0) s += ` ${cnt[4]} fall in the gravest tier (life or death eligible).`;
  if (cnt[3] > 0) s += ` ${cnt[3]} ${cnt[3] === 1 ? 'is' : 'are'} serious, with a matched IPC section short of that.`;
  if (unclassified > 0) s += ` ${unclassified} could not be matched to a clear section and ${unclassified === 1 ? 'is' : 'are'} shown as not determinable.`;
  return s;
}

// `candidateId` drives the fetch; `onBack()` returns to the search list.
// /api/candidate/[id] returns a flat object with one merged `cases` array
// (each case has a `status: "pending" | "convicted"` field) — not separate
// pendingCases/convictedCases lists. Each raw case is run through
// classifyAndAttach() (lib/severity.js) here, right after the fetch, so
// every downstream component just renders already-classified data.
export default function CandidateProfile({ candidateId, onBack, showContextCallout = true }) {
  const isMobile = useIsMobile();
  const [candidate, setCandidate] = useState(null);
  const [caseView, setCaseView] = useState('pending'); // 'pending' | 'convicted'

  useEffect(() => {
    setCandidate(null);
    fetch(`/api/candidate/${candidateId}`)
      .then((r) => r.json())
      .then((data) => {
        setCandidate({ ...data, cases: classifyAllCases(data.cases) });
      })
      .catch(() => {});
  }, [candidateId]);

  const allCases = candidate?.cases || [];
  const pendingCases = useMemo(() => allCases.filter((c) => c.status === 'pending'), [allCases]);
  const convictedCases = useMemo(() => allCases.filter((c) => c.status === 'convicted'), [allCases]);
  const cases = caseView === 'pending' ? pendingCases : convictedCases;

  if (!candidate) {
    return <main style={{ maxWidth: LAYOUT_MAX_WIDTH.profile, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 28px 80px' }}>Loading…</main>;
  }

  const total = cases.length;
  const cnt = { 3: 0, 4: 0 };
  let unclassified = 0;
  for (const c of cases) {
    if (c.numericTier) cnt[c.numericTier]++;
    else unclassified++;
  }
  const highest = [4, 3].find((t) => cnt[t] > 0) || 0;
  const tierCount = [3, 4].filter((t) => cnt[t] > 0).length;
  const specials = cases.filter((c) => c.special).length;

  const offenceCounts = {};
  for (const c of cases) offenceCounts[c.offenseBucket] = (offenceCounts[c.offenseBucket] || 0) + 1;
  const offMax = Math.max(1, ...Object.values(offenceCounts));
  const offenceRows = Object.keys(offenceCounts)
    .map((b) => ({ key: b, label: b, icon: getOffenceBucketDisplay(b).icon, count: offenceCounts[b] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <main style={{ maxWidth: LAYOUT_MAX_WIDTH.profile, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 28px 80px' }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>
        <ArrowLeft size={15} strokeWidth={2} /> All candidates
      </button>

      {/* Header card */}
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '24px 26px', display: 'flex', gap: 20, alignItems: 'center' }}>
        {candidate.photoUrl ? (
          <img src={candidate.photoUrl} alt={candidate.name} style={{ width: 76, height: 76, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span style={{ width: 76, height: 76, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 25, flexShrink: 0, background: COLORS.divider, color: COLORS.ink2 }}>
            {initials(candidate.name)}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: COLORS.ink }}>{candidate.name}</h1>
            {candidate.isWinner && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: COLORS.winnerText, background: COLORS.winnerBg, borderRadius: 7, padding: '4px 9px' }}>
                <Trophy size={13} strokeWidth={2.5} /> Seat won
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 9, fontSize: 14, color: COLORS.ink3, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PartyTile partyName={candidate.party} size={26} />
              {candidate.party}
            </span>
            {/* candidate.constituency already comes back as "Constituency, State" */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.muted }}>
              <MapPin size={15} color={COLORS.faintest} strokeWidth={2} /> {candidate.constituency}
            </span>
          </div>
        </div>
      </div>

      {/* Context callout */}
      {showContextCallout && total > 0 && (
        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', background: COLORS.ink, color: COLORS.divider2, borderRadius: 14, padding: '17px 20px', marginTop: 14 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.08em', color: COLORS.faintest, textTransform: 'uppercase', flexShrink: 0, marginTop: 3 }}>
            In context
          </span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{buildContextSentence(cases)}</p>
        </div>
      )}

      {/* Pending / Convicted toggle */}
      {(pendingCases.length > 0 || convictedCases.length > 0) && (
        <div style={{ display: 'flex', gap: 4, marginTop: 14, background: COLORS.divider, borderRadius: 9, padding: 3, width: 'fit-content' }}>
          {['pending', 'convicted'].map((v) => (
            <button
              key={v}
              onClick={() => setCaseView(v)}
              style={{
                fontSize: 13,
                fontWeight: caseView === v ? 600 : 500,
                padding: '6px 14px',
                borderRadius: 7,
                background: caseView === v ? COLORS.surface : 'transparent',
                color: caseView === v ? COLORS.ink : COLORS.muted,
                boxShadow: caseView === v ? '0 1px 2px rgba(20,22,30,0.06)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {v} ({v === 'pending' ? pendingCases.length : convictedCases.length})
            </button>
          ))}
        </div>
      )}

      {/* Summary tiles */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1.5fr 1fr 1fr', gap: 12, marginTop: 14 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.06em', color: COLORS.faint2, textTransform: 'uppercase' }}>Declared cases</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 13px' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: COLORS.ink }}>{total}</span>
              <span style={{ fontSize: 13, color: COLORS.faint2 }}>across {tierCount} tiers{unclassified > 0 ? ` + ${unclassified} unclear` : ''}</span>
            </div>
            <div style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', background: COLORS.divider }}>
              {[3, 4].filter((t) => cnt[t] > 0).map((t) => (
                <span key={t} style={{ display: 'block', width: `${(cnt[t] / total) * 100}%`, background: severitySolid(t) }} />
              ))}
              {unclassified > 0 && <span style={{ display: 'block', width: `${(unclassified / total) * 100}%`, background: COLORS.faintest2 }} />}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13, marginTop: 11 }}>
              {SEVERITY_TIERS_DESC.filter((t) => cnt[t] > 0).map((t) => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.ink3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: severitySolid(t) }} />
                  {cnt[t]} {severityLabel(t)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.06em', color: COLORS.faint2, textTransform: 'uppercase' }}>Highest tier</div>
            <div style={{ marginTop: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, ...severityBadgeStyle(highest) }} />
              <span style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink }}>{highest ? severityLabel(highest) : 'Not determinable'}</span>
            </div>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.06em', color: COLORS.faint2, textTransform: 'uppercase' }}>Special legislation</div>
            <div style={{ marginTop: isMobile ? 0 : 'auto', paddingTop: 14 }}>
              {specials > 0 ? (
                <SpecialLegislationChip label={`${specials} ${specials === 1 ? 'charge' : 'charges'}`} />
              ) : (
                <span style={{ fontSize: 14, color: COLORS.faint2 }}>None flagged</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offence types breakdown */}
      {total > 0 && (
        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px', color: COLORS.ink }}>Offence types</h2>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '8px 20px' }}>
            {offenceRows.map((off) => {
              const Icon = off.icon;
              return (
                <div key={off.key} style={{ display: 'grid', gridTemplateColumns: isMobile ? '22px minmax(0, 1fr) 70px 26px' : '30px minmax(0, 1fr) 150px 34px', alignItems: 'center', gap: isMobile ? 8 : 13, padding: '11px 0', borderBottom: `1px solid ${COLORS.divider2}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.muted }}>
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <span style={{ fontSize: 14, color: COLORS.ink2 }}>{off.label}</span>
                  <span style={{ height: 7, background: COLORS.divider, borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', background: COLORS.faint, borderRadius: 4, width: `${(off.count / offMax) * 100}%` }} />
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, textAlign: 'right', color: COLORS.ink }}>{off.count}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Case record (severity groups + offence filter chips) */}
      {total > 0 ? (
        <CaseRecord cases={cases} defaultCollapsed />
      ) : (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 30, textAlign: 'center', marginTop: 26 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 500, color: COLORS.winnerText }}>
            <Check size={20} strokeWidth={2.2} /> No declared {caseView} cases in this affidavit.
          </span>
        </div>
      )}

      {/* Assets & liabilities — [id].js only returns totals (no
          immovable/movable split), so the design's 3-row breakdown is
          simplified to the two totals it actually has. The *Label fields
          are already formatted (e.g. "₹2.4 Cr") server-side — used as-is
          rather than reformatting the raw rupee figures. */}
      <section style={{ marginTop: 30 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px', color: COLORS.ink }}>Assets &amp; liabilities</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.06em', color: COLORS.faint2, textTransform: 'uppercase' }}>Total assets</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 600, marginTop: 6, color: COLORS.ink }}>{candidate.totalAssetsLabel}</div>
          </div>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.06em', color: COLORS.faint2, textTransform: 'uppercase' }}>Liabilities</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 600, marginTop: 6, color: COLORS.ink }}>{candidate.totalLiabilitiesLabel}</div>
          </div>
        </div>
      </section>

      <p style={{ fontSize: 12, color: COLORS.faintest, margin: '22px 2px 0' }}>
        Figures from self-sworn election affidavits (ADR / MyNeta). Pending cases are allegations, not convictions.
      </p>
    </main>
  );
}
