# MobiPhysio download log

Append-only record of what was fetched, when, from where, and what failed.

## Run 2026-11-26T21:27:31+00:00 -> 2026-11-26T21:31:15+00:00 (UTC)

- Source: Harvard Dataverse `doi:10.7910/DVN/XSI0QN` (MobiPhysio v1.1), anonymous `GET /api/access/datafile/{id}`, no credentials.
- Plan: `sample_plan.csv` - 4 files intended, 0.16 GB intended.
- Workers: 4, attempts per file: 3, timeout: 300s.
- Verification: size + published MD5 per file.
- Result: 4 downloaded, 0 already present and verified, 0 failed.
- Bytes on disk for this sample: 163844206 (0.16 GB).
- Elapsed: 3.7 min.
- Per-file outcome: `ml/data/download_status.csv`.
- No failures: every intended file was obtained and verified.

## Run 2026-11-26T21:31:34+00:00 -> 2026-11-26T23:17:22+00:00 (UTC)

- Source: Harvard Dataverse `doi:10.7910/DVN/XSI0QN` (MobiPhysio v1.1), anonymous `GET /api/access/datafile/{id}`, no credentials.
- Plan: `sample_plan.csv` - 674 files intended, 28.17 GB intended.
- Workers: 32, attempts per file: 3, timeout: 300s.
- Verification: size + published MD5 per file.
- Result: 670 downloaded, 4 already present and verified, 0 failed.
- Bytes on disk for this sample: 28171010934 (28.17 GB).
- Elapsed: 105.8 min.
- Per-file outcome: `ml/data/download_status.csv`.
- No failures: every intended file was obtained and verified.
