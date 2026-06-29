-- Ballot Brief D1 schema
-- SQLite dialect (Cloudflare D1). Run this first:
--   npx wrangler d1 execute <DB_NAME> --remote --file=schema.sql
-- (drop --remote to apply to your local dev database instead)

CREATE TABLE IF NOT EXISTS candidates (
  candidate_id TEXT PRIMARY KEY,
  name TEXT,
  is_winner INTEGER NOT NULL DEFAULT 0,  -- 0/1, parsed out of the raw "(Winner)" suffix in name
  party TEXT,
  state TEXT,
  constituency TEXT,
  age INTEGER,
  relation_name TEXT,           -- S/o, D/o, W/o value from the affidavit
  voter_enrolled_in TEXT,
  self_profession TEXT,
  spouse_profession TEXT,
  photo_url TEXT,
  total_assets_rupees INTEGER,
  total_assets_label TEXT,      -- e.g. "11 Crore+"
  total_liabilities_rupees INTEGER,
  total_liabilities_label TEXT,
  criminal_case_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_candidates_state ON candidates(state);
CREATE INDEX IF NOT EXISTS idx_candidates_constituency ON candidates(constituency);
CREATE INDEX IF NOT EXISTS idx_candidates_party ON candidates(party);
CREATE INDEX IF NOT EXISTS idx_candidates_case_count ON candidates(criminal_case_count);
CREATE INDEX IF NOT EXISTS idx_candidates_assets ON candidates(total_assets_rupees);

-- Individual pending-case records — confirmed present for 1,457 candidates, with
-- a verified-consistent 10-column shape across the entire dataset (the raw data
-- rows actually carry an 11th trailing column, but it's empty in every single
-- row checked, so it's dropped here rather than carried forward as dead weight).
-- This is the table your "case status" classification axis should read from
-- directly — charges_framed and appeal_status are real per-case fields, not
-- aggregates.
CREATE TABLE IF NOT EXISTS pending_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  serial_no TEXT,
  fir_no TEXT,
  case_no TEXT,
  court TEXT,
  ipc_sections_applicable TEXT,
  other_acts TEXT,
  charges_framed TEXT,
  charges_framed_date TEXT,
  appeal_filed TEXT,
  appeal_status TEXT,
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_candidate ON pending_cases(candidate_id);

-- Individual conviction records — confirmed present for 88 candidates. Note the
-- column shape genuinely differs from pending_cases (no FIR No.; "Punishment
-- Imposed" and "Date on which convicted" replace "Charges Framed" and its date)
-- — this isn't an inconsistency to paper over, it's because a case usually only
-- reaches this table once an FIR has resolved into a conviction.
CREATE TABLE IF NOT EXISTS convicted_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  serial_no TEXT,
  case_no TEXT,
  court TEXT,
  ipc_sections_applicable TEXT,
  other_acts TEXT,
  punishment_imposed TEXT,
  convicted_date TEXT,
  appeal_filed TEXT,
  appeal_status TEXT,
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_convicted_candidate ON convicted_cases(candidate_id);

-- One row per distinct charge type per candidate (e.g. "41 charges related to
-- Voluntarily causing hurt by dangerous weapons (IPC Section-324)" -> one row
-- with charge_count=41). This is the table your severity-tier / offense-type
-- classification system should join against.
CREATE TABLE IF NOT EXISTS ipc_bns_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  code_type TEXT,              -- 'IPC' or 'BNS'
  section TEXT,
  description TEXT,
  charge_count INTEGER,
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_charges_candidate ON ipc_bns_charges(candidate_id);
CREATE INDEX IF NOT EXISTS idx_charges_section ON ipc_bns_charges(code_type, section);

-- Stub reference table for YOUR classification system — not populated by the
-- scraper. Fill this in separately (one row per distinct section you've
-- classified), then join against ipc_bns_charges on (code_type, section) to
-- get severity tier / offense type / special-legislation flag per charge.
CREATE TABLE IF NOT EXISTS ipc_bns_section_reference (
  code_type TEXT NOT NULL,
  section TEXT NOT NULL,
  severity_tier TEXT,              -- per your CrPC First Schedule classification
  offense_type TEXT,               -- per your IPC chapter-structure taxonomy
  is_special_legislation INTEGER DEFAULT 0,
  PRIMARY KEY (code_type, section)
);

-- One row per asset/liability line item (e.g. "Cash", "Deposits in Banks...").
-- table_type distinguishes which of the three source tables this came from.
-- by_relation_json holds the self/spouse/huf/dependent1-3 breakdown — kept as
-- JSON since per-relation filtering is unlikely to be a real query pattern
-- for this product; category/total_rupees are the columns you'll actually
-- filter and sort on.
CREATE TABLE IF NOT EXISTS asset_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  table_type TEXT,              -- 'movable' | 'immovable' | 'liabilities'
  category TEXT,
  total_rupees INTEGER,
  total_label TEXT,
  by_relation_json TEXT,
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_assets_candidate ON asset_categories(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assets_table_type ON asset_categories(table_type);

-- The "Gross Total Value", "Totals (Calculated as Sum of Values)", "Grand
-- Total of Liabilities" style summary rows from each table — kept separate
-- from asset_categories so they don't get mistaken for real line items.
CREATE TABLE IF NOT EXISTS asset_computed_totals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  table_type TEXT,
  label TEXT,
  total_rupees INTEGER,
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_computed_totals_candidate ON asset_computed_totals(candidate_id);
