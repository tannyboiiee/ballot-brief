// GET /api/search?q=...
// Searches all 7,515 real candidates by name, constituency, or party.
// Returns a list shaped to match what CandidateListRow already renders.
//
// CHANGELOG: added photo_url to the SELECT and mapped it to photoUrl in the
// response — CandidateCard.jsx already renders a real photo when
// candidate.photoUrl is present, it just never received it from this
// endpoint before. No frontend change needed, this was the only gap.

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
    `SELECT candidate_id, name, party, state, constituency, criminal_case_count, photo_url
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
    photoUrl: r.photo_url || null,
  }));

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}
