# Ballot Brief

A prototype for reading a candidate's declared criminal cases without flattening them
into a single, misleading number.

## Why this exists

MyNeta (ADR / National Election Watch) publishes self-declared criminal case data from
candidate election affidavits — but a raw case count treats a protest-era public order
charge the same as an attempt-to-murder charge. This prototype classifies every case
against the actual CrPC First Schedule (bail status) and IPC chapter structure, instead
of an invented severity scale, so the distinction is visible rather than averaged away.

## What this is — and isn't — right now

This is a **classification-logic prototype**, not a finished voter tool:

- Case data shown is a hand-picked representative sample (14 of one candidate's 243
  filed cases, 12 of another's 49), pulled directly from MyNeta's affidavit pages.
  It is not the full dataset and not a random sample — it exists to stress-test the
  taxonomy across the severity range, not to characterize either candidate's full record.
- Bail-status classification for some IPC sections is marked "not yet verified" in the
  UI — these reflect well-established legal classification but haven't individually been
  checked against the CrPC First Schedule primary source yet.
- No backend, no live scraping, no persistence. Everything is static data in `src/App.jsx`.

## Stack

Vite + React + Tailwind, icons via lucide-react. No backend.

## Local development

```bash
npm install
npm run dev
```

## Source

Case data sourced from [myneta.info](https://www.myneta.info), an open data project by the
Association for Democratic Reforms (ADR), which archives Election Commission of India
candidate affidavits.
