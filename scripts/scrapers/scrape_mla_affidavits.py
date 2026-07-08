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
    candidate_id: str
    yearkey: str
    state: str
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


# ---------------------------------------------------------------------------
# Step 2: parse an individual candidate affidavit page
# ---------------------------------------------------------------------------

def parse_candidate_page(html: str, candidate_id: str, yearkey: str, state: str, url: str,
                          constituency_hint: str = "") -> Candidate:
    soup = BeautifulSoup(html, "lxml")
    c = Candidate(candidate_id=candidate_id, yearkey=yearkey, state=state,
                  source_url=url, constituency=constituency_hint)

    # --- Name / party / constituency from the page title or header ---
    # MyNeta candidate pages typically have a title like:
    # "NAME(PARTY):Constituency- CONSTITUENCY(DISTRICT)"
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        name_match = re.match(r"^(.*?)\((.*?)\):Constituency-\s*(.*)$", title_text)
        if name_match:
            c.name = name_match.group(1).strip()
            c.party = name_match.group(2).strip()
            if not c.constituency:
                c.constituency = name_match.group(3).strip()

    # --- Criminal cases ---
    # Look for a section header mentioning "Criminal" and count case rows /
    # extract IPC/BNS section references near it. This is intentionally
    # loose since the exact table structure needs to be confirmed live.
    criminal_header = soup.find(string=re.compile(r"Criminal Case", re.I))
    if criminal_header:
        container = criminal_header.find_parent(["table", "div"])
        if container:
            text_block = container.get_text(" ", strip=True)
            # count of declared cases — look for "Case No" occurrences or
            # an explicit "Total no of cases" figure
            case_count_match = re.search(r"(\d+)\s+Cases?\s+Registered", text_block, re.I)
            if case_count_match:
                c.criminal_cases_declared = int(case_count_match.group(1))

            # pull IPC/BNS-style section references, e.g. "IPC-379", "BNS Section 303"
            sections = re.findall(r"(?:IPC|BNS)[\s\-]*(?:Section)?\s*[\-]?\s*(\d+[A-Za-z]?)",
                                   text_block)
            c.criminal_case_sections = sorted(set(sections))

    # --- Assets / liabilities ---
    assets_label = soup.find(string=re.compile(r"Total Assets", re.I))
    if assets_label:
        row = assets_label.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if cells:
                c.total_assets = cells[-1].get_text(strip=True)

    liabilities_label = soup.find(string=re.compile(r"Total Liabilities", re.I))
    if liabilities_label:
        row = liabilities_label.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if cells:
                c.total_liabilities = cells[-1].get_text(strip=True)

    # --- Education / age ---
    edu_label = soup.find(string=re.compile(r"Education", re.I))
    if edu_label:
        row = edu_label.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if cells:
                c.education = cells[-1].get_text(strip=True)

    age_label = soup.find(string=re.compile(r"^\s*Age\s*$", re.I))
    if age_label:
        row = age_label.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if cells:
                c.age = cells[-1].get_text(strip=True)

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

    if results:
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()))
            writer.writeheader()
            for r in results:
                row = asdict(r)
                row["criminal_case_sections"] = ";".join(row["criminal_case_sections"])
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
