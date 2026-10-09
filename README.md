# ZemFi Admin

Internal support and operations console for **ZemFi** (the consumer product).
It is a thin client over [railz-backend](https://github.com/Dutchman-io/railz-backend)'s
admin API (`/admin/*`): user lookup with Bridge-side KYC/wallet state,
withdrawals, 2FA reset, KYC refresh, and the support inbox. It holds no data of
its own.

Sibling of Bridge's `admin-app` (same stack: Next.js 16 App Router, React 19,
TypeScript, Tailwind v4 via PostCSS) but a separate deployment for a separate
product — a ZemFi support agent never sees Bridge's control centre.

## Pages

| Route                      | What it shows                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `/login`                   | Email + password → `POST /admin/auth/login`                                                       |
| `/dashboard`               | Stat tiles (`GET /admin/stats`) and the latest open tickets                                       |
| `/dashboard/users`         | Searchable user list with cursor paging                                                           |
| `/dashboard/users/[id]`    | Profile, Bridge snapshot (KYC records, balances, deposit addresses, virtual account), withdrawals; Reset 2FA and Refresh KYC actions |
| `/dashboard/support`       | Tickets by status tab, with customer and last-message preview                                     |
| `/dashboard/support/[id]`  | Message thread, reply box, status select, link to the customer's user page                       |
| `/dashboard/features`      | ZemFi's own switches: set each to Live / Coming soon / Off with the message customers are shown. Taking one away is confirmed first |
| `/dashboard/admins`        | Staff accounts (owner-only): add an admin, change a role, deactivate/reactivate, set a password  |
| `/dashboard/kyc`           | The verification backlog by status, longest-waiting first, each row opening the customer         |
| `/dashboard/audit`         | What staff did (owner-only): filterable by action and admin, each target clickable               |

## Auth

The access token from `/admin/auth/login` is kept in `localStorage`
(`railz_admin_token`) and sent as `Authorization: Bearer …`. Every
`/dashboard/*` page is wrapped by a client-side `RequireAdmin` guard that
verifies the token with `GET /admin/me` before rendering; any `401` from the
API clears the token and returns the browser to `/login`.

## Environment

| Variable                    | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_RAILZ_API_URL` | Base URL of railz-backend's API. Defaults to `https://app.zemfi.ng/api/v1`. |

Copy `.env.example` to `.env.local` for local development. Because the value is
inlined at build time (`NEXT_PUBLIC_*`), rebuild after changing it.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks that CI runs (`.github/workflows/ci.yml`) and that must pass before
pushing:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Deploy

Same shape as Bridge's `admin-app`: it is a plain Next.js app with no server
state, so build it with the production API URL set and serve the output with
`next start` (behind the existing reverse proxy / PM2 setup) or any host that
runs Next.js.

```bash
NEXT_PUBLIC_RAILZ_API_URL=https://app.zemfi.ng/api/v1 npm run build
npm start
```

---

Dutchman Network Limited
