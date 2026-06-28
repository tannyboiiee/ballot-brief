// GET /api/party-stats
// Computed live from the real candidate dataset rather than a manually
// transcribed report figure — this is the same underlying ADR/myneta source
// the rest of the site already indexes, so it can't drift out of sync with
// what candidate pages actually show.

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT party,
            COUNT(*) AS total,
            SUM(CASE WHEN criminal_case_count > 0 THEN 1 ELSE 0 END) AS with_cases
     FROM candidates
     WHERE party IS NOT NULL AND party != ''
     GROUP BY party
     HAVING total >= 10
     ORDER BY (CAST(with_cases AS REAL) / total) DESC`
  ).all();

  const stats = (rows.results || []).map((r) => ({
    party: r.party,
    withCases: r.with_cases,
    total: r.total,
  }));

  return new Response(
    JSON.stringify({
      stats,
      source:
        "Computed live from this site's own indexed Lok Sabha 2024 candidate data " +
        "(7,515 candidates with fully analysed affidavits, sourced from ADR / myneta.info). " +
        "HAVING total >= 10 excludes parties with too few candidates for the percentage to be meaningful.",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
