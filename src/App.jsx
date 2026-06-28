import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Scale, FileText, ShieldAlert, BadgeCheck, ExternalLink, Info, Search, ArrowLeft, Loader2 } from "lucide-react";
import { classifyCase } from "./lib/classification.js";

const ALL_BUCKETS_ORDER = [
  "Murder & Attempted Murder",
  "Crime Against Women",
  "Special/Security Law",
  "Robbery & Dacoity",
  "Kidnapping & Abduction",
  "Hurt & Assault",
  "Arson & Property Destruction",
  "House-trespass / Burglary",
  "Wrongful Restraint / Confinement",
  "Unlawful Assembly & Rioting",
  "Contempt of Public Authority",
  "Criminal Intimidation & Threats",
  "Promoting Enmity / Hate Speech",
  "Corruption & Bribery",
  "Forgery & Cheating",
  "Defamation",
  "Not determinable",
];

function Spinner() {
  return <Loader2 size={18} className="animate-spin" style={{ color: "#807868" }} />;
}

function TierPill({ classification }) {
  if (classification.special) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold" style={{ background: "#2a1810", color: "#e8c468", border: "1px solid #e8c468" }}>
        <ShieldAlert size={12} /> Special legislation
      </span>
    );
  }
  if (classification.serious === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium" style={{ background: "#e7e3d8", color: "#5a5648" }}>
        Not determinable
      </span>
    );
  }
  return classification.serious ? (
    <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold" style={{ background: "#3a1f1a", color: "#e8a468", border: "1px solid #8a4a2a" }}>
      Serious
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium" style={{ background: "#1c2b28", color: "#7fc9b0", border: "1px solid #2f5248" }}>
      Non-serious
    </span>
  );
}

