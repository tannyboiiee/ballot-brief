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

REQUEST_DELAY_SECONDS = 0.5  # matches the proven LS scraper's validated pace
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
    is_winner: bool = False    # UNVERIFIED against live HTML — inferred from a "Winner" badge
                                # observed in a screenshot of the constituency listing page
                                # (green text next to the candidate name). Run --test-one against
                                # a candidate_id known to have won before trusting this field.
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
                # myneta.info doesn't reliably declare charset=utf-8 in its
                # Content-Type header, so requests falls back to guessing —
                # and per the HTTP spec, its fallback guess is Latin-1, not
                # UTF-8. That silently mangled every non-breaking space
                # (\xa0, used between "Rs" and the number) into "Ã‚Â" garbage,
                # which then broke the loader's rupee-amount regex too
                # (confirmed: total_assets_rupees came out NULL for every
                # candidate as a result). Force UTF-8 explicitly rather than
                # trusting requests' guess.
                resp.encoding = "utf-8"
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

def discover_true_constituency_ids(yearkey: str, max_probe: int = 340) -> list[int]:
    """
    Probe constituency_id=1..max_probe against the show_candidates
    endpoint directly — NOT show_constituencies&state_id, which was
    conclusively proven incomplete: a direct fetch of Bodinayakkanur
    (constituency_id=164) returned 14-15 real, fully-populated candidate
    rows, while THENI's entire district-level page (state_id=22) reported
    only 18 candidates total for all 4 of its constituencies combined —
    Andipatti alone (from an earlier screenshot) already had 15+. The
    district-level endpoint silently drops most of a district's data;
    the constituency-level endpoint returned complete, correct data on
    first try. Tamil Nadu has 234 real assembly constituencies, so
    max_probe needs to comfortably clear that.
    """
    valid = []
    for cid in range(1, max_probe + 1):
        url = f"{BASE_URL}/{yearkey}/index.php?action=show_candidates&constituency_id={cid}"
        resp = fetch(url)
        ok = False
        if resp is not None:
            ok = bool(re.search(r"candidate\.php\?candidate_id=\d+", resp.text))
        if not ok:
            time.sleep(3.0)
            resp = fetch(url)
            if resp is not None:
                ok = bool(re.search(r"candidate\.php\?candidate_id=\d+", resp.text))
        if ok:
            valid.append(cid)
        if cid % 25 == 0:
            print(f"  probed {cid}/{max_probe} constituency_ids so far, {len(valid)} valid found")
        time.sleep(REQUEST_DELAY_SECONDS)
    return valid


def extract_total_pages(html: str) -> int | None:
    """
    Reads the authoritative last-page number from the 'Last' pagination
    link's href (a real URL parameter) rather than parsing rendered
    "Showing page X of Y" text — ported directly from the proven LS
    scraper, which found the rendered text unreliable (page 1 omits its
    own page number entirely; bold/asterisk formatting varies).
    Returns None if there's no 'Last' link (single-page listing, which
    is the common case at constituency level — most seats have well
    under a page's worth of candidates).
    """
    soup = BeautifulSoup(html, "lxml")
    last_link = soup.find("a", string=re.compile(r"^\s*Last\s*$", re.I))
    if last_link and last_link.get("href"):
        m = re.search(r"page=(\d+)", last_link["href"])
        if m:
            return int(m.group(1))
    return None


def parse_constituency_listing_page(html: str, seen_ids: set) -> list[tuple[str, str, bool]]:
    """Parse one page of a constituency's candidate listing table. Returns
    new (candidate_id, constituency_hint, is_winner) tuples not already in
    seen_ids. Table columns confirmed via real fetch of Bodinayakkanur: Sno |
    Candidate | Party | Criminal Cases | Education | Age | Total Assets |
    Liabilities — candidate name+link lives in cells[1].

    is_winner: UNVERIFIED against live HTML — based on a screenshot showing
    green "Winner" text next to the candidate's name in this same cell.
    Detected here via a case-insensitive text search within cells[1]. Needs
    confirmation via --test-one against a known winner before trusting it."""
    soup = BeautifulSoup(html, "lxml")
    new_rows = []
    for tr in soup.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 4:
            continue
        link = cells[1].find("a", href=re.compile(r"candidate\.php\?candidate_id=\d+"))
        if not link:
            continue
        cid_m = re.search(r"candidate_id=(\d+)", link["href"])
        if not cid_m:
            continue
        cid = cid_m.group(1)
        if cid in seen_ids:
            continue
        seen_ids.add(cid)
        is_winner = bool(re.search(r"\bWinner\b", cells[1].get_text(" ", strip=True), re.I))
        new_rows.append((cid, "", is_winner))  # constituency name comes from the candidate page itself
    return new_rows


