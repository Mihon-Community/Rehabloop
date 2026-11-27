# Dataset licence review — Phase 1 (ML data acquisition)

Per `AGENTS.md`'s dataset-verification rule, licence and consent terms are
checked *before* anything is downloaded. A `license_class` label is a summary
of that check, never a substitute for it.

Broader licence survey of the six candidate rehabilitation datasets lives in
`docs/rehab_dataset_landscape.md` — this file does not duplicate it and only
records the terms of what Phase 1 actually ingested, plus the one dataset that
remains unobtainable here.

## Ingested: MobiPhysio v1.1

| Field | Value |
|---|---|
| Dataset | MobiPhysio — 2D smartphone video dataset of physiotherapy exercises |
| Repository | Harvard Dataverse |
| DOI | `doi:10.7910/DVN/XSI0QN` |
| Licence | **CC0 1.0 Universal** (`CC0-1.0`, SPDX), public-domain dedication |
| Licence URI | <http://creativecommons.org/publicdomain/zero/1.0> |
| `license_class` | `commercial_ok` |
| Attribution | Not legally required under CC0; credited anyway as good practice (citation below) |
| Access | Anonymous HTTP `GET https://dataverse.harvard.edu/api/access/datafile/{id}` — no account, no API token, no data-use agreement to accept |
| Restricted files | None in the published listing (`restricted: false`, `fileAccessRequest` flags are unused for public access) |
| Verified | Licence read directly from the Dataverse dataset-version metadata captured in `ml/data/raw/mobiphysio/dataset_metadata.json` (`data.license`), not from a third-party summary |

### What CC0 permits here

CC0 is a public-domain dedication: the depositors waived copyright and
neighbouring rights worldwide, for any purpose, including commercial use and
derivative works, with no attribution condition and no share-alike condition.
That covers everything Phase 1 does — downloading the videos, deriving
keypoint sequences from them, and retaining those derived features — and it
covers a later phase training a model on those derived features.

### Consent, ethics and intended-use match

- The dataset's own codebook (`ml/data/raw/mobiphysio/MobiPhysio_README.md`)
  states ethics approval and consent are documented in the accompanying
  *Data in Brief* data descriptor; the depositors published the footage openly
  under CC0 on that basis. These are consenting research participants
  performing prescribed exercises, not patients recorded in care.
- Stated purpose of the dataset is "research and development of AI-driven
  exercise assessment and monitoring using low-cost 2D camera devices". Phase 1
  (keypoint feature extraction for exercise recognition / repetition work) is
  inside that stated purpose.
- **Not RehabLoop patient data.** Nothing from this dataset is patient data,
  and no real patient footage or patient data was downloaded, processed or
  stored at any point in this phase. The DPIA/legal-review gate in
  `docs/backend_guide.md` §10 is scoped to a real-patient pilot and is
  untouched by this work; it still blocks real-patient use regardless of what
  model code exists.

### Annotation scope (important)

The EAAQ annotations are **physiotherapist-assessed exercise-execution
accuracy** scores (0–100) produced by three certified physiotherapists using
the dataset's own Exercise Accuracy Assessment Questionnaire. They describe how
closely a recorded movement matched the exercise's defined execution pattern.
They are **not** a clinical assessment, diagnosis, injury indication, danger
rating, recovery measure or prognosis, and must never be presented, labelled or
modelled as any of those. This is the `AGENTS.md` boundary that the commit
`c4a22a9` policy update explicitly kept in force.

### Storage and Git

Videos and derived keypoint sequences stay out of Git —
`ml/data/raw/` and `ml/data/processed/` are both in `.gitignore`. Only the
manifests, reports and logs directly under `ml/data/` are tracked.

### Citation (not required by CC0; given as good practice)

```text
[1] M. T. B. Iqbal et al., "MobiPhysio," Harvard Dataverse, 2025,
    doi:10.7910/DVN/XSI0QN.
[2] M. T. B. Iqbal et al., "MobiPhysio: A 2D Video Dataset of Physiotherapy
    Exercises for AI-Driven Assessment and Monitoring," Data in Brief
    (manuscript), 2025.
```

## Still blocked: WLU Rehabilitation Posture (Kaggle)

Not used in Phase 1 and not attempted again.

- Licence is **not** the blocker — it is MIT (permissive, commercial use with
  attribution). That licence finding is already recorded in
  `docs/rehab_dataset_landscape.md`; see that file rather than this one for it.
- **Access is the blocker.** Kaggle dataset downloads require a signed-in
  Kaggle account and an API token, which this environment does not have and
  which is exactly the kind of account/login barrier `AGENTS.md` says not to
  work around. Obtaining it needs credentials only the project owner can
  supply.
- Consequence for Phase 1: no "correct/incorrect" labelled knee-extension
  footage is available, so the sample is MobiPhysio-only. Picking WLU up later
  needs a Kaggle API token added deliberately by the owner, after which its MIT
  attribution requirement must be honoured (unlike CC0 MobiPhysio).

## Other candidates — not ingested in Phase 1

No other dataset was downloaded. In particular REHAB24-6 is CC BY-NC 4.0
(non-commercial), which does **not** fit `commercial_ok` and must not be mixed
into this corpus without a separate, explicit decision. See
`docs/rehab_dataset_landscape.md` for the full table.