function CaseRow({ c, hidden }) {
  const [open, setOpen] = useState(false);
  const classification = classifyCase(c.sections, c.other);
  if (hidden) return null;

  return (
    <div style={{ borderBottom: "1px solid #3a3530" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left"
        style={{ color: "#e8e3d8" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} /> : <ChevronRight size={14} style={{ flexShrink: 0, opacity: 0.6 }} />}
          <span className="font-mono text-xs" style={{ opacity: 0.5 }}>
            #{String(c.id).padStart(3, "0")}
          </span>
          <div className="min-w-0">
            <span className="text-sm truncate block" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {classification.primaryLabel || classification.category}
            </span>
            <span className="text-[11px] block" style={{ opacity: 0.5 }}>
              {classification.offenseBucket}
              {classification.offenseSubType ? ` · ${classification.offenseSubType}` : ""}
              {c.status === "convicted" ? " · Convicted" : ""}
            </span>
          </div>
        </div>
        <TierPill classification={classification} />
      </button>
      {open && (
        <div className="pb-3 pl-7 pr-2 text-xs space-y-1.5" style={{ color: "#b8b0a0" }}>
          <div className="flex gap-2">
            <FileText size={13} style={{ flexShrink: 0, marginTop: 1, opacity: 0.6 }} />
            <span>{c.note}</span>
          </div>
          <div className="font-mono" style={{ opacity: 0.8 }}>
            IPC sections cited: {c.sections}
          </div>
          {c.other && <div style={{ opacity: 0.8 }}>Other acts: {c.other}</div>}
          <div className="flex items-center gap-1 pt-1" style={{ opacity: 0.55 }}>
            <BadgeCheck size={12} />
            <span>
              Classified by {classification.primary || "—"} · category: {classification.category}
              {classification.verified === false && " · bail status not yet verified against First Schedule"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidateId }) {
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [activeBucket, setActiveBucket] = useState(null);

  useEffect(() => {
    setCandidate(null);
    setError(null);
    fetch(`/api/candidate/${candidateId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Candidate not found");
        return res.json();
      })
      .then(setCandidate)
      .catch((e) => setError(e.message));
  }, [candidateId]);

  if (error) {
    return (
      <div className="rounded-md p-8 text-center text-sm" style={{ background: "#211d18", border: "1px solid #3a3530", color: "#807868" }}>
        {error}
      </div>
    );
  }
  if (!candidate) {
    return (
      <div className="rounded-md p-8 flex items-center justify-center gap-2" style={{ background: "#211d18", border: "1px solid #3a3530" }}>
        <Spinner /> <span className="text-sm" style={{ color: "#807868" }}>Loading candidate…</span>
      </div>
    );
  }

  const classifications = candidate.cases.map((c) => classifyCase(c.sections, c.other));
  const seriousCount = classifications.filter((c) => c.serious || c.special).length;
  const nonSeriousCount = classifications.filter((c) => c.serious === false).length;
  const unclassified = classifications.filter((c) => c.serious === null).length;

  const bucketCounts = {};
  classifications.forEach((c) => {
    bucketCounts[c.offenseBucket] = (bucketCounts[c.offenseBucket] || 0) + 1;
  });
  const presentBuckets = ALL_BUCKETS_ORDER.filter((b) => bucketCounts[b] > 0);

  return (
    <div className="rounded-md overflow-hidden" style={{ background: "#211d18", border: "1px solid #3a3530" }}>
      <div className="p-5" style={{ borderBottom: "1px solid #3a3530" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#f0ebe0" }}>
              {candidate.name}
              {candidate.isWinner && (
                <span className="ml-2 text-xs font-normal align-middle" style={{ color: "#e8c468" }}>
                  Winner
                </span>
              )}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: "#9a9285" }}>
              {candidate.party} · {candidate.constituency}
              {candidate.age ? ` · Age ${candidate.age}` : ""}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-mono" style={{ color: "#e8c468" }}>
              {candidate.totalCases}
            </div>
            <div className="text-xs" style={{ color: "#9a9285" }}>
              cases declared
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#e8a468", display: "inline-block" }} />
            <span style={{ color: "#c8c0b0" }}>{seriousCount} serious-tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#7fc9b0", display: "inline-block" }} />
            <span style={{ color: "#c8c0b0" }}>{nonSeriousCount} non-serious</span>
          </div>
          {unclassified > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#5a5648", display: "inline-block" }} />
              <span style={{ color: "#c8c0b0" }}>{unclassified} not determinable</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ borderTop: "1px solid #3a3530", color: "#9a9285" }}>
          <span className="flex items-center gap-2">
            <Scale size={13} />
            {candidate.convicted} convicted / {candidate.totalCases} filed, per self-declared affidavit
          </span>
          {candidate.totalAssetsLabel && (
            <span>Assets: {candidate.totalAssetsLabel}</span>
          )}
          {candidate.totalLiabilitiesLabel && (
            <span>Liabilities: {candidate.totalLiabilitiesLabel}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm"
        style={{ color: "#c8c0b0", background: "#241f19" }}
      >
        <span>Case ledger ({candidate.shownCases} of {candidate.totalCases} cases)</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          <div className="flex flex-wrap gap-1.5 px-5 py-3" style={{ borderBottom: "1px solid #3a3530" }}>
            <button
              onClick={() => setActiveBucket(null)}
              className="text-[11px] px-2 py-1 rounded-sm"
              style={{
                background: activeBucket === null ? "#e8c468" : "#2a251f",
                color: activeBucket === null ? "#1a1611" : "#a8a092",
              }}
            >
              All ({candidate.cases.length})
            </button>
            {presentBuckets.map((b) => (
              <button
                key={b}
                onClick={() => setActiveBucket(activeBucket === b ? null : b)}
                className="text-[11px] px-2 py-1 rounded-sm"
                style={{
                  background: activeBucket === b ? "#e8c468" : "#2a251f",
                  color: activeBucket === b ? "#1a1611" : "#a8a092",
                }}
              >
                {b} ({bucketCounts[b]})
              </button>
            ))}
          </div>
          <div className="px-5 max-h-[600px] overflow-y-auto">
            {candidate.cases.length === 0 ? (
              <p className="py-6 text-sm text-center" style={{ color: "#807868" }}>
                No cases on record for this candidate.
              </p>
            ) : (
              candidate.cases.map((c, i) => (
                <CaseRow key={`${c.status}-${c.id}`} c={c} hidden={activeBucket !== null && classifications[i].offenseBucket !== activeBucket} />
              ))
            )}
          </div>
        </>
      )}

      <div className="px-5 py-3 text-xs flex items-start gap-2" style={{ background: "#1a1611", color: "#807868" }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Source: candidate's self-declared affidavit, archived by ADR/MyNeta from the Election Commission of India.
        </span>
      </div>
    </div>
  );
}

function PartyStats({ onSelectParty }) {
  const [stats, setStats] = useState(null);
  const [source, setSource] = useState("");

  useEffect(() => {
    fetch("/api/party-stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats);
        setSource(data.source);
      });
  }, []);

  if (!stats) {
    return (
      <div className="mb-8 flex items-center gap-2 py-8 justify-center">
        <Spinner /> <span className="text-sm" style={{ color: "#807868" }}>Loading party statistics…</span>
      </div>
    );
  }

  const sorted = [...stats].sort((a, b) => b.withCases / b.total - a.withCases / a.total);

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-6 md:gap-8 justify-center md:justify-start">
        {sorted.map((p) => {
          const pct = Math.round((p.withCases / p.total) * 100);
          return (
            <button
              key={p.party}
              onClick={() => onSelectParty(p.party)}
              className="flex flex-col items-center gap-2"
              style={{ width: 92 }}
            >
              <div
                className="rounded-full flex items-center justify-center text-xs font-semibold text-center px-1 transition-transform"
                style={{
                  width: 72,
                  height: 72,
                  border: "2px solid #e8a468",
                  color: "#f0ebe0",
                  background: "#211d18",
                }}
              >
                {p.party}
              </div>
              <div className="text-lg font-mono" style={{ color: "#e8a468" }}>
                {pct}%
              </div>
              <div className="text-[10px] text-center" style={{ color: "#807868" }}>
                {p.withCases}/{p.total} candidates
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] mt-5 flex items-start gap-1.5" style={{ color: "#807868" }}>
        <ExternalLink size={11} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Source: {source} Click a party to see its candidates, highest case count first.</span>
      </p>
    </div>
  );
}

function CandidateListRow({ candidate, onSelect }) {
  return (
    <button
      onClick={() => onSelect(candidate.id)}
      className="w-full flex items-center justify-between gap-3 py-3 px-4 text-left"
      style={{ borderBottom: "1px solid #3a3530" }}
    >
      <div>
        <div style={{ color: "#f0ebe0", fontFamily: "'Source Serif 4', Georgia, serif" }}>{candidate.name}</div>
        <div className="text-xs" style={{ color: "#9a9285" }}>
          {candidate.party} · {candidate.constituency}
        </div>
      </div>
      <div className="text-right flex items-center gap-2">
        <div>
          <div className="font-mono text-lg" style={{ color: "#e8c468" }}>
            {candidate.totalCases}
          </div>
          <div className="text-[10px]" style={{ color: "#807868" }}>
            cases
          </div>
        </div>
        <ChevronRight size={16} style={{ color: "#807868" }} />
      </div>
    </button>
  );
}

function PartyLeaderboard({ party, onSelectCandidate, onBack }) {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    setMembers(null);
    fetch(`/api/by-party?name=${encodeURIComponent(party)}`)
      .then((res) => res.json())
      .then((data) => setMembers(data.results));
  }, [party]);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: "#a8a092" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-2xl mb-1" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#f0ebe0" }}>
        {party}
      </h2>
      <p className="text-sm mb-5" style={{ color: "#9a9285" }}>
        All candidates with declared cases, ranked highest to lowest by case count
        {members ? ` (${members.length} shown, capped at 200).` : "."}
      </p>
      {!members ? (
        <div className="rounded-md p-8 flex items-center justify-center gap-2" style={{ background: "#211d18", border: "1px solid #3a3530" }}>
          <Spinner /> <span className="text-sm" style={{ color: "#807868" }}>Loading…</span>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-md p-8 text-center text-sm" style={{ background: "#211d18", border: "1px solid #3a3530", color: "#807868" }}>
          No candidates found for {party}.
        </div>
      ) : (
        <div className="rounded-md overflow-hidden" style={{ background: "#211d18", border: "1px solid #3a3530" }}>
          {members.map((c) => (
            <CandidateListRow key={c.id} candidate={c} onSelect={onSelectCandidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, onSelectCandidate }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    setResults(null);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => setResults(data.results));
    }, 200); // light debounce so every keystroke doesn't fire a request
    return () => clearTimeout(handle);
  }, [query]);

  if (!results) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Spinner /> <span className="text-sm" style={{ color: "#807868" }}>Searching…</span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#9a9285" }}>
        {results.length} match{results.length === 1 ? "" : "es"} for "{query}"
      </p>
      {results.length === 0 ? (
        <div className="rounded-md p-8 text-center text-sm" style={{ background: "#211d18", border: "1px solid #3a3530", color: "#807868" }}>
          No match across the full 7,515-candidate Lok Sabha 2024 index.
        </div>
      ) : (
        <div className="rounded-md overflow-hidden" style={{ background: "#211d18", border: "1px solid #3a3530" }}>
          {results.map((c) => (
            <CandidateListRow key={c.id} candidate={c} onSelect={onSelectCandidate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BallotBrief() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("home"); // "home" | "party" | "candidate"
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  const goHome = () => {
    setView("home");
    setSelectedParty(null);
    setSelectedCandidateId(null);
    setQuery("");
  };
  const goToParty = (party) => {
    setSelectedParty(party);
    setView("party");
  };
  const goToCandidate = (id) => {
    setSelectedCandidateId(id);
    setView("candidate");
  };

  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{ background: "#16130f", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <button onClick={goHome} className="flex items-center gap-2 text-xs uppercase tracking-wider mb-3" style={{ color: "#e8c468", letterSpacing: "0.08em" }}>
            <Scale size={14} />
            Ballot Brief
          </button>
          {view === "home" && (
            <>
              <h1 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#f0ebe0" }}>
                Reading a criminal record without flattening it
              </h1>
              <p className="text-sm md:text-base max-w-2xl" style={{ color: "#a8a092", lineHeight: 1.6 }}>
                A raw case count tells you almost nothing — it can't distinguish a protest-era public-order
                charge from an attempt-to-murder count. Every case below is tagged against the CrPC's own
                bail classification and IPC chapter structure, not an invented severity scale. Click any case
                to see exactly which section drove its classification.
              </p>
            </>
          )}
        </header>

        {view === "home" && (
          <div className="relative mb-8">
            <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#807868" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a candidate, constituency, or party…"
              className="w-full py-4 pl-12 pr-4 rounded-md text-base outline-none"
              style={{ background: "#211d18", border: "1px solid #3a3530", color: "#f0ebe0" }}
            />
            <p className="text-[11px] mt-2" style={{ color: "#807868" }}>
              Searches the full Lok Sabha 2024 index — 7,515 candidates with fully analysed affidavits.
            </p>
          </div>
        )}

        {view === "home" && query.trim() === "" && <PartyStats onSelectParty={goToParty} />}
        {view === "home" && query.trim() !== "" && <SearchResults query={query} onSelectCandidate={goToCandidate} />}
        {view === "party" && <PartyLeaderboard party={selectedParty} onSelectCandidate={goToCandidate} onBack={goHome} />}
        {view === "candidate" && selectedCandidateId && (
          <div>
            <button onClick={goHome} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: "#a8a092" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <CandidateCard candidateId={selectedCandidateId} />
          </div>
        )}

        {view === "home" && (
          <footer className="mt-10 pt-6 text-xs space-y-2" style={{ borderTop: "1px solid #3a3530", color: "#807868" }}>
            <p>
              Bail status for sections marked "not yet verified" in the case detail reflects well-established
              Indian legal classification but has not been individually checked against the CrPC First Schedule
              for every section yet — that verification is an ongoing pass, tracked separately from the data itself.
            </p>
            <p className="flex items-center gap-1.5">
              <ExternalLink size={12} />
              Source data: myneta.info (ADR / National Election Watch), archiving Election Commission of India affidavits.
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
