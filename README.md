# Staxx

A personal monthly wins tracker for logging earnings, setting goals, and visualizing income sources — with optional cloud sign-in so your data follows you across devices.

## Features

- Log monthly wins with project name, amount, and source category
- Set monthly earning goals with progress bars
- 5 chart types: Bar, Line, Area, Radar, Pie
- Source breakdown with yearly/monthly views
- Custom source categories (add/remove your own)
- Dark / Light theme toggle
- CSV Import & Export (clipboard, file download, file upload)
- Works fully offline — data saved in your browser via `localStorage`
- **Optional cloud sync** — sign in with Google or email/password to sync across devices (see [Cloud sync](#cloud-sync-optional))
- Year navigation to track across multiple years
- Reset controls for individual months or full year
- Fully responsive - works on mobile and desktop

## Project Structure

```
Staxx/
├── index.html            # Vite entry (mounts the app)
├── src/
│   ├── main.ts           # Boot: load state, render, wire auth
│   ├── render.ts         # UI rendering + auth modal
│   ├── state.ts          # App state, localStorage load/save
│   ├── cloud.ts          # Supabase read/write (cloud sync)
│   ├── auth.ts           # Sign in / up / out, session handling
│   ├── supabaseClient.ts # Supabase client from env vars
│   ├── chart.ts          # Chart.js rendering
│   ├── csv.ts            # CSV import / export
│   ├── ui.ts             # Reusable input/select/pill builders
│   ├── dom.ts            # DOM helpers (el, $, fmt, gid)
│   ├── theme.ts          # Light / dark palettes
│   ├── constants.ts      # Months, sources, storage keys
│   ├── types.ts          # Shared TypeScript types
│   └── styles.css        # Global styles
├── .github/workflows/    # CI: typecheck, build, deploy to GitHub Pages
├── vite.config.ts · tsconfig.json · vercel.json
└── .env.example          # Copy to .env and add Supabase keys
```

## How to Run

```bash
git clone https://github.com/Ollie202/Staxx.git
cd Staxx
npm install
cp .env.example .env   # optional: add Supabase keys for cloud sync
npm run dev            # http://localhost:3457
```

Other scripts: `npm run build` (production build to `dist/`), `npm run preview`
(serve the build), `npm run typecheck` (TypeScript check).

> Note: cloud sign-in (Google especially) needs the app served over `http(s)`, not `file://`
> — the dev server and deployed URLs both satisfy this. See [Cloud sync](#cloud-sync-optional).

## CSV Format

**Wins:**
```
Year,Month,Project,Amount,Source
2026,Jan,My Bounty,100,Bounties
2026,Feb,Content Deal,50,Content
```

**Goals:**
```
GOAL,Year,Month,Target
GOAL,2026,Jan,500
GOAL,2026,Feb,400
```

Export from one device, import on another - your data travels with you.

## Built With

- **Vite** + **TypeScript** — build tooling and type safety
- **Chart.js** — earnings charts
- **Supabase** — authentication + Postgres for optional cloud sync
- Browser `localStorage` for offline persistence

## Cloud sync (optional)

The app runs fully offline out of the box. To enable sign-in and sync data across
devices, connect a free [Supabase](https://supabase.com) project.

**1. Create the table + row-level security** (Supabase → SQL Editor):

```sql
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "own data select" on public.user_data for select using (auth.uid() = user_id);
create policy "own data insert" on public.user_data for insert with check (auth.uid() = user_id);
create policy "own data update" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS guarantees each user can only read/write their own row — no one can see another
user's data, even with the public anon key.

**2. Add credentials as env vars** (from Supabase → Project Settings → API):

| Where | How |
| --- | --- |
| Local | Copy `.env.example` to `.env` and fill in the two values |
| Vercel | Settings → Environment Variables → add both, then redeploy |
| GitHub Pages | Settings → Secrets and variables → Actions → add both as secrets |

Only ever use the **anon / public** key (safe to expose; RLS protects the data).
Never expose the `service_role` key.

**3. Enable providers** (Supabase → Authentication → Providers): Email is on by
default; for Google, add an OAuth client and paste the callback URL Supabase shows.
Then add your app URLs (`http://localhost:3457`, your Vercel/Pages URLs) under
Authentication → URL Configuration.

## Deployment

Pushes to `main` deploy automatically to:

- **Vercel** — via its Git integration (framework auto-detected as Vite)
- **GitHub Pages** — via `.github/workflows/deploy.yml` (builds and publishes `dist/`)

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in each platform's env/secrets
to enable cloud sync in production.

## License

This project is open source and available under the [MIT License](LICENSE).
