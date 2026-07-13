"""
Ballot Brief - MLA Affidavit Scraper
Scrapes candidate affidavit data (criminal cases, assets, education) from
MyNeta.info for the 2026 state assembly elections: Tamil Nadu, West Bengal,
Kerala, Assam, Puducherry.

Reuses the same source (ADR/MyNeta) and page structure as the Lok Sabha
pipeline, just pointed at state assembly year-keys instead of ls2024.

USAGE:
    pip install requests beautifulsoup4 lxml
    python scrape_mla_affidavits.py --state TamilNadu2026
    python scrape_mla_affidavits.py --all          # runs all 5 states
    python scrape_mla_affidavits.py --state TamilNadu2026 --test-one 2070

NOTES / THINGS TO VERIFY BEFORE A FULL RUN:
    - This was written without live access to myneta.info's current HTML
      (sandboxed network in this session). Run --test-one against a known
      candidate_id first and eyeball the printed output before scraping
      thousands of pages. If field extraction looks wrong, the CSS
      selectors in `parse_candidate_page()` are the place to fix it —
      look for the actual table/div structure in browser devtools and
      adjust the selectors there.
    - Rate limited to ~1 request/1.5s by default. Don't lower this much;
      it's someone else's (non-profit) server, not a CDN.
    - Resumable: already-fetched candidate_ids are skipped on re-run.
    - Output: one CSV + one JSON per state in ./output/
"""

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path
from dataclasses import dataclass, asdict, field

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://www.myneta.info"

STATE_YEARKEYS = {
    "TamilNadu2026": {"state": "Tamil Nadu", "seats_hint": 234},
    "WestBengal2026": {"state": "West Bengal", "seats_hint": 294},
    "Kerala2026": {"state": "Kerala", "seats_hint": 140},
    "Assam2026": {"state": "Assam", "seats_hint": 126},
    "Puducherry2026": {"state": "Puducherry", "seats_hint": 30},
}

REQUEST_DELAY_SECONDS = 1.5
REQUEST_TIMEOUT = 20
MAX_RETRIES = 3
RETRY_BACKOFF = 5

HEADERS = {
    "User-Agent": "BallotBrief-Research/1.0 (civic-tech, non-commercial; contact: <your email>)",
}

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    candidate_id: str          # NAMESPACED, e.g. "TamilNadu2026-2070" — never the raw MyNeta id.
                                # raw MyNeta candidate_ids reset per state-year, so using them bare
                                # risks silently colliding with/overwriting existing LS rows that
                                # happen to share the same number.
    raw_myneta_id: str         # original numeric id from the URL, kept for reference/debugging
    yearkey: str
    state: str
    election_type: str = "MLA"     # 'LS' | 'MLA' — lets queries filter MPs vs MLAs
    election_year: int = 2026
    name: str = ""
    party: str = ""
    constituency: str = ""
    criminal_cases_declared: int = 0
    criminal_case_sections: list = field(default_factory=list)  # raw IPC/BNS section strings
    total_assets: str = ""
    total_liabilities: str = ""
    education: str = ""
    age: str = ""
    source_url: str = ""
    photo_url: str = ""
    pending_cases: list = field(default_factory=list)      # list of dicts, maps to pending_cases table
    convicted_cases: list = field(default_factory=list)    # list of dicts, maps to convicted_cases table
    ipc_bns_charges: list = field(default_factory=list)    # list of dicts, maps to ipc_bns_charges table



# ---------------------------------------------------------------------------
# HTTP helper with retry/backoff
# ---------------------------------------------------------------------------

def fetch(url: str) -> requests.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                return resp
            print(f"  [warn] {resp.status_code} for {url} (attempt {attempt})")
        except requests.RequestException as e:
            print(f"  [warn] request failed: {e} (attempt {attempt})")
        time.sleep(RETRY_BACKOFF * attempt)
    print(f"  [error] giving up on {url}")
    return None


