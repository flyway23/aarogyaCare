# Project progress

## Phases done

- Phase 0 — Foundation.

## Decisions

- Windows development environment; use `npm.cmd` in PowerShell because `npm.ps1` is blocked by the local execution policy.
- Docker is installed. Demo payment mode is `MOCK_PAYMENTS=true`.
- The workspace currently reports Node v24.21.0; project requirements call for Node 20.
- The supplied workspace was not a Git repository at the beginning of Phase 0; Git was initialized for the required phase commit.

## How to run

Follow Phase 0 setup in `README.md`: copy `.env.example` to `.env`, start Docker Desktop and Compose services, install npm workspaces, generate the Prisma client, apply the migration, then run `npm.cmd run dev:api` and `npm.cmd run dev:web` in separate terminals.

## Known issues

- The installed runtime is Node v24.21.0; `masterprompt.md` specifies Node 20.
- npm reported 6 dependency vulnerabilities (1 moderate, 3 high, 2 critical).

## Checks already passing

- `npm.cmd test`: 2 tests pass.
- `npm.cmd run lint`: passes.
- `npm.cmd --workspace apps/web run build`: passes.
- `npm.cmd run format:check`: checks project files without modifying `masterprompt.md`.
- `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`: passes.
- `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`: applies the initial migration.
- `GET http://localhost:3000/api/health`: returns `{ "success": true, "data": { "status": "ok" } }` with PostgreSQL and Redis connected.
- `GET http://localhost:5173`: returns HTTP 200.

## Next phase

- Phase 1 — Auth, roles, and audit. Begin only after the user replies `continue`.
