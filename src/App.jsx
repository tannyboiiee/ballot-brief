import { useState } from "react";
import { ChevronDown, ChevronRight, Scale, FileText, ShieldAlert, BadgeCheck, ExternalLink, Info, Search, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// IPC reference table — sourced from the CrPC First Schedule (bail/cognizance)
// and IPC chapter structure. Sections marked verified:true were checked
// directly against devgan.in's First Schedule pages during this session.
// Others reflect well-established classification but are flagged for a
// follow-up verification pass before this becomes load-bearing in product.
// ---------------------------------------------------------------------------
const IPC_REF = {
  141: { label: "Unlawful assembly", chapter: "Public Tranquility", bailable: true, years: 0.5, verified: false },
  143: { label: "Being member of unlawful assembly", chapter: "Public Tranquility", bailable: true, years: 0.5, verified: true },
  144: { label: "Joining unlawful assembly armed", chapter: "Public Tranquility", bailable: true, years: 2, verified: true },
  145: { label: "Joining assembly commanded to disperse", chapter: "Public Tranquility", bailable: true, years: 2, verified: true },
  146: { label: "Rioting (member)", chapter: "Public Tranquility", bailable: true, years: 2, verified: false },
  147: { label: "Rioting", chapter: "Public Tranquility", bailable: true, years: 2, verified: true },
  148: { label: "Rioting, armed with deadly weapon", chapter: "Public Tranquility", bailable: true, years: 3, verified: true },
  149: { label: "Common object liability", chapter: "Public Tranquility", bailable: true, years: 0, verified: true, modifier: true },
  151: { label: "Continuing assembly after dispersal order", chapter: "Public Tranquility", bailable: true, years: 0.5, verified: true },
  153: { label: "Provocation with intent to cause riot", chapter: "Public Tranquility", bailable: true, years: 1, verified: true },
  "153A": { label: "Promoting enmity between groups", chapter: "Public Tranquility", bailable: false, years: 3, verified: true },
  186: { label: "Obstructing a public servant", chapter: "Contempt of Lawful Authority", bailable: true, years: 0.25, verified: true },
  188: { label: "Disobeying a public order", chapter: "Contempt of Lawful Authority", bailable: true, years: 0.5, verified: true },
  189: { label: "Threatening a public servant", chapter: "Contempt of Lawful Authority", bailable: true, years: 2, verified: true },
  283: { label: "Obstruction in a public way", chapter: "Public Health & Safety", bailable: true, years: 0, verified: false },
  294: { label: "Obscene act in public", chapter: "Public Health & Safety", bailable: true, years: 0, verified: false },
  307: { label: "Attempt to murder", chapter: "Offences Against the Body", bailable: false, years: 10, verified: false },
  308: { label: "Attempt to commit culpable homicide", chapter: "Offences Against the Body", bailable: false, years: 7, verified: false },
  323: { label: "Voluntarily causing hurt", chapter: "Offences Against the Body", bailable: true, years: 1, verified: false },
  324: { label: "Causing hurt by dangerous weapon", chapter: "Offences Against the Body", bailable: false, years: 3, verified: false },
  326: { label: "Causing grievous hurt by dangerous weapon", chapter: "Offences Against the Body", bailable: false, years: 10, verified: false },
  332: { label: "Hurting a public servant on duty", chapter: "Offences Against the Body", bailable: true, years: 3, verified: false },
  333: { label: "Grievous hurt to a public servant on duty", chapter: "Offences Against the Body", bailable: false, years: 10, verified: false },
  341: { label: "Wrongful restraint", chapter: "Offences Against the Body", bailable: true, years: 0.1, verified: false },
  342: { label: "Wrongful confinement", chapter: "Offences Against the Body", bailable: true, years: 1, verified: false },
  353: { label: "Assault to deter a public servant", chapter: "Offences Against the Body", bailable: true, years: 2, verified: false },
  354: { label: "Assault on a woman, outraging modesty", chapter: "Offences Against the Body", bailable: false, years: 5, verified: false },
  395: { label: "Dacoity", chapter: "Offences Against Property", bailable: false, years: 10, verified: false },
  398: { label: "Armed attempt at robbery / dacoity", chapter: "Offences Against Property", bailable: false, years: 10, verified: false },
  427: { label: "Mischief causing damage", chapter: "Offences Against Property", bailable: true, years: 2, verified: false },
  435: { label: "Mischief by fire / explosive", chapter: "Offences Against Property", bailable: true, years: 2, verified: false },
  436: { label: "Mischief by fire to destroy a dwelling", chapter: "Offences Against Property", bailable: false, years: 10, verified: false },
  447: { label: "Criminal trespass", chapter: "Offences Against Property", bailable: true, years: 0.25, verified: false },
  448: { label: "House-trespass", chapter: "Offences Against Property", bailable: true, years: 1, verified: false },
  451: { label: "House-trespass to commit an offence", chapter: "Offences Against Property", bailable: true, years: 2, verified: false },
  452: { label: "House-trespass after preparation to hurt", chapter: "Offences Against Property", bailable: false, years: 7, verified: false },
  457: { label: "House-breaking by night", chapter: "Offences Against Property", bailable: false, years: 14, verified: false },
  120: { label: "Criminal conspiracy", chapter: "Criminal Conspiracy", bailable: true, years: 0.5, verified: true, modifier: true, code: "120B" },
  225: { label: "Resistance to lawful apprehension of another", chapter: "False Evidence & Public Justice", bailable: true, years: 2, verified: false },
  295: { label: "Injuring or defiling a place of worship", chapter: "Offences Relating to Religion", bailable: false, years: 2, verified: false },
  "295A": { label: "Deliberate acts to outrage religious feelings", chapter: "Offences Relating to Religion", bailable: false, years: 3, verified: false },
  302: { label: "Murder", chapter: "Offences Against the Body", bailable: false, years: 99, verified: false },
  325: { label: "Causing grievous hurt", chapter: "Offences Against the Body", bailable: true, years: 7, verified: false },
  359: { label: "Kidnapping", chapter: "Offences Against the Body", bailable: false, years: 7, verified: false },
  366: { label: "Kidnapping/abducting a woman to compel marriage", chapter: "Offences Against the Body", bailable: false, years: 10, verified: false },
  375: { label: "Rape", chapter: "Offences Against the Body", bailable: false, years: 99, verified: false },
  376: { label: "Punishment for rape", chapter: "Offences Against the Body", bailable: false, years: 99, verified: false },
  390: { label: "Robbery", chapter: "Offences Against Property", bailable: false, years: 10, verified: false },
  420: { label: "Cheating and dishonestly inducing delivery of property", chapter: "Offences Against Property", bailable: true, years: 7, verified: false },
  468: { label: "Forgery for the purpose of cheating", chapter: "Offences Against Property", bailable: false, years: 7, verified: false },
  499: { label: "Defamation", chapter: "Defamation", bailable: true, years: 2, verified: false },
  500: { label: "Punishment for defamation", chapter: "Defamation", bailable: true, years: 2, verified: false },
  "498A": { label: "Cruelty by husband or relatives", chapter: "Offences Against the Body", bailable: false, years: 3, verified: false },
  503: { label: "Criminal intimidation", chapter: "Criminal Intimidation & Insult", bailable: true, years: 2, verified: false },
  504: { label: "Intentional insult to provoke breach of the peace", chapter: "Criminal Intimidation & Insult", bailable: true, years: 2, verified: false },
  505: { label: "Statements creating or promoting enmity", chapter: "Public Tranquility", bailable: false, years: 3, verified: false },
  506: { label: "Punishment for criminal intimidation", chapter: "Criminal Intimidation & Insult", bailable: true, years: 2, verified: false },
  509: { label: "Word, gesture, or act intended to insult a woman's modesty", chapter: "Criminal Intimidation & Insult", bailable: true, years: 3, verified: false },
  34: { label: "Common intention liability", chapter: "General Exceptions", bailable: true, years: 0, verified: false, modifier: true },
  511: { label: "Attempting an offence", chapter: "General Exceptions", bailable: true, years: 0, verified: false, modifier: true },
};

const MODIFIER_CODES = new Set(["149", "34", "120B", "511"]);

const UAPA_SECTIONS = new Set(["10", "13", "17", "18", "18B", "40"]);

// ---------------------------------------------------------------------------
// Offense-type buckets — a second, independent axis from severity tier.
// Each bucket is a fixed list of IPC sections, not an invented judgment call.
// "Crime Against Women" further splits into Sexual / Non-sexual per the
// explicit rule below: 366 only counts as Sexual if the source text names
// "illicit intercourse"; otherwise it's Non-sexual (forced marriage).
// ---------------------------------------------------------------------------
const OFFENSE_BUCKETS = {
  "Murder & Attempted Murder": { sections: ["302", "303", "307", "308"] },
  "Crime Against Women": {
    sections: ["354", "354A", "354B", "354C", "354D", "375", "376", "498A", "304B", "313", "314", "366", "509"],
    sexualSections: new Set(["354", "354A", "354B", "354C", "354D", "375", "376", "509"]),
  },
  "Kidnapping & Abduction": { sections: ["359", "360", "361", "363", "364", "364A", "365", "367", "368", "369"] },
  "Robbery & Dacoity": { sections: ["390", "392", "393", "394", "395", "396", "397", "398", "399", "400", "401", "402"] },
  "Hurt & Assault": { sections: ["323", "324", "325", "326", "332", "333", "337", "338", "352", "353"] },
  "Wrongful Restraint / Confinement": { sections: ["339", "340", "341", "342", "343", "344"] },
  "Arson & Property Destruction": { sections: ["425", "426", "427", "435", "436", "440"] },
  "House-trespass / Burglary": { sections: ["441", "442", "447", "448", "449", "450", "451", "452", "454", "457"] },
  "Unlawful Assembly & Rioting": { sections: ["141", "142", "143", "144", "145", "146", "147", "148", "151"] },
  "Contempt of Public Authority": { sections: ["172", "173", "174", "175", "176", "177", "178", "179", "180", "182", "183", "184", "185", "186", "187", "188", "189", "190"] },
  "Criminal Intimidation & Threats": { sections: ["189", "190", "503", "504", "506"] },
  "Promoting Enmity / Hate Speech": { sections: ["153A", "153B", "295", "295A", "505"] },
  "Corruption & Bribery": { sections: ["161", "162", "163", "164", "165", "165A", "171E"] },
  "Forgery & Cheating": { sections: ["417", "418", "419", "420", "463", "465", "468", "471"] },
  "Defamation": { sections: ["499", "500"] },
};

function classifyOffenseType(section, otherActsText = "") {
  for (const [bucket, def] of Object.entries(OFFENSE_BUCKETS)) {
    if (def.sections.includes(section)) {
      if (bucket === "Crime Against Women") {
        if (section === "366") {
          const sexual = /illicit intercourse/i.test(otherActsText);
          return { bucket, subType: sexual ? "Sexual" : "Non-sexual" };
        }
        return { bucket, subType: def.sexualSections.has(section) ? "Sexual" : "Non-sexual" };
      }
      return { bucket, subType: null };
    }
  }
  return { bucket: "Other / Uncategorized", subType: null };
}

function parseSections(raw) {
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\(.+\)/, ""))
    .filter(Boolean);
}

