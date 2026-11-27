"""Download the planned MobiPhysio sample from Harvard Dataverse.

Reads ml/data/sample_plan.csv (produced by ``sample_plan.py``) and fetches each
file from ``https://dataverse.harvard.edu/api/access/datafile/{id}``. Anonymous
access, no credentials. Every file is size- and MD5-verified against the
Dataverse listing; failures are retried and then recorded rather than hidden.

Idempotent: a file already present with the expected size and MD5 is skipped,
so the script can be re-run to fill in failures without re-fetching the corpus.

Outputs
-------
* videos under ``--videos-dir`` (default ml/data/raw/mobiphysio/videos)
* ``ml/data/download_status.csv`` - machine-readable per-file outcome
* an appended run section in ``ml/data/download_log.md``
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import shutil
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

USER_AGENT = "rehabloop-ml-dataset-fetch/0.1 (+research use; CC0 dataset)"
CHUNK = 1024 * 256

STATUS_COLUMNS = [
    "filename",
    "file_id",
    "expected_bytes",
    "actual_bytes",
    "status",
    "detail",
    "local_path",
]


@dataclass
class Outcome:
    filename: str
    file_id: int
    expected_bytes: int
    actual_bytes: int
    status: str  # ok | skipped_existing | failed
    detail: str
    local_path: str


def md5_of(path: Path) -> str:
    digest = hashlib.md5()  # noqa: S324 - matches the checksum Dataverse publishes
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def already_good(path: Path, expected_bytes: int, expected_md5: str) -> bool:
    if not path.is_file():
        return False
    if expected_bytes and path.stat().st_size != expected_bytes:
        return False
    if expected_md5:
        return md5_of(path) == expected_md5.lower()
    return bool(expected_bytes)


def fetch_one(
    row: dict[str, str],
    videos_dir: Path,
    attempts: int,
    timeout: float,
) -> Outcome:
    filename = row["filename"]
    file_id = int(row["file_id"])
    expected_bytes = int(row["filesize_bytes"] or 0)
    expected_md5 = (row.get("md5") or "").strip().lower()
    target = videos_dir / filename
    rel = str(target.relative_to(REPO_ROOT)) if target.is_relative_to(REPO_ROOT) else str(target)

    if already_good(target, expected_bytes, expected_md5):
        return Outcome(
            filename,
            file_id,
            expected_bytes,
            target.stat().st_size,
            "skipped_existing",
            "size+md5 already match",
            rel,
        )

    url = row["access_url"]
    last_error = ""
    for attempt in range(1, attempts + 1):
        partial = target.with_suffix(target.suffix + ".part")
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
                if response.status != 200:
                    raise urllib.error.HTTPError(url, response.status, "bad status", {}, None)  # type: ignore[arg-type]
                with partial.open("wb") as handle:
                    shutil.copyfileobj(response, handle, CHUNK)
            actual = partial.stat().st_size
            if expected_bytes and actual != expected_bytes:
                raise OSError(f"size mismatch: got {actual}, expected {expected_bytes}")
            if expected_md5:
                digest = md5_of(partial)
                if digest != expected_md5:
                    raise OSError(f"md5 mismatch: got {digest}, expected {expected_md5}")
            partial.replace(target)
            return Outcome(filename, file_id, expected_bytes, actual, "ok", "", rel)
        except Exception as exc:  # noqa: BLE001 - every failure must be recorded, not raised
            last_error = f"{type(exc).__name__}: {exc}"
            partial.unlink(missing_ok=True)
            if attempt < attempts:
                time.sleep(min(30.0, 2.0 * attempt))
    return Outcome(filename, file_id, expected_bytes, 0, "failed", last_error, "")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=REPO_ROOT / "ml" / "data" / "sample_plan.csv")
    parser.add_argument(
        "--videos-dir",
        type=Path,
        default=REPO_ROOT / "ml" / "data" / "raw" / "mobiphysio" / "videos",
    )
    parser.add_argument(
        "--status-csv", type=Path, default=REPO_ROOT / "ml" / "data" / "download_status.csv"
    )
    parser.add_argument("--log", type=Path, default=REPO_ROOT / "ml" / "data" / "download_log.md")
    parser.add_argument("--workers", type=int, default=24)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=300.0)
    parser.add_argument("--limit", type=int, default=0, help="debug: only fetch the first N rows")
    parser.add_argument(
        "--budget-gb",
        type=float,
        default=40.0,
        help="abort before starting if the plan exceeds this many GB",
    )
    args = parser.parse_args()

    if not args.plan.is_file():
        print(f"missing plan: {args.plan}")
        return 1
    with args.plan.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if args.limit:
        rows = rows[: args.limit]
    planned_bytes = sum(int(row["filesize_bytes"] or 0) for row in rows)
    if planned_bytes > args.budget_gb * 1000**3:
        print(
            f"ABORT: plan is {planned_bytes / 1000**3:.2f} GB, over the "
            f"{args.budget_gb:.0f} GB budget"
        )
        return 2

    free_bytes = shutil.disk_usage(args.videos_dir.anchor or "/").free
    if free_bytes < planned_bytes * 1.15:
        print(
            f"ABORT: only {free_bytes / 1000**3:.1f} GB free for a "
            f"{planned_bytes / 1000**3:.2f} GB download"
        )
        return 2

    args.videos_dir.mkdir(parents=True, exist_ok=True)
    started = datetime.now(UTC)
    print(
        f"downloading {len(rows)} files ({planned_bytes / 1000**3:.2f} GB) "
        f"with {args.workers} workers; free disk {free_bytes / 1000**3:.1f} GB"
    )

    outcomes: list[Outcome] = []
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(fetch_one, row, args.videos_dir, args.attempts, args.timeout): row
            for row in rows
        }
        for future in as_completed(futures):
            outcome = future.result()
            outcomes.append(outcome)
            done += 1
            if outcome.status == "failed":
                print(f"FAILED {outcome.filename}: {outcome.detail}", flush=True)
            if done % 25 == 0 or done == len(rows):
                got = sum(o.actual_bytes for o in outcomes)
                print(
                    f"[{done}/{len(rows)}] {got / 1000**3:.2f} GB on disk, "
                    f"{time.time() - started.timestamp():.0f}s elapsed",
                    flush=True,
                )

    outcomes.sort(key=lambda o: o.filename)
    finished = datetime.now(UTC)
    counts = Counter(o.status for o in outcomes)
    got_bytes = sum(o.actual_bytes for o in outcomes if o.status != "failed")

    with args.status_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=STATUS_COLUMNS)
        writer.writeheader()
        for outcome in outcomes:
            writer.writerow(
                {
                    "filename": outcome.filename,
                    "file_id": outcome.file_id,
                    "expected_bytes": outcome.expected_bytes,
                    "actual_bytes": outcome.actual_bytes,
                    "status": outcome.status,
                    "detail": outcome.detail,
                    "local_path": outcome.local_path,
                }
            )

    failures = [o for o in outcomes if o.status == "failed"]
    lines = [
        "",
        f"## Run {started.isoformat(timespec='seconds')} -> "
        f"{finished.isoformat(timespec='seconds')} (UTC)",
        "",
        "- Source: Harvard Dataverse `doi:10.7910/DVN/XSI0QN` (MobiPhysio v1.1), "
        "anonymous `GET /api/access/datafile/{id}`, no credentials.",
        f"- Plan: `{args.plan.name}` - {len(rows)} files intended, "
        f"{planned_bytes / 1000**3:.2f} GB intended.",
        f"- Workers: {args.workers}, attempts per file: {args.attempts}, "
        f"timeout: {args.timeout:.0f}s.",
        "- Verification: size + published MD5 per file.",
        f"- Result: {counts.get('ok', 0)} downloaded, "
        f"{counts.get('skipped_existing', 0)} already present and verified, "
        f"{counts.get('failed', 0)} failed.",
        f"- Bytes on disk for this sample: {got_bytes} " f"({got_bytes / 1000**3:.2f} GB).",
        f"- Elapsed: {(finished - started).total_seconds() / 60:.1f} min.",
        "- Per-file outcome: `ml/data/download_status.csv`.",
    ]
    if failures:
        lines.append("")
        lines.append("### Failures (intended but not obtained)")
        lines.append("")
        for outcome in failures:
            lines.append(f"- `{outcome.filename}` (file id {outcome.file_id}): {outcome.detail}")
    else:
        lines.append("- No failures: every intended file was obtained and verified.")
    lines.append("")

    args.log.parent.mkdir(parents=True, exist_ok=True)
    if not args.log.exists():
        args.log.write_text(
            "# MobiPhysio download log\n\n"
            "Append-only record of what was fetched, when, from where, and what failed.\n",
            encoding="utf-8",
        )
    with args.log.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    print(
        f"ok={counts.get('ok', 0)} skipped={counts.get('skipped_existing', 0)} "
        f"failed={counts.get('failed', 0)} bytes={got_bytes}"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
