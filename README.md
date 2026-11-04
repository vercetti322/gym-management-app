# Gym Management App

A small, private dashboard for managing gym memberships and tracking plan renewals and payments. The app runs on Cloudflare Workers, with a React interface and a D1 database.

## Features

- Password-protected access with session cookies.
- Create members with a phone number, address, profession, usual AM/PM visit time,
  membership dates, and payment method.
- Edit member details inline one field at a time, including plan, start date,
  phone, amount, and profile fields. Expiry date and payment method are not
  editable from the member details view. Editing the plan duration or start
  date recalculates the expiry date and membership status. Existing members may
  leave address, profession, and usual visit time blank.
- Search and browse active members, and filter members whose plans are due or expired.
- Renew plans or deactivate members; membership and payment history is retained.
- Add or change member profile photos; images are resized and compressed before upload.
- Display a UPI payment QR code when creating or renewing a membership.
- Refresh member data without reloading the page.

## Stack

- React 19, TypeScript, Vite, Mantine
- Hono API on Cloudflare Workers
- Cloudflare D1 (SQLite)

## Run locally

Requirements: Node.js and npm.

```bash
npm install
```

Set the local admin password in a root-level `.dev.vars` file:

```dotenv
ADMIN_PASSWORD=choose-a-local-password
```

Apply the database migrations and start the development server:

```bash
npm run db:migrate
npm run dev
```

Open the local URL printed by Vite (usually <http://localhost:5173>) and sign in with the password from `.dev.vars`.

Optional: load sample members into the local database:

```bash
npm run db:seed
```

**Warning:** `seed.sql` deletes existing member and plan-history rows before inserting sample data. Use it only when it is safe to reset the local database.

## Deploy

The Wrangler configuration points to the `gym-tracker-db` D1 database. Before deploying, make sure it belongs to your Cloudflare account and is configured in `wrangler.json`.

Apply remote migrations, set the admin password as a Worker secret, then build and deploy:

```bash
npm run db:migrate:remote
npx wrangler secret put ADMIN_PASSWORD
npm run build
npm run deploy
```

Wrangler will prompt for the secret value. Do not commit `.dev.vars` or passwords to source control.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite/Workers development environment |
| `npm run build` | Type-check and build the Worker and client |
| `npm run preview` | Build and preview the production app locally |
| `npm run lint` | Run ESLint |
| `npm run check` | Build and run a Wrangler deployment dry run |
| `npm run db:migrate` | Apply migrations to the local D1 database |
| `npm run db:migrate:remote` | Apply migrations to the configured remote D1 database |
| `npm run db:seed` | Reset and seed the local database |
| `npm run db:seed:remote` | Reset and seed the remote database — destructive |

## API

Login and logout are public endpoints. All other `/api/*` routes require a valid session.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/login` | Sign in with the admin password |
| `POST` | `/api/logout` | End the current session |
| `GET` | `/api/auth/me` | Verify the current session |
| `GET` | `/api/members` | List active members with their latest plan |
| `GET` | `/api/members/:id` | Get a member |
| `POST` | `/api/members` | Create a member and initial plan |
| `PUT` | `/api/members/:id/details` | Update one member or latest-plan field |
| `POST` | `/api/members/:id/renewals` | Add a plan renewal |
| `PATCH` | `/api/members/:id` | Deactivate a member |
| `PUT` | `/api/members/:id/photo` | Save or replace a member photo |
| `GET` | `/api/members/:id/photo` | Get a member photo |

## Data model

- `member_details` stores each member and whether they are active.
- `member_details.photo_data` stores an optional profile photo.
- `member_details.address`, `profession`, and `visit_time` are nullable for existing
  records; the New Member form requires all three values.
- `member_plan_audit` stores plan and payment records; each renewal adds a record rather than overwriting history.
- `sessions` stores expiring session-token hashes.

Migrations are in `migrations/`. The local and remote database commands use the D1 binding configured in `wrangler.json`.