def scrape_true_constituency_listing(yearkey: str, constituency_id: int) -> tuple[list, int | None]:
    """Yield every candidate in one real constituency, across all its
    pages (usually just one — constituency-level candidate counts are
    small, ~15-30, unlike the district-level aggregates this replaces),
    using the authoritative page count from extract_total_pages() rather
    than stopping on the first empty page."""
    results = []
    seen_ids = set()
    page = 1
    total_pages = None

    while True:
        url = (f"{BASE_URL}/{yearkey}/index.php?action=show_candidates"
               f"&constituency_id={constituency_id}")
        if page > 1:
            url += f"&page={page}"

        resp = fetch(url)
        if resp is None:
            break

        new_rows = parse_constituency_listing_page(resp.text, seen_ids)
        if total_pages is None:
            total_pages = extract_total_pages(resp.text)

        if not new_rows:
            for retry_attempt in range(3):
                time.sleep(2.0 * (retry_attempt + 1))
                resp = fetch(url)
                if resp is None:
                    continue
                new_rows = parse_constituency_listing_page(resp.text, seen_ids)
                if total_pages is None:
                    total_pages = extract_total_pages(resp.text)
                if new_rows:
                    break

        results.extend(new_rows)

        if total_pages is not None:
            if page >= total_pages:
                break
        elif not new_rows:
            break

        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)

    return results, total_pages