function classifyCase(rawSections, otherActs = "") {
  const sections = parseSections(rawSections);
  const hasUAPA = UAPA_SECTIONS.has === undefined ? false : sections.some((s) => UAPA_SECTIONS.has(s)) || /UA Act|Unlawful Activities/i.test(otherActs);

  if (hasUAPA) {
    return { tier: "Special Legislation", serious: true, category: "Special/Security Law", offenseBucket: "Special/Security Law", offenseSubType: null, primary: "UAPA", verified: true, special: true };
  }

  const substantive = sections.filter((s) => !MODIFIER_CODES.has(s) && IPC_REF[s]);
  if (substantive.length === 0) {
    return { tier: "Unclassified", serious: null, category: "Not determinable", offenseBucket: "Not determinable", offenseSubType: null, primary: null, verified: false };
  }

  let worst = substantive[0];
  for (const s of substantive) {
    const a = IPC_REF[s];
    const b = IPC_REF[worst];
    const aScore = (a.bailable ? 0 : 1000) + a.years;
    const bScore = (b.bailable ? 0 : 1000) + b.years;
    if (aScore > bScore) worst = s;
  }

  const ref = IPC_REF[worst];
  const serious = !ref.bailable || ref.years >= 3;
  const offenseType = classifyOffenseType(worst, otherActs);
  return {
    tier: serious ? "Serious" : "Non-serious",
    serious,
    category: ref.chapter,
    offenseBucket: offenseType.bucket,
    offenseSubType: offenseType.subType,
    primary: `IPC ${worst}`,
    primaryLabel: ref.label,
    verified: ref.verified,
  };
}

