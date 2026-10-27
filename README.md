# Receipt Portal — Frontend

React + TypeScript (Vite) frontend for the [Receipt Issuance App API](https://reciept-app-2n43.onrender.com/docs).
Lets a landlord/business owner (or authorized staff) sign in, issue and manage receipts, and
send them to payers by email/SMS — talking directly to the deployed FastAPI backend.

## Stack

- React 19 + TypeScript, Vite
- react-router-dom for routing
- No UI framework — a small hand-rolled component/design system (`src/components/ui`)
- Auth: JWT stored in `localStorage`; role (`owner` / `admin` / `staff`) is read from the token
  to drive role-based UI

## Project structure

```
src/
  api/            Typed functions per backend resource (auth, tenant, customers, receipts)
  auth/           AuthContext (session/JWT) + permissions.ts (role → capability map)
  components/     Shared UI: layout/AppShell, ui/ primitives, RoleGate, ProtectedRoute, toasts
  lib/            apiClient (fetch wrapper + error handling), shared types, formatting helpers
  pages/          One file per route, plus pages/auth/ for the unauthenticated flows
```

## Roles & permissions

After login the portal loads `/users/me` (permission flags and assigned properties) through
`src/auth/AccessContext.tsx`. Navigation, page guards (`src/components/RequirePerm.tsx`) and
buttons use it only to decide what to show; the API enforces every rule itself. The full matrix
is in `reciept_app_api/docs/roles-and-permissions.md`.

| Capability | Owner | Admin | Staff |
|---|---|---|---|
| Properties | all, manage | all, manage | assigned only, read |
| Team (add staff, permissions, deactivate) | ✅ | staff only | – |
| Tenants, tenancies, tenant KYC | ✅ | ✅ | on assigned properties (`renters.manage`) |
| KYC review | ✅ | ✅ | tenants on assigned properties (`renters.kyc_review`) |
| Receipts / invoices / quotations | ✅ | ✅ | by permission flag; property-linked ones only for assigned properties |
| Customers | ✅ | ✅ | by permission flag |
| Business settings, audit log | ✅ | ✅ | 🔒 read-only settings, no audit log |

Staff still see the Business page (so they can see the details printed on receipts) but every
edit control is locked.

## Setup

```bash
npm install
cp .env.example .env   # points at the deployed API by default
npm run dev
```

`VITE_API_BASE_URL` controls which backend the app talks to (defaults to the deployed Render
instance). Point it at `http://localhost:8000` to run against a local backend instead.

## Build

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test        # Vitest + Testing Library (jsdom)
npm run lint
```

## Known backend requirement: CORS

The deployed API did not have CORS enabled, which blocks all browser requests from this
frontend regardless of how it's hosted. `app/main.py` and `app/core/config.py` in the `server/`
project now add `CORSMiddleware`, configured via a `CORS_ALLOW_ORIGINS_RAW` env var
(comma-separated origins). This must be set in Render (or wherever the API is deployed) to
include this frontend's URL, and the backend redeployed, before the portal can reach it.