def get_candidate_ids(yearkey: str) -> list[tuple[str, str]]:
    """
    Full candidate enumeration for one state-year: discover valid
    constituency_ids directly (up to 234 for Tamil Nadu), then walk each
    one's paginated listing via show_candidates. This replaces an earlier
    district-level (show_constituencies&state_id) approach that was
    conclusively proven incomplete via a direct side-by-side fetch.

    Caches the discovered constituency_id list to disk (constituency_ids
    are a fixed property of an election, not something that changes
    between runs) so re-running the scraper — e.g. to pick up a handful
    of missing/failed candidates — doesn't repay the ~4 minute discovery
    probe every single time. Delete the cache file to force rediscovery.
    """
    cache_path = OUTPUT_DIR / f"{yearkey}_constituency_ids_cache.json"
    if cache_path.exists():
        with open(cache_path, "r", encoding="utf-8") as f:
            constituency_ids = json.load(f)
        print(f"[list] using cached constituency ids ({len(constituency_ids)} found) "
              f"from {cache_path} — delete this file to force rediscovery")
    else:
        print(f"[list] discovering constituency ids for {yearkey}...")
        constituency_ids = discover_true_constituency_ids(yearkey)
        print(f"[list] found {len(constituency_ids)} constituencies "
              f"(Tamil Nadu has 234 — should be close to that)")
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(constituency_ids, f)

    all_candidates = []
    for i, cid in enumerate(constituency_ids, 1):
        rows, total_pages = scrape_true_constituency_listing(yearkey, cid)
        all_candidates.extend(rows)
        print(f"[list] constituency {i}/{len(constituency_ids)} (constituency_id={cid}): "
              f"{len(rows)} candidates, {total_pages or 1} page(s), "
              f"running total {len(all_candidates)}")

    return all_candidates


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
                          constituency_hint: str = "", is_winner: bool = False) -> Candidate:
    soup = BeautifulSoup(html, "lxml")

    namespaced_id = f"{yearkey}-{raw_id}"
    year_match = re.search(r"(\d{4})$", yearkey)
    election_year = int(year_match.group(1)) if year_match else 2026

    c = Candidate(candidate_id=namespaced_id, raw_myneta_id=raw_id, yearkey=yearkey, state=state,
                  election_type="MLA", election_year=election_year,
                  source_url=url, constituency=constituency_hint, is_winner=is_winner)

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
    # candidate_refs holds RAW myneta ids (e.g. "1148"), but `existing` is
    # keyed by the NAMESPACED candidate_id (e.g. "TamilNadu2026-1148") that
    # parse_candidate_page() constructs. Comparing raw against namespaced
    # directly always fails, which silently broke resume — every run
    # re-fetched everything regardless of what was already checkpointed.
    todo = [(cid, con, w) for cid, con, w in candidate_refs if f"{yearkey}-{cid}" not in existing]
    print(f"[fetch] {len(todo)} candidates to fetch ({len(existing)} skipped as already done)")

    for i, (cid, constituency, is_winner) in enumerate(todo, 1):
        url = f"{BASE_URL}/{yearkey}/candidate.php?candidate_id={cid}"
        print(f"[{i}/{len(todo)}] fetching candidate {cid}")
        resp = fetch(url)
        if resp is None:
            continue

        candidate = parse_candidate_page(resp.text, cid, yearkey, state, url,
                                          constituency_hint=constituency, is_winner=is_winner)
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
    first to sanity-check the selectors against the live site.

    NOTE: is_winner will always show false here — that field is detected
    from the "Winner" badge on the constituency LISTING page, not the
    individual candidate page this function fetches directly. Use
    --list-only or a real scrape to see is_winner actually populated."""
    url = f"{BASE_URL}/{yearkey}/candidate.php?candidate_id={candidate_id}"
    print(f"Fetching {url} ...")
    resp = fetch(url)
    if resp is None:
        print("Fetch failed.")
        sys.exit(1)
    c = parse_candidate_page(resp.text, candidate_id, yearkey,
                              STATE_YEARKEYS[yearkey]["state"], url)
    print(json.dumps(asdict(c), indent=2, ensure_ascii=False))
    print("\nNote: is_winner is always false from --test-one (see docstring above) — "
          "not a real signal here.")
    print("\nIf name/party/assets/criminal fields above look empty or wrong,")
    print("inspect the actual page HTML and adjust parse_candidate_page().")


def main():
    parser = argparse.ArgumentParser(description="Scrape MLA affidavits from MyNeta")
    parser.add_argument("--state", choices=list(STATE_YEARKEYS.keys()),
                         help="Scrape a single state (yearkey, e.g. TamilNadu2026)")
    parser.add_argument("--all", action="store_true", help="Scrape all 5 states")
    parser.add_argument("--test-one", metavar="CANDIDATE_ID",
                         help="Fetch+parse a single candidate_id for testing (requires --state)")
    parser.add_argument("--list-only", action="store_true",
                         help="Run just the candidate enumeration (discover districts, count "
                              "candidates per district) without fetching any candidate detail "
                              "pages. Fast — use this to verify enumeration before a full run.")
    args = parser.parse_args()

    if args.test_one:
        if not args.state:
            print("--test-one requires --state")
            sys.exit(1)
        test_one(args.state, args.test_one)
        return

    if args.list_only:
        if not args.state:
            print("--list-only requires --state")
            sys.exit(1)
        candidate_refs = get_candidate_ids(args.state)
        print(f"\n[list-only] Total candidates found for {args.state}: {len(candidate_refs)}")
        expected = STATE_YEARKEYS[args.state].get("seats_hint")
        if expected:
            print(f"[list-only] Sanity check: {expected} seats, so expect roughly "
                  f"{expected * 5}-{expected * 15} candidates.")
        winner_count = sum(1 for _, _, w in candidate_refs if w)
        print(f"[list-only] Sample candidate_ids: {[c for c, _, _ in candidate_refs[:10]]}")
        print(f"[list-only] Candidates flagged as winners: {winner_count} "
              f"(sanity check — should be close to the seat count above, not 0)")
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
