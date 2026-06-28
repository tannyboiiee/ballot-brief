// GET /api/candidate/:id
// Returns one candidate's full profile, with pending + convicted cases shaped
// to match the {id, sections, other, note} structure CaseRow/CandidateCard
// already expect — chosen deliberately so classifyCase() and the UI
// components need zero changes, only the data source does.

export async function onRequestGet({ params, env }) {
  const candidateId = params.id;

  const candidateRow = await env.DB.prepare(
    `SELECT candidate_id, name, is_winner, party, state, constituency, age,
            total_assets_rupees, total_assets_label,
            total_liabilities_rupees, total_liabilities_label,
            criminal_case_count
     FROM candidates WHERE candidate_id = ?`
  )
    .bind(candidateId)
    .first();

  if (!candidateRow) {
    return new Response(JSON.stringify({ error: "Candidate not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pendingRows = await env.DB.prepare(
    `SELECT serial_no, fir_no, case_no, court, ipc_sections_applicable,
            other_acts, charges_framed, charges_framed_date, appeal_filed, appeal_status
     FROM pending_cases WHERE candidate_id = ? ORDER BY id`
  )
    .bind(candidateId)
    .all();

  const convictedRows = await env.DB.prepare(
    `SELECT serial_no, case_no, court, ipc_sections_applicable,
            other_acts, punishment_imposed, convicted_date, appeal_filed, appeal_status
     FROM convicted_cases WHERE candidate_id = ? ORDER BY id`
  )
    .bind(candidateId)
    .all();

  const pendingCases = (pendingRows.results || []).map((r) => ({
    id: r.serial_no,
    status: "pending",
    sections: r.ipc_sections_applicable || "",
    other: r.other_acts || "",
    note: buildPendingNote(r),
  }));

  const convictedCases = (convictedRows.results || []).map((r) => ({
    id: r.serial_no,
    status: "convicted",
    sections: r.ipc_sections_applicable || "",
    other: r.other_acts || "",
    note: buildConvictedNote(r),
  }));

  const cases = [...pendingCases, ...convictedCases];

  const candidate = {
    id: candidateRow.candidate_id,
    name: candidateRow.name,
    isWinner: !!candidateRow.is_winner,
    party: candidateRow.party,
    constituency: `${candidateRow.constituency}, ${candidateRow.state}`,
    age: candidateRow.age,
    totalAssetsRupees: candidateRow.total_assets_rupees,
    totalAssetsLabel: candidateRow.total_assets_label,
    totalLiabilitiesRupees: candidateRow.total_liabilities_rupees,
    totalLiabilitiesLabel: candidateRow.total_liabilities_label,
    totalCases: candidateRow.criminal_case_count,
    shownCases: cases.length, // now the real count, not a hand-picked subset
    convicted: convictedCases.length,
    cases,
  };

  return new Response(JSON.stringify(candidate), {
    headers: { "Content-Type": "application/json" },
  });
}

function buildPendingNote(r) {
  const reference = r.fir_no || r.case_no || `Case ${r.serial_no}`;
  let status;
  if (r.charges_framed === "Yes") {
    status = `charges framed${r.charges_framed_date ? ` ${r.charges_framed_date}` : ""}`;
  } else if (/under investigation/i.test(r.other_acts || "")) {
    status = "under investigation";
  } else {
    status = "charges not yet framed";
  }
  return [reference, r.court, status].filter(Boolean).join(", ").replace(/, ([^,]+)$/, " — $1");
}

function buildConvictedNote(r) {
  const reference = r.case_no || `Case ${r.serial_no}`;
  const status = `convicted${r.convicted_date ? ` ${r.convicted_date}` : ""}${
    r.punishment_imposed ? `, ${r.punishment_imposed}` : ""
  }`;
  return [reference, r.court, status].filter(Boolean).join(", ").replace(/, ([^,]+)$/, " — $1");
}
