# MobiPhysio Phase 1 dataset report

Generated 2026-11-27T00:24:53+00:00 (UTC).

Source: MobiPhysio v1.1, Harvard Dataverse `doi:10.7910/DVN/XSI0QN`, CC0 1.0 Universal (`license_class: commercial_ok`). Licence detail and the Kaggle WLU blocker are in `ml/data/license_review.md`.

Scope: this is a non-clinical, numeric movement-measurement dataset of dataset-defined exercise categories. The EAAQ column is the dataset's own physiotherapist-assessed exercise-execution accuracy score on its 0-100 questionnaire scale. Nothing here describes any person's health status, injury, danger, recovery, prognosis or clinical progression, and no treatment or exercise target is implied.

## Headline counts

- Planned videos: **674**
- Downloaded and checksum-verified: **674** (28.17 GB on disk)
- Download gaps: **0**
- Keypoint sequences extracted: **674**
- Videos obtained but not extractable: **0**
- Participants: **9** (participant-disjoint splits)

- Sampled frames per clip: min 39, median 207, max 320; total 149,401 pose frames.
- Mean MoveNet keypoint confidence across clips: 0.487 (min 0.161, max 0.742).
- EAAQ average score present for 674/674 extracted clips; range 16.67-100.00, mean 81.07.

## Split assignment (participant-disjoint)

| split | videos | participants | participant ids | exercises |
|---|---|---|---|---|
| train | 512 | 7 | P02, P04, P05, P07, P08, P09, P10 | 9/9 |
| val | 81 | 1 | P21 | 9/9 |
| test | 81 | 1 | P22 | 9/9 |

No participant appears in more than one split, per the dataset's own recommended protocol (`MobiPhysio_README.md`, "Recommended evaluation protocol").

## Videos per exercise class and split

| code | exercise | train | val | test | total |
|---|---|---|---|---|---|
| E01 | Abduction | 63 | 9 | 9 | 81 |
| E02 | Adduction | 63 | 9 | 9 | 81 |
| E03 | Lateral Rotation | 63 | 9 | 9 | 81 |
| E04 | Medial Rotation | 63 | 9 | 9 | 81 |
| E05 | Circumduction | 62 | 9 | 9 | 80 |
| E06 | Wrist Extension | 63 | 9 | 9 | 81 |
| E07 | Hip Joint Flexion | 45 | 9 | 9 | 63 |
| E08 | Both Leg Flexion | 45 | 9 | 9 | 63 |
| E09 | Back Extension | 45 | 9 | 9 | 63 |

## Videos per camera angle and variation

| camera angle | videos |
|---|---|
| Front | 225 |
| Left | 224 |
| Right | 225 |

| variation | meaning | videos |
|---|---|---|
| FL | Full Light | 225 |
| LL | Low Light | 224 |
| O | Occlusion | 225 |

## Gender distribution of recorded participants

| split | videos (M) | videos (F) | participants (M) | participants (F) |
|---|---|---|---|---|
| train | 404 | 108 | 5 | 2 |
| val | 81 | 0 | 1 | 0 |
| test | 81 | 0 | 1 | 0 |

## Corrupted, unreadable or missing files

None. Every planned video downloaded with a matching published MD5, and every downloaded video decoded and produced a keypoint sequence.

## Gaps versus the intended sample

These are deliberate bounds of the Phase 1 sample, not errors:

- **Variation subset.** Only `FL`, `LL`, `O` were downloaded (one clean baseline plus illumination and occlusion stress). The jitter variations (`LJ`, `HJ`) and `LR` (Low Resolution) are not in this sample; `LJ`/`HJ` are the two largest variations on disk and were dropped to stay inside the 40 GB download budget. Any robustness claim about camera jitter or low resolution is therefore out of scope here.
- **Participant subset.** 9 of MobiPhysio's 58 participants are included. Participants with sparse exercise coverage (roughly P24-P62) are excluded so every split covers the full label set.
- **Val/test are male-only.** Every MobiPhysio participant with full 9-exercise coverage is male; female participants were recorded for E01-E06 only. Two female participants (P09, P10) are therefore in **train only**, and the held-out val/test participants are male. Cross-gender generalisation cannot be measured from this sample and must not be claimed.
- **E07-E09 have no female examples at all** in this sample, for the same reason.
- **One held-out participant per split.** Val and test are a single participant each (P21, P22), so split-level metrics will carry wide participant-level uncertainty. A later phase should widen the held-out sets before any result is treated as a generalisation estimate.

## Pose features

Extraction reuses the production pose stack unchanged: `vision_service/app/movenet_runner.py`'s `MoveNetRunner` is imported and called directly on the same MoveNet SinglePose Lightning `.tflite` weights, with the same resize-and-pad preprocessing and the same OpenCV JPEG frame path the live replay client uses. The offline path keeps all 17 COCO keypoints rather than the three named knee-extension landmarks the `/infer` API exposes; nothing under `vision_service/app/` was modified.

Per-keypoint confidence is stored verbatim and no confidence gate is applied; the production gate value (0.6) is recorded in each sequence's metadata so a later phase can apply it explicitly.

Per-clip extraction detail (frames, source fps/resolution, mean confidence, share of keypoints at or above the production gate, decode failures) is in `ml/data/processed/mobiphysio_movenet/sequence_index.csv`.

### Measurement-quality observation

173 of 674 extracted clips have a mean keypoint confidence below 0.40. MoveNet SinglePose Lightning takes a 192x192 input and expects the person to fill much of the frame; MobiPhysio was recorded as wide full-room smartphone shots where the participant occupies a small part of the image. This is a pose-measurement quality limit of the production model on this footage, not a property of the exercises. It is recorded here as an input-quality caveat for the next phase; no crop, upscale or alternative pose model was introduced, because Phase 1 is required to keep the production pose preprocessing byte-for-byte identical.

