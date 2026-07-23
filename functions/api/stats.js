// GET /api/stats?electionType=LS
// GET /api/stats?electionType=MLA&state=Tamil%20Nadu
//
// Powers the four numbers in Home.jsx's stat strip (candidates / seats /
// parties), scoped to whichever election is currently selected. Split out
// from party-stats.js deliberately — that endpoint's HAVING seats_won >= 3
// filter means summing its response would undercount parties, and it has
// no reason to compute a total candidate count at all.
//
// "seats" = COUNT(DISTINCT constituency) among winning rows for this scope,
// not a hardcoded assembly size — so it reflects what's actually loaded,
// not what the assembly nominally has. For Lok Sabha this should read 543;
// if a state's scrape is incomplete, this number will honestly show fewer
// than that state's real seat count rather than silently claiming a round
// number that isn't backed by loaded data.
//
// "parties" excludes independent-candidate labels (IND / anything ending
// in "(IND)"), same exclusion rule as party-stats.js and for the same
// reason: they aren't a single accountable party. Counted across ALL
// fielded candidates here, not seats_won >= 3 — this answers "how many
// parties contested," not "how many parties won enough seats to be
// listed on the leaderboard."
//
// Severity tiers (Grave/Serious) is NOT included here — it's a fixed
// classification constant from classification.js, not something that
// varies by election scope, so Home.jsx keeps that one hardcoded.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const electionType = url.searchParams.get("electionType") || "LS";
  const state = url.searchParams.get("state"); // only meaningful when electionType=MLA

  let whereClause = `election_type = ?1`;
  const bindings = [electionType];

  if (state) {
    whereClause += ` AND state = ?2`;
    bindings.push(state);
  }

  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) AS candidates,
       COUNT(DISTINCT CASE WHEN is_winner = 1 THEN constituency END) AS seats,
       COUNT(DISTINCT CASE
               WHEN party IS NOT NULL AND party != '' AND party != 'IND' AND party NOT LIKE '%(IND)'
               THEN party
             END) AS parties
     FROM candidates
     WHERE ${whereClause}`
  )
    .bind(...bindings)
    .first();

  return new Response(
    JSON.stringify({
      candidates: row?.candidates ?? 0,
      seats: row?.seats ?? 0,
      parties: row?.parties ?? 0,
      scope: { electionType, state: state || null },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
