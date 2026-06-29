import { useState, useMemo } from 'react';
import { COLORS, FONT_MONO, severityLabel, severityDesc, severityBadgeStyle } from '../lib/designTokens';
import { SpecialLegislationChip } from './SeverityBadge';
import { getOffenceBucketDisplay, buildOffenceFilterOptions } from '../lib/offenceBuckets';
import OffenceFilterChips from './OffenceFilterChips';

const SHOWN_INITIAL = 8;
const SHOWN_INCREMENT = 25;
const TIERS_DESC = [4, 3];

// `cases` are expected to already be run through classifyAndAttach() from
// lib/severity.js, i.e. each one carries:
//   { id, note, sections (raw), other, numericTier (3, 4, or null),
//     offenseBucket, special, primary, primaryLabel, category, verified }
// `numericTier === null` means classifyCase() returned "Unclassified" — no
// substantive IPC section matched. Those render in their own "Not
// determinable" group, outside the Serious/Grave ramp (never folded in).
export default function CaseRecord({ cases, defaultCollapsed = true }) {
  const [activeBucket, setActiveBucket] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [shown, setShown] = useState({});

  const filterOptions = useMemo(() => buildOffenceFilterOptions(cases), [cases]);

  const filteredCases = useMemo(() => {
    if (activeBucket === 'all') return cases;
    return cases.filter((c) => (c.offenseBucket || 'Not determinable') === activeBucket);
  }, [cases, activeBucket]);

  const groups = useMemo(() => {
    const byTier = { 3: [], 4: [], unclassified: [] };
    for (const c of filteredCases) {
      if (c.numericTier === null || c.numericTier === undefined) byTier.unclassified.push(c);
      else byTier[c.numericTier]?.push(c);
    }
    return byTier;
  }, [filteredCases]);

  const toggleGroup = (key) => {
    setExpanded((s) => ({ ...s, [key]: !(key in s ? s[key] : !defaultCollapsed) }));
  };

  const showMore = (key) => {
    setShown((s) => ({ ...s, [key]: (s[key] || SHOWN_INITIAL) + SHOWN_INCREMENT }));
  };

  const renderGroup = (key, label, desc, badgeStyle) => {
    const all = groups[key];
    if (all.length === 0) return null;
    const isOpen = key in expanded ? expanded[key] : !defaultCollapsed;
    const shownN = shown[key] || SHOWN_INITIAL;
    const visible = isOpen ? all.slice(0, shownN) : [];
    const remaining = Math.max(0, all.length - shownN);

    return (
      <div key={key} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <button onClick={() => toggleGroup(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', textAlign: 'left' }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              ...badgeStyle,
            }}
          />
          <span style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: COLORS.ink }}>{label}</span>
            <span style={{ fontSize: 12.5, color: COLORS.faint2, marginLeft: 9 }}>{desc}</span>
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: COLORS.ink3 }}>
            {all.length} {all.length === 1 ? 'case' : 'cases'}
          </span>
          <span style={{ color: COLORS.faintest2, fontSize: 13, width: 14, textAlign: 'center' }}>{isOpen ? '▾' : '▸'}</span>
        </button>

        {isOpen && (
          <div style={{ borderTop: `1px solid ${COLORS.divider}` }}>
            {visible.map((c, i) => {
              const Icon = getOffenceBucketDisplay(c.offenseBucket).icon;
              const title = c.primaryLabel || c.note || c.offenseBucket;
              const hasOtherActs = c.other && !/^\s*$/.test(c.other);
              return (
                <div key={c.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '15px 18px', borderBottom: `1px solid ${COLORS.divider3}` }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.faintest2, flexShrink: 0, marginTop: 3, width: 28 }}>
                    #{String(i + 1).padStart(3, '0')}
                  </span>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: COLORS.divider2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Icon size={15} color={COLORS.muted} strokeWidth={1.8} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 500, color: COLORS.ink }}>{title}</span>
                      {c.special && <SpecialLegislationChip label={c.special} small />}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.faint2, marginTop: 2, marginBottom: 9 }}>{c.offenseBucket}</div>

                    {/* case reference + status — the same note text [id].js builds server-side */}
                    {c.note && (
                      <div style={{ fontSize: 13, color: COLORS.ink3, marginBottom: 4 }}>{c.note}</div>
                    )}
                    {/* raw sections, not just the worst/classified one */}
                    {c.sections && (
                      <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 4 }}>
                        IPC sections cited: <span style={{ fontFamily: FONT_MONO, color: COLORS.ink3 }}>{c.sections}</span>
                      </div>
                    )}
                    {hasOtherActs && (
                      <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 4 }}>Other acts: {c.other}</div>
                    )}
                    {/* classification transparency line — mirrors the old UI's
                        "Classified by ... · category: ... · bail status..." footer */}
                    <div style={{ fontSize: 11.5, color: COLORS.faintest2, marginTop: 6 }}>
                      {c.primary ? (
                        <>
                          Classified by {c.primary} · category: {c.category || '—'} ·{' '}
                          {c.verified ? 'verified against First Schedule' : 'bail status not yet verified against First Schedule'}
                        </>
                      ) : (
                        'No IPC section could be matched — category not determinable'
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {remaining > 0 && (
              <button onClick={() => showMore(key)} style={{ width: '100%', padding: 12, fontSize: 13, fontWeight: 500, color: COLORS.ink3 }}>
                Show {Math.min(SHOWN_INCREMENT, remaining)} more of {all.length}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: COLORS.ink }}>Case record</h2>
        <span style={{ fontSize: 12.5, color: COLORS.faint2 }}>Grouped by severity · most serious first</span>
      </div>

      <OffenceFilterChips options={filterOptions} active={activeBucket} onChange={setActiveBucket} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TIERS_DESC.map((t) => renderGroup(t, severityLabel(t), severityDesc(t), severityBadgeStyle(t)))}
        {renderGroup('unclassified', 'Not determinable', 'No IPC section could be matched to a clear severity tier', {
          background: COLORS.divider,
          color: COLORS.muted,
        })}
        {filteredCases.length === 0 && (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: COLORS.faint2, fontSize: 14 }}>No cases in this category.</div>
        )}
      </div>
    </section>
  );
}
