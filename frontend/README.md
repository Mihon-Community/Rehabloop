# RehabLoop frontend (Steve, `feature/steve`)

Vite + React + TypeScript. See `../docs/frontend_guide.md` before changing anything.

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # Vitest smoke test
npm run lint && npm run typecheck && npm run build
```

Public config only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_API_BASE_URL`, `VITE_FRAME_SAMPLE_RATE`. The service-role key must never
appear here.

## Try a camera session locally

1. Start the Compose stack and open `http://localhost:5173` (camera permission
   is available on localhost; remote browsers need HTTPS).
2. In a development build, choose **Continue as synthetic patient**. This works
   only when the backend is configured with `APP_ENV=local` and `AUTH_MODE=dev`.
   For Supabase Auth, sign in with a patient account that has an active assigned
   protocol.
3. Open **Start session**, accept the camera-processing notice, enable the
   preview, confirm the framing checklist, then start the session.
4. Allow camera permission in the browser. Pause stops the camera; Resume asks
   for camera access again. End closes the stream and opens the result route.

The synthetic patient and fixture vision mode are for plumbing tests only. A
simulated event is labelled in the live screen and is not real movement
measurement. The current stream API returns numeric estimates and quality
events, but no pose landmarks, so the live screen does not draw a skeleton.
Camera frames are sent transiently for processing; raw video is not stored.
