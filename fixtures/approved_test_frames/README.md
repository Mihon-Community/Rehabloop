# Approved test frames — EMPTY BY POLICY

This directory holds **no** frames and must remain that way in the repository.

- No real patient footage, identifiable video, raw camera frames or health data
  may ever be committed here.
- Only frames with documented approval and consent may be used for local
  engineering checks, and they must stay outside Git (this directory is
  gitignored except for this README).
- Use `../synthetic_keypoint_sequences/` for committed, deterministic tests.
- If an approved frame set is obtained for benchmarking, record its provenance,
  consent scope and retention schedule outside the repository and never upload
  it to a third-party model endpoint without satisfying the legal, contractual
  and privacy requirements described in `docs/backend_guide.md`.
- `vision_service/scripts/video_file_replay.py` and
  `backend/scripts/replay_video_session.py` can read a locally-placed,
  approved clip from this directory for local testing; neither script ever
  writes video or frames back into Git.
