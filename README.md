# AarogyaCare

AarogyaCare is a single-hospital management web app built as a college project demo. It is being developed in phases; see [PROGRESS.md](PROGRESS.md) for the current phase and setup state.

## Phase 0 setup

Requirements: Node.js 20, npm, and Docker Desktop with Compose.

1. Copy `.env.example` to `.env`.
2. Start Docker Desktop, then start PostgreSQL and Redis: `docker compose up -d`.
3. Install dependencies: `npm.cmd install` (PowerShell) or `npm install`.
4. Generate the Prisma client: `npm.cmd --workspace apps/api run prisma:generate`.
5. Apply the initial database migration: `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
6. Start the API in one terminal: `npm.cmd run dev:api`.
7. Start the web app in another terminal: `npm.cmd run dev:web`.
8. Open http://localhost:5173.

The browser app calls `GET /api/health` through Vite's local proxy. The API health response checks PostgreSQL and Redis.

## Checks

- Run API tests: `npm.cmd test`.
- Check lint: `npm.cmd run lint`.
- Check formatting: `npm.cmd run format:check`.

## Configuration

See `.env.example`. `MOCK_PAYMENTS=true` is selected for the demo.