// ---------------------------------------------------------------------------
// Representative case data, drawn from the candidates' actual affidavit
// case tables on MyNeta. This is a representative subset for prototyping
// the taxonomy, not the full case list — Surendran's affidavit lists 243
// cases and Suguna's lists 49; see footer note.
// ---------------------------------------------------------------------------
const CANDIDATES = [
  {
    id: "surendran",
    name: "K Surendran",
    party: "BJP",
    constituency: "Wayanad, Kerala",
    totalCases: 243,
    shownCases: 14,
    convicted: 0,
    cases: [
      { id: 1, sections: "171E, 171F, 201, 511, 204, 175, 120B, 34", other: "", note: "FIR 392/2021, Sulthan Bathery — under investigation" },
      { id: 2, sections: "171E, 171B, 201, 506(i), 342, 34", other: "SC/ST (Prevention of Atrocities) Act 3(1)(1)B, 3(2)(Va)", note: "FIR 193/2021, Kasargod" },
      { id: 27, sections: "143, 147, 148, 149, 332, 333, 308", other: "", note: "FIR 23/2019, Koipuram — under investigation" },
      { id: 13, sections: "143, 147, 451, 427, 153, 149", other: "", note: "FIR 31/2019, Adoor — under investigation" },
      { id: 31, sections: "341, 323, 427, 111, 113, 34", other: "", note: "CC 362/2022, Chenganur" },
      { id: 45, sections: "143, 147, 149, 283", other: "Section 4(3) Public Ways Restriction Act, 2011", note: "FIR 21/2019, Punalur" },
      { id: 110, sections: "143, 144, 147, 148, 341, 294b, 323, 324, 326, 307, 149", other: "", note: "FIR 13/2019, Anchalumoodu — under investigation" },
      { id: 121, sections: "143, 144, 147, 148, 353, 332, 307, 149", other: "Section 3(2)(a) PDPP Act", note: "FIR 12/2019, Kollam West" },
      { id: 165, sections: "341, 323, 324, 427, 308, 34", other: "", note: "FIR 8/2019, Manjeshwar — under investigation" },
      { id: 177, sections: "143, 144, 147, 148, 353, 332, 188, 283, 307, 149", other: "Section 27 of Arms Act", note: "FIR 8/2019, Karunagapally" },
      { id: 182, sections: "143, 147, 148, 149, 324, 354, 506(ii), 452, 427", other: "", note: "FIR 7/2019, Mavelikara — under investigation" },
      { id: 213, sections: "143, 147, 148, 341, 323, 324, 307, 153A, 427, 295, 212, 149", other: "", note: "FIR 4/2019, Manjeshwar — under investigation" },
      { id: 230, sections: "143, 147, 148, 149, 283, 294b, 188, 332, 353", other: "Section 117(e) Kerala Police Act, 3(2) PDPP Act", note: "CC 2234/2017, Thiruvananthapuram" },
      { id: 243, sections: "143, 147, 188, 283, 149", other: "", note: "CC 1007/2017, Manjeri" },
    ],
  },
  {
    id: "suguna",
    name: "Athram Suguna",
    party: "INC",
    constituency: "Adilabad (ST), Telangana",
    totalCases: 49,
    shownCases: 12,
    convicted: 0,
    cases: [
      { id: 1, sections: "120B", other: "Sec 10, 13, 17, 18, 18(B), 40, 8(1)(II) UA Act, TSPSA", note: "CR 169/20, Thdvai — special legislation cited" },
      { id: 13, sections: "120B, 147, 148, 324, 307, 505(2), 34", other: "", note: "CR 281/17, Utnoor — summons not yet served" },
      { id: 26, sections: "395, 398, 120B, 188, 427", other: "", note: "CR 267/17, Utnoor — summons not yet served" },
      { id: 28, sections: "447, 448, 427, 307, 120B, 188", other: "", note: "CR 265/17, Utnoor — summons not yet served" },
      { id: 41, sections: "457, 380, 435, 120B, 188", other: "", note: "CR 252/17, Utnoor — summons not yet served" },
      { id: 14, sections: "144, 147, 148, 427, 436, 395, 120B, 188, 149", other: "", note: "CR 279/17, Utnoor — summons not yet served" },
      { id: 45, sections: "147, 188, 353, 427, 120B, 307, 153A", other: "Section 3 PDPP Act", note: "CR 247/17, Utnoor — summons not yet served" },
      { id: 2, sections: "384, 294B, 506, 34", other: "", note: "CC 31/2020, Utnoor" },
      { id: 4, sections: "147, 353, 448, 341, 149", other: "", note: "CC 481/2021, Utnoor" },
      { id: 9, sections: "147, 148, 448, 427, 324, 436, 188, 149", other: "", note: "CR 293/17, Utnoor — summons not yet served" },
      { id: 48, sections: "188, 34", other: "", note: "CC 32/2020, Utnoor" },
      { id: 6, sections: "188, 143, 341, 186, 290, 149", other: "", note: "CC 306/2021, Utnoor" },
    ],
  },
  {
    id: "majumdar",
    name: "Sukanta Majumdar",
    party: "BJP",
    constituency: "Balurghat, West Bengal",
    totalCases: 16,
    shownCases: 9,
    convicted: 0,
    cases: [
      { id: 3, sections: "143, 341, 323, 506, 509", other: "", note: "GR 428/2022, Balurghat — pending" },
      { id: 1, sections: "143, 447, 427, 323, 506, 186, 188, 189, 353", other: "Section 8B National Highway Act, PDPP Act", note: "GR 422/2022, Balurghat — pending" },
      { id: 10, sections: "147, 148, 149, 186, 188, 332, 353, 325, 326, 307", other: "PDBP Act, NH Act, MPO Act", note: "GR 457/2019, Gangarampur — pending" },
      { id: 16, sections: "147, 148, 149, 186, 188, 189, 332, 333, 353, 323, 325, 308, 427, 34", other: "Prevention of Damage to Public Property Act", note: "GR 498/2024, Bashirhat — pending" },
      { id: 8, sections: "120B, 153A, 295A, 420, 468, 504, 505(2)", other: "", note: "GR 72/2023, Beliaghata — pending" },
      { id: 7, sections: "499, 500", other: "", note: "CR 3451/22, Alipore — defamation complaint, pending" },
      { id: 2, sections: "171F, 188", other: "Section 130 Representation of the People Act", note: "GR 437/2022, Balurghat — pending" },
      { id: 5, sections: "186, 353, 332, 427, 34", other: "", note: "GR 1371/2023, Tapan — pending" },
      { id: 11, sections: "143, 188", other: "Section 32 Police Act", note: "GR 402/2019, Itahar — pending" },
    ],
  },
];

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

