-- Migration: add election_type + election_year to distinguish MP (Lok Sabha)
-- from MLA (state assembly) candidates once MLA rows land in this table.
--
-- Run this BEFORE loading any scraped MLA data.
--   npx wrangler d1 execute <DB_NAME> --local --file=migrations/001_add_election_type.sql
--   (verify against local first, then re-run with --remote)

ALTER TABLE candidates ADD COLUMN election_type TEXT;      -- 'LS' | 'MLA'
ALTER TABLE candidates ADD COLUMN election_year INTEGER;

-- Backfill existing rows. Adjust the year if your current LS dataset isn't
-- 2024 — check with: SELECT DISTINCT candidate_id FROM candidates LIMIT 5;
-- and cross-reference against your original scrape source.
UPDATE candidates
SET election_type = 'LS',
    election_year = 2024
WHERE election_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_election_type ON candidates(election_type);
CREATE INDEX IF NOT EXISTS idx_candidates_election_year ON candidates(election_year);
