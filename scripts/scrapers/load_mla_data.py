"""
Ballot Brief - MLA data loader
Converts scrape_mla_affidavits.py's JSON output into a SQL file of
INSERT statements matching the `candidates` table schema, ready to run
with wrangler d1 execute.

SCOPE NOTE: this only populates the `candidates` table. The scraper does
not currently break criminal cases into individual pending_cases /
convicted_cases rows, or assets into asset_categories line items — those
tables need deeper per-row parsing that hasn't been built yet. Extend
scrape_mla_affidavits.py's parse_candidate_page() first if you want
those populated for MLAs too.

USAGE:
    python load_mla_data.py output/TamilNadu2026.json
    python load_mla_data.py output/*.json --out migrations/002_load_mla_candidates.sql

Then apply it:
    npx wrangler d1 execute <DB_NAME> --local --file=migrations/002_load_mla_candidates.sql
    (verify against local first, then re-run with --remote)
"""

import argparse
import glob
import json
import re
import sys
from pathlib import Path


def escape_sql(value) -> str:
    """Escape a value for inline SQL. Returns NULL for None/empty, otherwise
    a quoted, single-quote-escaped string."""
    if value is None or value == "":
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def parse_rupee_label(label: str) -> int | None:
    """Best-effort parse of MyNeta-style rupee labels into an integer rupee
    value. Handles: 'Rs 10,83,267 ~10 Lacs+' (real format confirmed against
    a live candidate page), 'Nil', plain '11 Crore+' / '55 Lakh+' shorthand,
    and raw comma-separated numbers. Returns None if it can't confidently
    parse — leave total_*_rupees NULL rather than guess."""
    if not label:
        return None

    label = label.strip()
    if label.lower() == "nil":
        return 0

    # "Rs 10,83,267 ~10 Lacs+" — take the exact figure before the ~ shorthand
    rs_match = re.match(r"Rs\.?\s*([\d,]+)", label, re.I)
    if rs_match:
        return int(rs_match.group(1).replace(",", ""))

    # plain number with commas, e.g. "2,50,000"
    if re.fullmatch(r"[\d,]+", label):
        return int(label.replace(",", ""))

    # "<number> Crore/Lakh/Thousand[+]" shorthand only, e.g. "11 Crore+"
    m = re.match(r"([\d.]+)\s*(Crore|Lakh|Lacs?|Thousand)", label, re.I)
    if m:
        amount = float(m.group(1))
        unit = m.group(2).lower().rstrip("s")
        multiplier = {"crore": 10_000_000, "lakh": 100_000, "lac": 100_000,
                      "thousand": 1_000}[unit]
        return int(amount * multiplier)

    return None


def candidate_to_insert_sql(c: dict) -> str:
    total_assets_rupees = parse_rupee_label(c.get("total_assets", ""))
    total_liabilities_rupees = parse_rupee_label(c.get("total_liabilities", ""))

    # is_winner isn't something the current scraper extracts (MyNeta usually
    # only marks this post-results) — default to 0/unknown rather than guess.
    is_winner = 0

    columns = [
        "candidate_id", "name", "is_winner", "party", "state", "constituency",
        "age", "photo_url", "total_assets_rupees", "total_assets_label",
        "total_liabilities_rupees", "total_liabilities_label",
        "criminal_case_count", "election_type", "election_year",
    ]
    values = [
        escape_sql(c["candidate_id"]),
        escape_sql(c.get("name")),
        is_winner,
        escape_sql(c.get("party")),
        escape_sql(c.get("state")),
        escape_sql(c.get("constituency")),
        escape_sql(c.get("age")) if not str(c.get("age", "")).isdigit() else c["age"],
        escape_sql(c.get("photo_url")),
        total_assets_rupees if total_assets_rupees is not None else "NULL",
        escape_sql(c.get("total_assets")),
        total_liabilities_rupees if total_liabilities_rupees is not None else "NULL",
        escape_sql(c.get("total_liabilities")),
        c.get("criminal_cases_declared", 0),
        escape_sql(c.get("election_type", "MLA")),
        c.get("election_year", 2026),
    ]

    col_str = ", ".join(columns)
    val_str = ", ".join(str(v) for v in values)

    # INSERT OR IGNORE so re-running this file after a partial apply doesn't
    # error out on already-inserted candidate_ids.
    return f"INSERT OR IGNORE INTO candidates ({col_str}) VALUES ({val_str});"


def pending_cases_to_insert_sql(candidate_id: str, cases: list) -> list[str]:
    statements = []
    for case in cases:
        columns = ["candidate_id", "serial_no", "fir_no", "case_no", "court",
                   "ipc_sections_applicable", "other_acts", "charges_framed",
                   "charges_framed_date", "appeal_filed", "appeal_status"]
        values = [
            escape_sql(candidate_id),
            escape_sql(case.get("serial_no")),
            escape_sql(case.get("fir_no")),
            escape_sql(case.get("case_no")),
            escape_sql(case.get("court")),
            escape_sql(case.get("ipc_sections_applicable")),
            escape_sql(case.get("other_acts")),
            escape_sql(case.get("charges_framed")),
            escape_sql(case.get("charges_framed_date")),
            escape_sql(case.get("appeal_filed")),
            escape_sql(case.get("appeal_status")),
        ]
        col_str = ", ".join(columns)
        val_str = ", ".join(str(v) for v in values)
        statements.append(f"INSERT INTO pending_cases ({col_str}) VALUES ({val_str});")
    return statements