// ---------------------------------------------------------------------------
// Party-level statistics — sourced directly from ADR's own published
// consolidated report (Lok Sabha 2024, Phases 1-7), not computed from the
// 3-candidate demo sample below. The sample exists to stress-test the
// severity/offense-type taxonomy and is nowhere near large enough, or
// neutrally selected enough, to support a percentage claim on its own.
// ---------------------------------------------------------------------------
const PARTY_STATS = [
  { party: "CPI(M)", withCases: 33, total: 52 },
  { party: "INC", withCases: 143, total: 327 },
  { party: "BJP", withCases: 191, total: 440 },
  { party: "BSP", withCases: 63, total: 487 },
  { party: "Independents", withCases: 550, total: 3903 },
];
const PARTY_STATS_SOURCE =
  "ADR / National Election Watch, consolidated analysis of Lok Sabha 2024 candidates, Phases 1–7 (8,337 of 8,360 candidates analysed).";

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

function CandidateCard({ candidate }) {
  const [expanded, setExpanded] = useState(true);
  const [activeBucket, setActiveBucket] = useState(null);
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
            </h3>
            <p className="text-sm mt-0.5" style={{ color: "#9a9285" }}>
              {candidate.party} · {candidate.constituency}
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

        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#e8a468", display: "inline-block" }} />
            <span style={{ color: "#c8c0b0" }}>
              {seriousCount} serious-tier (of {candidate.shownCases} shown)
            </span>
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

        <div className="mt-3 pt-3 flex items-center gap-2 text-xs" style={{ borderTop: "1px solid #3a3530", color: "#9a9285" }}>
          <Scale size={13} />
          <span>
            {candidate.convicted} convicted / {candidate.totalCases} filed — all cases shown are pending, per self-declared affidavit
          </span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm"
        style={{ color: "#c8c0b0", background: "#241f19" }}
      >
        <span>Case ledger (representative sample — {candidate.shownCases} of {candidate.totalCases})</span>
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
          <div className="px-5">
            {candidate.cases.map((c, i) => (
              <CaseRow key={c.id} c={c} hidden={activeBucket !== null && classifications[i].offenseBucket !== activeBucket} />
            ))}
          </div>
        </>
      )}

      <div className="px-5 py-3 text-xs flex items-start gap-2" style={{ background: "#1a1611", color: "#807868" }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Source: candidate's self-declared affidavit, archived by ADR/MyNeta from the Election Commission of India.
          Showing a representative subset, not the full case list — see footer.
        </span>
      </div>
    </div>
  );
}

