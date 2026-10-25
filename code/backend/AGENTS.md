# Backend development rules

Read README.md, ../../docs/software/architecture.md and ../../docs/software/data_and_interfaces.md before editing.

- Use the existing npm workspaces. Do not create a separate backend project for a module.
- Composition lives in src/server/app.ts and src/entrypoints. Imports must not start servers or connect to databases.
- Register a BackendModule from src/modules/contracts.ts. Follow jobs for HTTP/service/repository separation; create layers only with actual implementations.
- Each module owns its tables and writes. Call other modules through injected services, not their routes or tables.
- core_engine stays framework-free. Keep Fastify, Zod, SQL, filesystem and provider I/O in backend. Preserve dependency boundary checks.
- Keep Zod response schemas consistent with core DTOs and generate OpenAPI from registered routes. Do not advertise planned endpoints as implemented.
- Use RequestIdentity from a verified IdentityProvider, not request owner IDs or arbitrary headers. Private reads also check ownership. Browser writes use requireSameOrigin with a configured trusted origin.
- Real /api/v1 routes share the PUBLIC_ORIGIN write guard. Use the injected ModuleContext.requireIdentity/requireRole in module routes. Better Auth and its tables belong to the shared accounts foundation; do not add another session/token system or expose native token-bearing auth responses.
- Use ServiceError. Never log full requests, SQL parameters, credentials, private material or raw provider exceptions.
- Keep business transactions short. No model, file, queue or network calls inside them. Register task/outbox with enqueueTask(tx, input) in the same transaction as the business change.
- Delivery is at least once. Handlers obey cancellation and external idempotency. Return database-only publication via TaskOutcome.commit; recheck source versions/deletion/generation before writes.
- Unknown task types fail explicitly. Register handlers in src/entrypoints/worker.ts before enabling producers. Worker heartbeat does not mean a business handler exists.
- Add migrations instead of editing applied ones. Explain changes to shared types, schema, dependencies and service contracts in the PR.
- Preserve legacy synthetic APIs and public content exports. Never import demo fixtures into real runtime services.
- Run npm run check and npm run build:backend. test:db and test:process require a dedicated interviewlab_test* database and fail rather than skip when unavailable.
- Never commit secrets, .env, private content, dist or database volumes. Do not install skills, push or deploy unless requested.
