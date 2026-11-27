# Rehabilitation dataset landscape — research only

Owner: Lennox. Originally licensing/access research only. As of the
`AGENTS.md` change committed 2026-11-26 (`c4a22a9`), exercise-recognition
and movement-category/deviation classifiers built from permitted dataset
annotations are in scope (see `CLAUDE.md`) — **MobiPhysio is now actually
being downloaded and processed**; see `ml/data/` (`dataset_manifest.csv`,
`dataset_report.md`, `license_review.md`, `download_log.md`) for the live,
authoritative state of that work, not this table. This page stays the
license/access reference for all six datasets; it is not re-verified every
time `ml/data/` changes. Several of these datasets are real research
participants' movement data (not RehabLoop patients) — see `CLAUDE.md`'s
"Dataset and model-handling rules" for exactly which gate applies to which
kind of data (the §10 DPIA/legal-review gate is scoped to a real-patient
pilot specifically, not to using an already-licensed third-party research
dataset within its own stated scope).

| Dataset | License | Commercial use | Contents | Notes |
|---|---|---|---|---|
| WLU Rehabilitation Posture (Kaggle) | MIT (per the dataset's Kaggle license field, linking to `mit.edu/~amini/LICENSE.md`) | Yes, with attribution (MIT terms) | 339 files, 877.74 MB, blurred videos (privacy-preserving by design) across 6 folders: Arm Raise Correct (51)/Incorrect (55), Knee Extension Correct (44)/Incorrect (62), Sit To Stand Correct (79)/Incorrect (48) | **Download blocked**: license is clear (MIT), but Kaggle's dataset-download API/UI requires an authenticated account/API token not available in this environment (confirmed 2026-11-26 night: an unauthenticated request to `kaggle.com/api/v1/datasets/download/...` 302-redirects to login). Not worked around, per the rule against bypassing account/login requirements. Otherwise directly relevant to the knee-extension workflow, labelled correct/incorrect — worth revisiting if a Kaggle account/API token is ever provided. The "Code (1)" tab has a related notebook from a collaborator — not inspected here |
| REHAB24-6 (Zenodo) | CC BY-NC 4.0 | **No** — explicitly "academic or non-profit noncommercial research use only"; commercial licensing would need to be separately negotiated (contact listed: info@visioncraft.ai) | RGB video (2 synced cameras), 2D/3D skeleton joints (26/frame), 2D/3D mocap markers (41), 1,072 annotated repetitions with temporal segmentation, binary correct/incorrect labels, exercise direction + lighting annotations | Rules this out for a commercial product without separate licensing, regardless of the AGENTS.md question |
| MobiPhysio (Harvard Dataverse) | CC0 1.0 Universal (public domain dedication) | Yes, no attribution legally required (though good practice to credit the authors) | 3,688 files (v3.0), physiotherapy exercise videos (MPEG-4, ~24–76 MB each) from multiple camera angles per clip (filenames encode exercise/participant/angle, e.g. `E01_P01_AF_VFL_GM.mp4`) and multiple participants; description states each video is "labeled and categorized by exercise type, with expert guidance from certified physiotherapists" | Verified 2026-11-26 via rendered page (citation page needs JS rendering too). Authors: Iqbal, Mostafa, Ahmed, Fahim, Ahmed, Ahamad, Islam, Ryu, Song, Hossain (2025). Terms/Metadata tabs not yet opened — assessment-label detail and exact camera-angle/participant counts need a follow-up pass before any ingestion |
| Upper Limb Stroke Rehabilitation Dataset (Mendeley) | CC BY 4.0 | Yes, with attribution (Nair, Nandana, Thenmozhi Dharshini, Viswanathan — Amrita Vishwa Vidyapeetham) | 491 videos, 4 upper-limb strengthening exercises, "complete"/"incomplete" execution labels | Upper-limb, not knee-extension — would need a separate model/mapping, never merged into a knee-extension classifier per the rules in the original mission doc |
| UI-PRMD | Open Data Commons PDDL v1.0 (public domain) | Yes | **Skeletal data only, no raw video** — joint positions (mm) and angles (deg) from Vicon + Kinect, 10 healthy subjects × 10 movements × 10 reps, correct and intentionally-suboptimal versions | Useful for validating calculated joint-angle math against a reference, not for training a video-based classifier (no video exists). Citation requested (Vakanski et al. 2018, *Data*) |
| PrimSeq (NYU) | **No formal license stated for the dataset itself** — the companion GitHub code repo (`aakashrkaku/seq2seq_hrar`) is GPL-3.0, but that covers the pipeline code, not the clinical/IMU/video data | Unclear for the data — GPL-3.0 on the code doesn't establish terms for the dataset, and the SimTK project page (behind the required free account) is the only place that would state them | IMU (9 units/patient) + 2 orthogonal camera video, 41 chronic stroke patients | **Blocked**: free SimTK account required to access the actual data terms (`simtk.org/projects/primseq`) — not created, per the rule against working around account/login requirements. Checked the GitHub repo 2026-11-26 as a no-login alternative; it answers the code-license question but not the data-license question |

## Keypoint/skeleton format note

Only REHAB24-6 and UI-PRMD expose explicit skeleton data (26-joint and
Vicon/Kinect joint sets respectively) that would need mapping onto MoveNet's
COCO-17 keypoints before any comparison would be meaningful — neither
fetch above returned enough detail on exact joint ordering/naming to do that
mapping now. That mapping work, and the rest of the "Dataset Rules" checklist
(corrupted-file checks, exact usable-video counts, bias review), hasn't been
started, since it only matters once/if the underlying policy question is
resolved.