# ---------------------------------------------------------------------------
# Step 1: enumerate candidate IDs for a state election
# ---------------------------------------------------------------------------

def get_candidate_ids(yearkey: str) -> list[tuple[str, str]]:
    """
    Returns list of (candidate_id, constituency) tuples for a given
    state-year key, by walking the summary/candidates_analyzed page(s).

    MyNeta's summary listing is typically paginated. We follow numbered
    pages until we stop finding new candidate links.
    """
    candidate_ids = []
    seen_ids = set()
    page = 1

    while True:
        # NOTE: exact query params may need adjustment — verify against
        # a real page load. This mirrors the pattern used for LS summary
        # pages (action=summary&subAction=candidates_analyzed).
        url = (
            f"{BASE_URL}/{yearkey}/index.php"
            f"?action=summary&subAction=candidates_analyzed&sort=candidate&pageno={page}"
        )
        print(f"[list] fetching page {page}: {url}")
        resp = fetch(url)
        if resp is None:
            break

        soup = BeautifulSoup(resp.text, "lxml")
        links = soup.select("a[href*='candidate.php?candidate_id=']")

        new_this_page = 0
        for a in links:
            m = re.search(r"candidate_id=(\d+)", a.get("href", ""))
            if not m:
                continue
            cid = m.group(1)
            if cid in seen_ids:
                continue
            seen_ids.add(cid)

            # try to grab constituency from the same table row
            constituency = ""
            row = a.find_parent("tr")
            if row:
                cells = row.find_all("td")
                if len(cells) > 1:
                    constituency = cells[1].get_text(strip=True)

            candidate_ids.append((cid, constituency))
            new_this_page += 1

        print(f"  found {new_this_page} new candidates (total so far: {len(candidate_ids)})")

        if new_this_page == 0:
            break

        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)

        # safety valve — no state should have more than ~40 pages at
        # reasonable page sizes; bail rather than loop forever if the
        # pagination param isn't actually working.
        if page > 60:
            print("  [warn] hit page safety limit, stopping enumeration")
            break

    return candidate_ids


def find_table_after_heading(soup: BeautifulSoup, heading_pattern: str):
    """Find a heading-ish element whose text matches heading_pattern, then
    return the next <table> encountered after it in document order."""
    heading = soup.find(string=re.compile(heading_pattern, re.I))
    if not heading:
        return None
    node = heading if hasattr(heading, "find_next") else heading.find_parent()
    if node is None:
        return None
    return node.find_next("table")


def parse_table_rows(table) -> list[list[str]]:
    """Return each row of a <table> as a list of cell texts, dropping a
    leading header row if one is detected (contains 'Serial No')."""
    if table is None:
        return []
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
    if rows and any("Serial No" in cell for cell in rows[0]):
        rows = rows[1:]
    return rows


def is_empty_case_row(row: list[str]) -> bool:
    joined = " ".join(row)
    return (not row) or ("No Cases" in joined) or (joined.strip() == "")


def fix_known_typos(text: str) -> str:
    """MyNeta's underlying affidavit transcriptions occasionally have typos
    in the word 'Section' (e.g. 'Sectioin', 'Sectioni') — confirmed on a
    real candidate page. This corrects only these specific, observed
    misspellings; it does not touch case numbers, dates, or any other
    substantive content, since those should be preserved verbatim even if
    the source has an error."""
    if not text:
        return text
    for typo in ("Sectioin", "Sectioni", "Sectoin"):
        text = re.sub(typo, "Section", text, flags=re.I)
    return text


# ---------------------------------------------------------------------------
# Step 2b: parse an individual candidate affidavit page
# ---------------------------------------------------------------------------

