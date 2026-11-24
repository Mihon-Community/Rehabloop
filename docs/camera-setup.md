# Camera setup (stub)

Owner: Steve (UI), Lennox (quality gates). Blueprint Sections 4, 5 and 7.

- Secure context required: `getUserMedia` works on HTTPS or localhost only.
- Ask for consent BEFORE calling `getUserMedia`; declining camera must still
  allow review of protocols and saved reports (non-camera review mode).
- Side view, stable mount, hip + knee + ankle of the selected leg in frame,
  even lighting, one person only. Use plain-language errors such as "Move back
  until your full leg is visible."
- Sample frames at a configurable 5–10 fps (`VITE_FRAME_SAMPLE_RATE`,
  `MAX_FRAME_RATE`). Use timestamps, not frame counts, for tempo.
- A low-confidence or missing landmark fails the quality gate: no rep is
  counted and no angle is invented. Never smooth an invalid point into a
  plausible-looking value.
- Do not imply the camera alignment is clinically certified.
