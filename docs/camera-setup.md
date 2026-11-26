# Camera setup and live session

The frontend camera flow is implemented in `frontend/src/features/sessions/`.
This is a testable prototype; have Steve review the UI and consent wording before
merging it into the shared product branch.

## Start a local test

- Run the Compose stack and open `http://localhost:5173`.
- Choose **Continue as synthetic patient** in a development build. The backend
  must use `APP_ENV=local` and `AUTH_MODE=dev`; its auth verifier remains the
  authority and rejects this token outside local mode.
- Choose **Start session**, accept the camera-processing notice, enable the
  preview, confirm the framing checklist, and start the session.
- For Supabase Auth, sign in as a patient who has an active assigned protocol.
  The signed-in patient's RLS-scoped Supabase client creates the consent row.

`getUserMedia` requires a secure context: HTTPS or localhost. The UI asks for
consent before the browser camera prompt. Declining camera access returns to
patient home and leaves non-camera routes available.

## Live processing behavior

- The browser captures JPEG frames in memory and samples at the configured rate,
  capped at 8 frames per second for the current backend default. Frames are sent
  on the session WebSocket. `STORE_RAW_VIDEO` remains false; no video file is
  stored.
- Keep the camera steady and side-on, with one person and the hip, knee, and
  ankle on the selected side visible. The checklist is user-confirmed; the UI
  cannot validate the camera angle by itself.
- The live screen displays repetition counts, rounded projected 2D knee-angle
  estimates, quality feedback, and simulated-fixture labels. Invalid quality
  events do not display an angle.
- Pause closes the stream and stops camera tracks. Resume obtains camera access
  again and requests a fresh session stream token. End closes the session and
  stops the camera.
- The current WebSocket contract does not send landmarks to the browser, so a
  skeleton overlay is not available. Adding one requires a shared API contract
  change and Steve's review.

Fixture mode is labelled simulated and checks plumbing only. A generated
synthetic image or browser fake-camera pattern does not test clinical accuracy.