def parse_candidate_page(html: str, raw_id: str, yearkey: str, state: str, url: str,
                          constituency_hint: str = "") -> Candidate:
    soup = BeautifulSoup(html, "lxml")

    namespaced_id = f"{yearkey}-{raw_id}"
    year_match = re.search(r"(\d{4})$", yearkey)
    election_year = int(year_match.group(1)) if year_match else 2026

    c = Candidate(candidate_id=namespaced_id, raw_myneta_id=raw_id, yearkey=yearkey, state=state,
                  election_type="MLA", election_year=election_year,
                  source_url=url, constituency=constituency_hint)

    # Flattened, whitespace-normalized full page text. Verified against a real
    # candidate page — MyNeta's fields here are inline text ("Age: 45",
    # "Assets: Rs 10,83,267 ~10 Lacs+"), not clean <tr><td> pairs, so regexing
    # the flat text is more reliable than table-row lookups.
    text = soup.get_text(" ", strip=True)

    # --- Name / party / constituency from the page title ---
    # Title format: "NAME(PARTY):Constituency- CONSTITUENCY(DISTRICT) - Affidavit
    # Information of Candidate:" — the trailing " - Affidavit Information..."
    # needs stripping off the constituency capture.
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        name_match = re.match(r"^(.*?)\((.*?)\):Constituency-\s*(.*)$", title_text)
        if name_match:
            c.name = name_match.group(1).strip()
            c.party = name_match.group(2).strip()
            constituency_raw = re.split(r"\s*-\s*Affidavit Information of Candidate",
                                         name_match.group(3))[0].strip()
            if not c.constituency:
                c.constituency = constituency_raw

    # --- Age --- appears inline as "Age: 45"
    age_match = re.search(r"Age:\s*(\d+)", text)
    if age_match:
        c.age = age_match.group(1)

    # --- Photo ---
    # Confirmed pattern: https://myneta.info/images_candidate/<yearkey>/<hash>.jpg
    photo_img = soup.find("img", src=re.compile(r"images_candidate", re.I))
    if photo_img:
        src = photo_img.get("src", "")
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = BASE_URL + src
        c.photo_url = src

    # --- Criminal cases ---
    if re.search(r"No criminal cases", text, re.I):
        c.criminal_cases_declared = 0
        c.criminal_case_sections = []
    else:
        # The page states this explicitly ("Number of Criminal Cases: 32") —
        # confirmed against a real candidate with multiple cases. Trust this
        # over any counting heuristic when present.
        count_label_match = re.search(r"Number of Criminal Cases:\s*(\d+)", text)
        if count_label_match:
            c.criminal_cases_declared = int(count_label_match.group(1))
        else:
            case_no_hits = re.findall(r"Case No\.?\s*[:\-]?\s*(\S+)", text)
            c.criminal_cases_declared = len(set(case_no_hits)) if case_no_hits else 0

        # Charge-level breakdown with counts and descriptions — feeds
        # ipc_bns_charges table directly. Confirmed format: "7  charges
        # related to <description> (IPC Section-269)". This block is
        # isolated enough (requires the "charges related to" phrase) that
        # it doesn't false-match the pending-cases table, unlike scanning
        # the whole flattened page for "IPC Section-X" — that pattern
        # accidentally matches when a table's "IPC" law-type cell sits next
        # to an unrelated "Section 4(1) of TNOPPD Act" cell once flattened.
        charge_matches = re.findall(
            r"(\d+)\s*charges?\s*related to\s*(.*?)\s*\((IPC|BNS)\s*Section[\s\-]*"
            r"(\d+[A-Za-z]?(?:\(\d+\))?)\)",
            text
        )
        c.ipc_bns_charges = [
            {
                "code_type": code_type,
                "section": section,
                "description": desc.strip(),
                "charge_count": int(count),
            }
            for count, desc, code_type, section in charge_matches
        ]
        # derive the flat summary list from the structured breakdown above,
        # rather than re-scanning raw text
        c.criminal_case_sections = sorted({item["section"] for item in c.ipc_bns_charges})

    # --- Pending cases table ---
    pending_table = find_table_after_heading(soup, r"Cases where Pending")
    for row in parse_table_rows(pending_table):
        if is_empty_case_row(row):
            continue
        row = row + [""] * (11 - len(row))  # defensive pad
        (serial_no, fir_no, case_no, court, law_type, ipc_sections, other_acts,
         charges_framed, charges_framed_date, appeal_filed, appeal_status) = row[:11]
        sections_combined = " ".join(x for x in [law_type, ipc_sections] if x).strip()
        other_acts = fix_known_typos(other_acts)
        c.pending_cases.append({
            "serial_no": serial_no,
            "fir_no": fir_no,
            "case_no": case_no,
            "court": court,
            "ipc_sections_applicable": sections_combined,
            "other_acts": other_acts,
            "charges_framed": charges_framed,
            "charges_framed_date": charges_framed_date,
            "appeal_filed": appeal_filed,
            "appeal_status": appeal_status,
        })

    # --- Convicted cases table --- (same shape, minus FIR No.)
    convicted_table = find_table_after_heading(soup, r"Cases where Convicted")
    for row in parse_table_rows(convicted_table):
        if is_empty_case_row(row):
            continue
        row = row + [""] * (10 - len(row))  # defensive pad
        (serial_no, case_no, court, law_type, ipc_sections, other_acts,
         punishment_imposed, convicted_date, appeal_filed, appeal_status) = row[:10]
        sections_combined = " ".join(x for x in [law_type, ipc_sections] if x).strip()
        other_acts = fix_known_typos(other_acts)
        c.convicted_cases.append({
            "serial_no": serial_no,
            "case_no": case_no,
            "court": court,
            "ipc_sections_applicable": sections_combined,
            "other_acts": other_acts,
            "punishment_imposed": punishment_imposed,
            "convicted_date": convicted_date,
            "appeal_filed": appeal_filed,
            "appeal_status": appeal_status,
        })

    # --- Assets / Liabilities --- top summary block: "Assets: Rs 10,83,267
    # ~10 Lacs+" / "Liabilities: Nil". Note the label is "Assets:"/"Liabilities:",
    # not "Total Assets" — that was the bug in the original version.
    assets_match = re.search(r"Assets:\s*(Rs\s*[\d,]+|Nil)\s*(~[^|]*?)?(?=Liabilities|$)", text)
    if assets_match:
        val = assets_match.group(1).strip()
        extra = (assets_match.group(2) or "").strip()
        c.total_assets = f"{val} {extra}".strip()

    liab_match = re.search(r"Liabilities:\s*(Rs\s*[\d,]+|Nil)\s*(~[^|]*?)?(?=Educational|$)", text)
    if liab_match:
        val = liab_match.group(1).strip()
        extra = (liab_match.group(2) or "").strip()
        c.total_liabilities = f"{val} {extra}".strip()

    # --- Education --- "Educational Details ... Category: <text> ... Details of PAN"
    edu_match = re.search(
        r"Educational Details\s*-*\s*Category:\s*(.*?)(?:Details of PAN|Details of Criminal)",
        text, re.S
    )
    if edu_match:
        c.education = edu_match.group(1).strip()[:300]  # cap length, can run long

    return c


