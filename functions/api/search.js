// GET /api/search?q=...
// Searches all 7,515 real candidates by name, constituency, or party.
// Returns a list shaped to match what CandidateListRow already renders.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const like = `%${q}%`;
  const rows = await env.DB.prepare(
    `SELECT candidate_id, name, party, state, constituency, criminal_case_count
     FROM candidates
     WHERE name LIKE ? OR constituency LIKE ? OR party LIKE ?
     ORDER BY criminal_case_count DESC
     LIMIT 50`
  )
    .bind(like, like, like)
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
