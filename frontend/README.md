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
appear here. Build UI against `src/lib/mocks/` (all events labelled simulated),
then swap to `sessionStreamUrl()` from `src/lib/api.ts`.
