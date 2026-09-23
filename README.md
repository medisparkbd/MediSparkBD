# MediSpark (medisparkbd.com)

HSC academic & medical admission preparation platform.
Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS.

## Architecture

| Layer | Service |
|---|---|
| Web app | Vercel — project `medisparkbd` (auto-deploys on push to `main`) |
| Database | **Primary:** VM MariaDB `20.219.193.182:3306` (`bloodare_medispark`, non-TLS, 50 conn, nightly backup to `/var/backups/mysql/`) · **Legacy/fallback:** Azure Database for MySQL Flexible Server (`eduall2005pass.mysql.database.azure.com:3306`, TLS enforced) |
| Media files | `medispark` VM (`medispark.duckdns.org`) — nginx serves `/var/www/medispark-uploads/`, upload service on `127.0.0.1:4021` |
| Auth | Firebase (Google sign-in, project `medisparkgo`) |

- All application data lives in **MySQL** (VM primary, Azure fallback). No Firestore/Supabase/local-disk storage.
- Uploaded media (logo, banners, course images, profile pictures, audio) live on the
  VM disk; only their URL is stored in MySQL. Legacy `/api/files/<id>` route still
  serves a few old rows from the `uploads` table.
- Admin authorization = row in the `admins` table. Matching is by Firebase UID **or**
  verified email (see `src/lib/admin.ts`) so access survives Firebase project changes.

## Repository / deploy flow

- Single repo: `medisparkbd/MediSparkBD` — every push to `main` auto-deploys to Vercel (when linked) and runs against VM MariaDB `20.219.193.182:3306` (persistent, see `deploy/vm-mysql-migration.md`) + medispark.duckdns.org.
- **Never force-push.** If a push is rejected: `git pull --rebase medisparkbd main` first, then push again.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in credentials (never commit .env)
pnpm dev               # http://localhost:3000
```

Useful commands:

```bash
npx tsc --noEmit   # typecheck (rm -rf .next first if stale errors appear)
pnpm build         # production build
vercel --prod      # manual production deploy (usually not needed)
```

## Environment variables

Set locally in `.env`, in production via Vercel project settings:

| Variable | Purpose |
|---|---|
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL connection — `20.219.193.182:3306` (VM) or `eduall2005pass.mysql.database.azure.com:3306` (Azure). Set `MYSQL_SSL=false` for VM, omit/`true` for Azure (see `src/lib/mysql.ts:40`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … | Firebase web config (project `medisparkgo`) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin (token verification) |
| `MEDIA_UPLOAD_TOKEN` | Shared secret between app and the VM upload service |
| `MEDIA_FILES_BASE_URL` / `MEDIA_UPLOAD_URL` / `MEDIA_DELETE_URL` | Media endpoints (`https://medispark.duckdns.org/…`) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push notifications |

Secrets live outside the repo (local `.env` / Vercel dashboard). **Never commit them.**

## Database schema

Schema and migrations live in `src/sql/*.sql`. After changing the schema:

1. Add/update a migration file in `src/sql/`
2. Apply it (VM primary, Azure fallback):

   ```bash
   # VM (primary, persistent) — direct:
   mysql -h 20.219.193.182 -P 3306 -u siam -p bloodare_medispark < src/sql/<file>.sql
   # tunnel fallback: ssh -L 3309:localhost:3306 -N siam@20.219.193.182 &; mysql -h 127.0.0.1 -P 3309 ...
   # Azure fallback (if needed):
   mysql --ssl -h eduall2005pass.mysql.database.azure.com -P 3306 -u siam -p bloodare_medispark < src/sql/<file>.sql
   ```

Note: the Azure server has GIPK (generated invisible primary keys) enabled —
tables without an explicit PK get a hidden `my_row_id`. Real keys are added as
`uq_<table>_pk` UNIQUE indexes; follow that pattern for new tables. VM MariaDB
has GIPK off, so no hidden column — same `uq_*_pk` pattern works.

## Key source paths

- `src/lib/mysql.ts` — DB pool + query helpers (TLS-aware)
- `src/lib/storage.ts` — media save/delete (forwards bytes to the VM service)
- `src/lib/admin.ts` — admin auth gate (`requireAdmin`, `requirePermission`)
- `server/medifiles-server.mjs` + `deploy/*` — VM-side file service & nginx config