# ---------------------------------------------------------------------------
# Step 3: orchestrate a full state scrape, with resume support
# ---------------------------------------------------------------------------

def scrape_state(yearkey: str):
    meta = STATE_YEARKEYS[yearkey]
    state = meta["state"]
    out_csv = OUTPUT_DIR / f"{yearkey}.csv"
    out_json = OUTPUT_DIR / f"{yearkey}.json"

    # resume: load already-fetched candidate_ids
    existing: dict[str, Candidate] = {}
    if out_json.exists():
        with open(out_json, "r", encoding="utf-8") as f:
            for row in json.load(f):
                existing[row["candidate_id"]] = Candidate(**row)
        print(f"[resume] {len(existing)} candidates already scraped for {yearkey}")

    print(f"\n=== {state} ({yearkey}) ===")
    candidate_refs = get_candidate_ids(yearkey)
    print(f"[list] total candidates found: {len(candidate_refs)} "
          f"(expected roughly {meta['seats_hint']}x8-15)")

    results = list(existing.values())
    todo = [(cid, con) for cid, con in candidate_refs if cid not in existing]
    print(f"[fetch] {len(todo)} candidates to fetch ({len(existing)} skipped as already done)")

    for i, (cid, constituency) in enumerate(todo, 1):
        url = f"{BASE_URL}/{yearkey}/candidate.php?candidate_id={cid}"
        print(f"[{i}/{len(todo)}] fetching candidate {cid}")
        resp = fetch(url)
        if resp is None:
            continue

        candidate = parse_candidate_page(resp.text, cid, yearkey, state, url,
                                          constituency_hint=constituency)
        results.append(candidate)

        # checkpoint every 50 candidates in case of interruption
        if i % 50 == 0:
            _write_outputs(results, out_csv, out_json)
            print(f"  [checkpoint] saved {len(results)} candidates so far")

        time.sleep(REQUEST_DELAY_SECONDS)

    _write_outputs(results, out_csv, out_json)
    print(f"[done] {state}: {len(results)} candidates saved to {out_csv} / {out_json}")