def convicted_cases_to_insert_sql(candidate_id: str, cases: list) -> list[str]:
    statements = []
    for case in cases:
        columns = ["candidate_id", "serial_no", "case_no", "court",
                   "ipc_sections_applicable", "other_acts", "punishment_imposed",
                   "convicted_date", "appeal_filed", "appeal_status"]
        values = [
            escape_sql(candidate_id),
            escape_sql(case.get("serial_no")),
            escape_sql(case.get("case_no")),
            escape_sql(case.get("court")),
            escape_sql(case.get("ipc_sections_applicable")),
            escape_sql(case.get("other_acts")),
            escape_sql(case.get("punishment_imposed")),
            escape_sql(case.get("convicted_date")),
            escape_sql(case.get("appeal_filed")),
            escape_sql(case.get("appeal_status")),
        ]
        col_str = ", ".join(columns)
        val_str = ", ".join(str(v) for v in values)
        statements.append(f"INSERT INTO convicted_cases ({col_str}) VALUES ({val_str});")
    return statements


def ipc_bns_charges_to_insert_sql(candidate_id: str, charges: list) -> list[str]:
    statements = []
    for charge in charges:
        columns = ["candidate_id", "code_type", "section", "description", "charge_count"]
        values = [
            escape_sql(candidate_id),
            escape_sql(charge.get("code_type")),
            escape_sql(charge.get("section")),
            escape_sql(charge.get("description")),
            charge.get("charge_count", 0),
        ]
        col_str = ", ".join(columns)
        val_str = ", ".join(str(v) for v in values)
        statements.append(f"INSERT INTO ipc_bns_charges ({col_str}) VALUES ({val_str});")
    return statements


def main():
    parser = argparse.ArgumentParser(description="Convert scraper JSON to D1 SQL insert file")
    parser.add_argument("inputs", nargs="+", help="JSON file(s) from scrape_mla_affidavits.py "
                                                    "(supports globs, e.g. output/*.json)")
    parser.add_argument("--out", default="migrations/002_load_mla_candidates.sql",
                         help="Output SQL file path")
    args = parser.parse_args()

    # expand any glob patterns that the shell didn't already expand
    input_files = []
    for pattern in args.inputs:
        matched = glob.glob(pattern)
        input_files.extend(matched if matched else [pattern])

    if not input_files:
        print("No input files found.")
        sys.exit(1)

    all_statements = []
    total_candidates = 0
    all_candidate_ids = []

    for path in input_files:
        p = Path(path)
        if not p.exists():
            print(f"[warn] skipping missing file: {path}")
            continue

        with open(p, "r", encoding="utf-8") as f:
            candidates = json.load(f)

        print(f"[load] {path}: {len(candidates)} candidates")
        for c in candidates:
            cid = c["candidate_id"]
            all_candidate_ids.append(cid)
            all_statements.append(candidate_to_insert_sql(c))
            all_statements.extend(pending_cases_to_insert_sql(cid, c.get("pending_cases", [])))
            all_statements.extend(convicted_cases_to_insert_sql(cid, c.get("convicted_cases", [])))
            all_statements.extend(ipc_bns_charges_to_insert_sql(cid, c.get("ipc_bns_charges", [])))
        total_candidates += len(candidates)

    # Child tables (pending_cases, convicted_cases, ipc_bns_charges) use
    # AUTOINCREMENT ids with no natural unique key, so plain re-running this
    # file would duplicate every row. Prepend deletes scoped to just this
    # batch's candidate_ids so re-applying the file is safe — candidates
    # itself stays untouched since it uses INSERT OR IGNORE separately.
    delete_statements = []
    if all_candidate_ids:
        id_list = ", ".join(escape_sql(cid) for cid in all_candidate_ids)
        for table in ("pending_cases", "convicted_cases", "ipc_bns_charges"):
            delete_statements.append(
                f"DELETE FROM {table} WHERE candidate_id IN ({id_list});"
            )
    all_statements = delete_statements + all_statements

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- Generated by load_mla_data.py — MLA candidate inserts\n")
        f.write(f"-- {total_candidates} candidates from {len(input_files)} state file(s)\n\n")
        f.write("\n".join(all_statements))
        f.write("\n")

    print(f"\n[done] wrote {len(all_statements)} INSERT statements to {out_path}")
    print("Review the file, then apply with:")
    print(f"  npx wrangler d1 execute <DB_NAME> --local --file={out_path}")


if __name__ == "__main__":
    main()
