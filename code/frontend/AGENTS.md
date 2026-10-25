<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared integration rules

- Read README.md and ../backend/README.md before adding real module integration.
- Use lib/api/http.ts and shared core DTOs. Browser routes are relative to /api/v1; do not hardcode API hosts or create a second fetch/token client.
- RootLayout already provides SessionProvider. Use useSession and authClient; never store session tokens in browser storage or treat a failed session lookup as authenticated.
- /api/v1 proxies to Fastify. /api/demo/v1 and lib/demo remain explicit synthetic adapters; never fall back to them after a real API error or automatically upload their personal material.
- Module owners implement their loading, empty, error and retry states and verify resource permissions on the server.
- Keep DATABASE_URL and BETTER_AUTH_SECRET server-only. Coordinate shared DTO, proxy and authentication changes with the foundation owner.
