// GET /api/search?q=...&electionType=LS&sortBy=cases&page=1
// GET /api/search?q=...&electionType=MLA&state=Tamil%20Nadu&sortBy=name&page=2
//
// Searches candidates by name, constituency, or party, scoped to a given
// election, with real server-side sorting and pagination.
//
// CHANGELOG (this version):
// Replaced the earlier fixed-cap approach (LIMIT 50, then LIMIT 300) with
// real pagination. Neither cap was a real fix — clicking a large party
// (Tamilaga Vettri Kazhagam, 224 candidates fielded) silently showed only
// a slice of its roster with no way to see the rest, and any fixed number
// just moves the same problem to a bigger party in a bigger state later.
// Real pagination has no upper bound on total results — every candidate is
// reachable via page/OFFSET, and sorting now happens in SQL (ORDER BY),
// not client-side in the browser, so sort order is correct across the
// FULL result set, not just whatever page happened to be loaded.
//
// sortBy is validated against a fixed allow-list (not interpolated
// directly from the query string) since D1 doesn't support parameterized
// column/direction names — an unvalidated value here would be a real SQL
// injection risk.

const PAGE_SIZE = 30;

// Every option ties-break on name — this is what makes "Winner+Name" and
// "Constituency+Name" work without needing two separate sort controls: pick
// one primary grouping, and candidates within a tied group (same winner
// status, same constituency, same case count) fall back to alphabetical
// automatically, rather than an undefined/arbitrary row order.
const SORT_OPTIONS = {
  cases: "criminal_case_count DESC, name ASC",
  winner: "is_winner DESC, name ASC",
  name: "name ASC",
  constituency: "constituency ASC, name ASC",
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const electionType = url.searchParams.get("electionType") || "LS";
  const state = url.searchParams.get("state"); // only meaningful when electionType=MLA
  const sortBy = SORT_OPTIONS[url.searchParams.get("sortBy")] ? url.searchParams.get("sortBy") : "cases";
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);

  if (!q) {
    return new Response(
      JSON.stringify({ results: [], totalMatches: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const like = `%${q}%`;
  let whereClause = `(name LIKE ?1 OR constituency LIKE ?1 OR party LIKE ?1) AND election_type = ?2`;
  const bindings = [like, electionType];

  if (state) {
    whereClause += ` AND state = ?3`;
    bindings.push(state);
  }

  const orderClause = SORT_OPTIONS[sortBy];
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(
      `SELECT candidate_id, name, party, state, constituency, criminal_case_count, photo_url, is_winner
       FROM candidates
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    )
      .bind(...bindings)
      .all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM candidates WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
  ]);

  const results = (rows.results || []).map((r) => ({
    id: r.candidate_id,
    name: r.name,
    party: r.party,
    constituency: `${r.constituency}, ${r.state}`,
    totalCases: r.criminal_case_count,
    photoUrl: r.photo_url || null,
    isWinner: !!r.is_winner,
  }));

  const totalMatches = countRow?.total ?? 0;

  return new Response(
    JSON.stringify({
      results,
      totalMatches,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(totalMatches / PAGE_SIZE)),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
