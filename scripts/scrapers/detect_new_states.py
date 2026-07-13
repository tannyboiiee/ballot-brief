"""
Ballot Brief - detect new state elections on MyNeta

Checks myneta.info's homepage "Recent Elections" section for state-year
keys (e.g. "Goa2027") that aren't yet in scrape_mla_affidavits.py's
STATE_YEARKEYS registry, and reports them for review.

This does NOT scrape any candidate data — it's a lightweight, read-only
check meant to run periodically (manually, or on a schedule around known
election windows) so you know when to onboard a new state, without
having to track election news yourself.

USAGE:
    python detect_new_states.py

Run this from the same folder as scrape_mla_affidavits.py — it imports
STATE_YEARKEYS from there so the two files never drift out of sync.
"""

import re
import sys
import requests
from pathlib import Path

# import the existing registry so this script and the scraper always
# agree on what's "already known" — no separate list to keep in sync
sys.path.insert(0, str(Path(__file__).parent))
try:
    from scrape_mla_affidavits import STATE_YEARKEYS
except ImportError:
    print("Couldn't import STATE_YEARKEYS from scrape_mla_affidavits.py — "
          "make sure this script sits in the same folder.")
    sys.exit(1)

HOMEPAGE_URL = "https://www.myneta.info/"
HEADERS = {
    "User-Agent": "BallotBrief-Research/1.0 (civic-tech, non-commercial; contact: <your email>)",
}

# Canonical Indian state names as listed on MyNeta's own "State Assemblies"
# section — used to validate that a detected year-key is actually a state
# assembly election, not a Lok Sabha, Rajya Sabha, or local-body entry
# that happens to share the same "NameYYYY" URL shape.
KNOWN_STATE_NAMES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chattisgarh",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu And Kashmir", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttarakhand", "Uttar Pradesh",
    "West Bengal",
]
STATE_SLUGS = {name.replace(" ", ""): name for name in KNOWN_STATE_NAMES}


def fetch_homepage_html() -> str:
    resp = requests.get(HOMEPAGE_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.text


def extract_recent_election_yearkeys(html: str) -> list[str]:
    """Find state-year keys from links shaped like
    https://www.myneta.info/<YearKey>/ (root path, no query string),
    restricted to the "Recent Elections" section of the page."""
    # isolate the Recent Elections section (between its heading and the
    # next major section heading) so we don't pick up Lok Sabha / local
    # body links that use the same URL shape elsewhere on the page
    section_match = re.search(
        r"Recent Elections(.*?)(?:Electoral Bonds|Lok Sabha</a>|### Lok Sabha)",
        html, re.S | re.I
    )
    section_html = section_match.group(1) if section_match else html

    hrefs = re.findall(
        r'href=["\']https://(?:www\.)?myneta\.info/([A-Za-z]+\d{4})/?["\']',
        section_html
    )
    return sorted(set(hrefs))


def yearkey_to_state_name(yearkey: str) -> str | None:
    """Split e.g. 'Goa2027' into slug 'Goa' + year '2027', validate the
    slug against known state names. Returns the proper state name if
    valid, else None (meaning: not a state assembly election)."""
    match = re.match(r"^([A-Za-z]+)(\d{4})$", yearkey)
    if not match:
        return None
    slug = match.group(1)
    return STATE_SLUGS.get(slug)


def main():
    print(f"Checking {HOMEPAGE_URL} for new state elections...")
    try:
        html = fetch_homepage_html()
    except requests.RequestException as e:
        print(f"Fetch failed: {e}")
        sys.exit(1)

    found_yearkeys = extract_recent_election_yearkeys(html)
    known_yearkeys = set(STATE_YEARKEYS.keys())

    new_states = []
    for yk in found_yearkeys:
        state_name = yearkey_to_state_name(yk)
        if state_name is None:
            continue  # not a recognized state assembly election, skip
        if yk not in known_yearkeys:
            new_states.append((yk, state_name))

    print(f"\nFound {len(found_yearkeys)} state-shaped year-key(s) in Recent Elections.")
    print(f"{len(known_yearkeys)} already tracked in STATE_YEARKEYS: {sorted(known_yearkeys)}")

    if not new_states:
        print("\nNo new states detected. Nothing to do.")
        return

    print(f"\n{'='*60}")
    print(f"NEW STATE ELECTION(S) DETECTED — not yet in STATE_YEARKEYS:")
    print(f"{'='*60}")
    for yk, state_name in new_states:
        print(f"  {yk}  ({state_name})")
    print(f"\nTo onboard, add to STATE_YEARKEYS in scrape_mla_affidavits.py, e.g.:")
    for yk, state_name in new_states:
        print(f'    "{yk}": {{"state": "{state_name}", "seats_hint": None}},  '
              f'# fill in actual seat count')
    print("\nThen run --test-one against a sample candidate before a full scrape,")
    print("same as for the first 5 states.")


if __name__ == "__main__":
    main()
