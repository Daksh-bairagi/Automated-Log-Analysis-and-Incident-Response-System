# Test Workspace

This folder is the top-level verification workspace for the project.

It does three things:

1. Runs backend unit tests.
2. Runs backend integration tests.
3. Verifies the frontend with executable quality gates that already exist in the repo (`lint` and `build`).

## Commands

From the repo root:

```powershell
node test/run-all.cjs
node test/run-server-unit.cjs
node test/run-server-integration.cjs
node test/run-client-verification.cjs
node test/generate-component-audit.cjs
```

Or use the root scripts:

```powershell
npm test
npm run test:audit
npm run test:server:unit
npm run test:server:integration
npm run test:client
```

## What Gets Verified

- `server/tests/unit`
  - Detailed unit coverage for core analysis, parsing, notifications, repositories, auth, and orchestration.
- `server/tests/integration`
  - End-to-end HTTP, upload, websocket, and security flows.
- `client`
  - `npm run lint`
  - `npm run build`

## Reports

Running `generate-component-audit.cjs` writes:

- `test/reports/component-audit.json`
- `test/reports/component-audit.md`

These reports inventory backend and frontend source files and show the current verification path for each component.

## Note

The frontend currently does not ship with a dedicated component test runner such as Vitest + React Testing Library. This workspace therefore verifies frontend code through static and production-build checks, while the audit report makes any direct component-unit-test gaps explicit.