def _write_outputs(results: list[Candidate], out_csv: Path, out_json: Path):
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in results], f, ensure_ascii=False, indent=2)

    # CSV can't hold nested structures — the case/charge tables get flattened
    # to JSON strings here for spreadsheet-friendliness, but load_mla_data.py
    # reads from the .json file, not this .csv, when populating the
    # pending_cases / convicted_cases / ipc_bns_charges tables.
    if results:
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()))
            writer.writeheader()
            for r in results:
                row = asdict(r)
                row["criminal_case_sections"] = ";".join(row["criminal_case_sections"])
                row["pending_cases"] = json.dumps(row["pending_cases"], ensure_ascii=False)
                row["convicted_cases"] = json.dumps(row["convicted_cases"], ensure_ascii=False)
                row["ipc_bns_charges"] = json.dumps(row["ipc_bns_charges"], ensure_ascii=False)
                writer.writerow(row)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def test_one(yearkey: str, candidate_id: str):
    """Fetch and parse a single candidate page, print result. Run this
    first to sanity-check the selectors against the live site."""
    url = f"{BASE_URL}/{yearkey}/candidate.php?candidate_id={candidate_id}"
    print(f"Fetching {url} ...")
    resp = fetch(url)
    if resp is None:
        print("Fetch failed.")
        sys.exit(1)
    c = parse_candidate_page(resp.text, candidate_id, yearkey,
                              STATE_YEARKEYS[yearkey]["state"], url)
    print(json.dumps(asdict(c), indent=2, ensure_ascii=False))
    print("\nIf name/party/assets/criminal fields above look empty or wrong,")
    print("inspect the actual page HTML and adjust parse_candidate_page().")


def main():
    parser = argparse.ArgumentParser(description="Scrape MLA affidavits from MyNeta")
    parser.add_argument("--state", choices=list(STATE_YEARKEYS.keys()),
                         help="Scrape a single state (yearkey, e.g. TamilNadu2026)")
    parser.add_argument("--all", action="store_true", help="Scrape all 5 states")
    parser.add_argument("--test-one", metavar="CANDIDATE_ID",
                         help="Fetch+parse a single candidate_id for testing (requires --state)")
    args = parser.parse_args()

    if args.test_one:
        if not args.state:
            print("--test-one requires --state")
            sys.exit(1)
        test_one(args.state, args.test_one)
        return

    if args.all:
        for yearkey in STATE_YEARKEYS:
            scrape_state(yearkey)
    elif args.state:
        scrape_state(args.state)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
