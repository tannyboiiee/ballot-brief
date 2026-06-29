// Maps the exact party strings stored in D1 to a symbol image in
// /public/symbols. Any party not listed here simply falls back to the
// existing text-circle badge — this list is intentionally a curated subset
// (currently the parties relevant to either the seats-won or candidate-count
// top-10 views), not an attempt at covering all ~68 qualifying parties.
//
// These are real party flags (rectangular, with the party's own background
// colors and name text), not isolated transparent icons — that's true of
// how Indian political parties actually publish their symbols, not a defect
// in these specific files. They're rendered cropped to a circle via
// object-fit: cover, similar to how country flags are commonly shown as
// circular icons elsewhere.
export const PARTY_SYMBOLS = {
  "BJP": "/symbols/bjp.png",
  "INC": "/symbols/inc.png",
  "AAP": "/symbols/aap.png",
  "BSP": "/symbols/bsp.png",
  "CPI(M)": "/symbols/cpim.png",
  "National Peoples Party": "/symbols/npp.jpg",
  "SP": "/symbols/sp.png",
  "AITC": "/symbols/aitc.png",
  "SUCI(C)": "/symbols/sucic.png",
  "Naam Tamilar Katchi": "/symbols/naam_tamilar_katchi.jpg",
  "DMK": "/symbols/dmk.png",
  "TDP": "/symbols/tdp.png",
  "JD(U)": "/symbols/jdu.png",
  "ShivSena (Uddhav Balasaheb Thackeray)": "/symbols/shivsena_ubt.jpeg",
  "Nationalist Congress Party – Sharadchandra Pawar": "/symbols/ncp_sp.jpg",
  "Shiv Sena": "/symbols/shivsena.png",
};

// Short, readable labels for display purposes only — the keys above (the
// exact D1 party strings) are what API calls/filtering still use; these are
// purely so a badge can read "BJP" rather than the full legal party name.
export const PARTY_SHORT_NAMES = {
  "National Peoples Party": "NPP",
  "ShivSena (Uddhav Balasaheb Thackeray)": "Shiv Sena (UBT)",
  "Nationalist Congress Party – Sharadchandra Pawar": "NCP (SP)",
};

export function shortPartyName(party) {
  return PARTY_SHORT_NAMES[party] || party;
}