function PartyStats({ onSelectParty }) {
  const sorted = [...PARTY_STATS].sort((a, b) => b.withCases / b.total - a.withCases / a.total);

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
        <span>
          Source: {PARTY_STATS_SOURCE} These figures are not derived from the demo candidates below — that
          set is for taxonomy testing only and is far too small, and not neutrally sampled, to support a
          percentage claim. Click a party to see which demo candidates belong to it.
        </span>
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
  const members = CANDIDATES.filter((c) => c.party === party).sort((a, b) => b.totalCases - a.totalCases);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: "#a8a092" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-2xl mb-1" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#f0ebe0" }}>
        {party}
      </h2>
      <p className="text-sm mb-5" style={{ color: "#9a9285" }}>
        Demo candidates with declared cases, ranked highest to lowest by case count.
      </p>
      {members.length === 0 ? (
        <div className="rounded-md p-8 text-center text-sm" style={{ background: "#211d18", border: "1px solid #3a3530", color: "#807868" }}>
          No {party} candidates in the current demo set yet — this build only includes 3 candidates total,
          added to stress-test the classification logic, not to cover every party.
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
  const q = query.trim().toLowerCase();
  const results = CANDIDATES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.constituency.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)
  ).sort((a, b) => b.totalCases - a.totalCases);

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "#9a9285" }}>
        {results.length} match{results.length === 1 ? "" : "es"} in the demo set for "{query}"
      </p>
      {results.length === 0 ? (
        <div className="rounded-md p-8 text-center text-sm" style={{ background: "#211d18", border: "1px solid #3a3530", color: "#807868" }}>
          No match. This demo only indexes 3 candidates — try "Surendran," "Suguna," or "Majumdar."
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

  const selectedCandidate = CANDIDATES.find((c) => c.id === selectedCandidateId);

  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{ background: "#16130f", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <button onClick={goHome} className="flex items-center gap-2 text-xs uppercase tracking-wider mb-3" style={{ color: "#e8c468", letterSpacing: "0.08em" }}>
            <Scale size={14} />
            Ballot Brief — severity taxonomy prototype
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
              Searches the {CANDIDATES.length}-candidate demo set used to test this taxonomy — not a full Lok
              Sabha 2024 index yet.
            </p>
          </div>
        )}

        {view === "home" && query.trim() === "" && <PartyStats onSelectParty={goToParty} />}
        {view === "home" && query.trim() !== "" && <SearchResults query={query} onSelectCandidate={goToCandidate} />}
        {view === "party" && <PartyLeaderboard party={selectedParty} onSelectCandidate={goToCandidate} onBack={goHome} />}
        {view === "candidate" && selectedCandidate && (
          <div>
            <button onClick={goHome} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: "#a8a092" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <CandidateCard candidate={selectedCandidate} />
            </div>
          </div>
        )}

        {view === "home" && (
        <footer className="mt-10 pt-6 text-xs space-y-2" style={{ borderTop: "1px solid #3a3530", color: "#807868" }}>
          <p>
            <strong style={{ color: "#a8a092" }}>This is a working prototype, not the finished tool.</strong>{" "}
            The case data shown is a hand-picked representative sample — 14 of Surendran's 243 cases, 12 of
            Suguna's 49, 9 of Majumdar's 16 — pulled directly from each candidate's MyNeta affidavit page.
            It is not the full dataset and not a random sample; it exists to pressure-test the classification
            logic across a range of severity and offense types, not to characterize any candidate's full record.
          </p>
          <p>
            <strong style={{ color: "#a8a092" }}>On the third candidate:</strong> Majumdar was added to exercise
            the Crime Against Women / Sexual sub-classification, which neither of the first two candidates'
            sampled cases triggered. He was found by continuing the same systematic method used throughout
            this build — the next page of MyNeta's own criminal-case-sorted list, first matching row — not by
            searching for a candidate with a specific allegation type. The offense-type taxonomy is applied
            identically regardless of party; this build currently includes 2 BJP candidates and 1 INC candidate
            only because of where they fell in that list.
          </p>
          <p>
            Bail status for sections marked "not yet verified" in the case detail reflects well-established
            Indian legal classification but has not been individually checked against the CrPC First Schedule
            in this build pass — that verification is a known next step before this logic ships in a real tool.
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
