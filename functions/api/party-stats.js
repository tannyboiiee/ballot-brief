// GET /api/party-stats?electionType=LS
// GET /api/party-stats?electionType=MLA&state=Tamil%20Nadu
//
// Computed live from the real candidate dataset rather than a manually
// transcribed report figure — this is the same underlying ADR/myneta source
// the rest of the site already indexes, so it can't drift out of sync with
// what candidate pages actually show.
//
// CHANGELOG (this version):
// 1. Excludes independent-candidate "party" labels (IND, Independent(IND),
//    etc.) — these aren't a real party with shared accountability, they're
//    a catch-all bucket for thousands of unrelated individuals. Confirmed
//    via a real data check that a plain LIKE '%Independent%' would be too
//    broad (would wrongly exclude genuine registered parties whose names
//    happen to contain the word "Independent"). Pattern used: exactly
//    "IND", or anything ending in "(IND)".
// 2. Case rate is now computed AMONG WINNERS ONLY (is_winner=1), not across
//    a party's whole fielded candidate pool. Confirmed via a real query
//    that these give meaningfully different numbers — BJP's fielded-pool
//    rate was 43%, but only 38.8% of its actual 219 winning MPs have a
//    declared case. The winners-only number is what "criminals in parties
//    by seats won" as a heading actually implies, and it's the more
//    accountability-relevant question (who's actually in power with a
//    record, not what the average candidate looked like).
// 3. Because the percentage's real sample size is now seats_won, not total
//    candidates fielded, the HAVING threshold moved from "10+ candidates
//    fielded" to "seats_won >= 3" — a party that fielded 500 candidates but
//    won 2 seats has a winners-based rate built on just 2 data points,
//    regardless of how many they fielded. 3 is a starting point picked to
//    land in a similar range to the old threshold's LS result (10th-12th
//    parties there had 7/4/3 seats won) — adjust if it doesn't feel right
//    once you see it against real Tamil Nadu numbers, which have a much
//    flatter seat distribution than LS.
// 4. Added election_type + state scoping via query params, so this can be
//    called separately for Lok Sabha vs any given state assembly without
//    aggregating two different elections' candidates into one ranking.

const MIN_SEATS_WON = 3;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const electionType = url.searchParams.get("electionType") || "LS";
  const state = url.searchParams.get("state"); // only meaningful when electionType=MLA

  let whereClause = `
    party IS NOT NULL AND party != ''
    AND party != 'IND'
    AND party NOT LIKE '%(IND)'
    AND election_type = ?1
  `;
  const bindings = [electionType];

  if (state) {
    whereClause += ` AND state = ?2`;
    bindings.push(state);
  }

  const rows = await env.DB.prepare(
    `SELECT party,
            SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) AS seats_won,
            SUM(CASE WHEN is_winner = 1 AND criminal_case_count > 0 THEN 1 ELSE 0 END)
              AS winners_with_cases,
            COUNT(*) AS total_fielded
     FROM candidates
     WHERE ${whereClause}
     GROUP BY party
     HAVING seats_won >= ${MIN_SEATS_WON}
     ORDER BY (CAST(winners_with_cases AS REAL) / seats_won) DESC`
  )
    .bind(...bindings)
    .all();

  const stats = (rows.results || []).map((r) => ({
    party: r.party,
    seatsWon: r.seats_won,
    winnersWithCases: r.winners_with_cases,
    totalFielded: r.total_fielded,
    // caseRate is now "% of this party's WINNERS with a declared case",
    // not "% of everyone they fielded" — matches the heading's actual claim
    caseRatePct: r.seats_won > 0 ? Math.round((r.winners_with_cases / r.seats_won) * 100) : 0,
  }));

  return new Response(
    JSON.stringify({
      stats,
      scope: { electionType, state: state || null },
      source:
        "Computed live from this site's own indexed candidate data (sourced from ADR / myneta.info). " +
        `Case rate = share of a party's actual WINNERS (seats_won >= ${MIN_SEATS_WON}) with at least one ` +
        "declared criminal case — not the party's whole fielded candidate pool. Independent candidates " +
        "are excluded entirely, since they aren't a single party with shared accountability.",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
