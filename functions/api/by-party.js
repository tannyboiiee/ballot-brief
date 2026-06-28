// GET /api/by-party?name=BJP
// Exact party match (not a substring search like /api/search), since a
// leaderboard needs every candidate of that party, not just the top matches
// across name/constituency/party generally.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const party = (url.searchParams.get("name") || "").trim();

  if (!party) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await env.DB.prepare(
    `SELECT candidate_id, name, party, state, constituency, criminal_case_count
     FROM candidates
     WHERE party = ?
     ORDER BY criminal_case_count DESC
     LIMIT 200`
  )
    .bind(party)
    .all();

  const results = (rows.results || []).map((r) => ({
    id: r.candidate_id,
    name: r.name,
    party: r.party,
    constituency: `${r.constituency}, ${r.state}`,
    totalCases: r.criminal_case_count,
  }));

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}
