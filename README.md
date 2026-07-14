# Staxxs

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
- **Optional cloud sync** — sign in with Google to sync across devices (see [Cloud sync](#cloud-sync-optional))
- Year navigation to track across multiple years
- Reset controls for individual months or full year
- Fully responsive - works on mobile and desktop

## Project Structure

```
Staxxs/
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
git clone https://github.com/Ollie202/Staxxs.git
cd Staxxs
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
  account_email text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data add column if not exists account_email text;
alter table public.user_data enable row level security;

update public.user_data
set account_email = lower(auth.users.email)
from auth.users
where public.user_data.user_id = auth.users.id
  and public.user_data.account_email is null;

create unique index if not exists user_data_account_email_key
on public.user_data (account_email);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
revoke all on public.user_data from anon;

drop policy if exists "own data select" on public.user_data;
drop policy if exists "own data insert" on public.user_data;
drop policy if exists "own data update" on public.user_data;
drop policy if exists "own data delete" on public.user_data;
drop policy if exists "own email data select" on public.user_data;
drop policy if exists "own email data insert" on public.user_data;
drop policy if exists "own email data update" on public.user_data;
drop policy if exists "own email data delete" on public.user_data;

create policy "own email data select"
on public.user_data for select
using (account_email = lower(auth.jwt() ->> 'email'));

create policy "own email data insert"
on public.user_data for insert
with check (
  user_id = auth.uid()
  and account_email = lower(auth.jwt() ->> 'email')
);

create policy "own email data update"
on public.user_data for update
using (account_email = lower(auth.jwt() ->> 'email'))
with check (
  user_id = auth.uid()
  and account_email = lower(auth.jwt() ->> 'email')
);

create policy "own email data delete"
on public.user_data for delete
using (account_email = lower(auth.jwt() ->> 'email'));
```

RLS guarantees each user can only read/write the row for their verified email,
even with the public anon key. Keeping `account_email` lets Google sign-in and
Keep Google sign-in enabled, and do not enable users without an email.

### Production readiness notes

Staxxs stores one `user_data` row per account. That row contains the user's wins,
goals, sources, and profile in a JSON blob. This is intentionally simple and is
fine for a small public launch: 500 users is well within Supabase's normal free
plan limits if each person is only tracking ordinary monthly entries and a small
profile image.

Cloud sync behavior:

- Signed-out users save locally in the browser.
- A brand-new signed-in user uploads their local data as their first cloud row.
- A returning user loads their existing cloud row when they sign in.
- If a signed-in user makes a local change and closes the page before the cloud
  write finishes, Staxxs keeps a timestamp and preserves the newer same-account
  local copy on the next open.
- Failed cloud writes stay pending and retry when the browser comes back online.

Known tradeoff: if the same account edits data on two devices at the same exact
time, the latest saved copy wins. For heavier collaboration-style usage, split
wins/goals into separate database rows instead of one JSON profile row.

Before a larger launch, run Supabase Security Advisor and Performance Advisor,
keep RLS enabled, protect the Supabase/GitHub/Vercel owner accounts with 2FA, and
upgrade to Pro if you need guaranteed no-pausing, backups, or support.

**2. Add credentials as env vars** (from Supabase → Project Settings → API):

| Where | How |
| --- | --- |
| Local | Copy `.env.example` to `.env` and fill in the two values |
| Vercel | Settings → Environment Variables → add both, then redeploy |
| GitHub Pages | Settings → Secrets and variables → Actions → add both as secrets |

Only ever use the **anon / public** key (safe to expose; RLS protects the data).
Never expose the `service_role` key.

**3. Enable providers** (Supabase → Authentication → Providers): enable Google,
add an OAuth client, and paste the callback URL Supabase shows. Disable Email
provider unless you are ready to support password resets and email deliverability.
Then add your app URLs (`http://localhost:3457`, your Vercel/Pages URLs) under
Authentication → URL Configuration.

## Deployment

Pushes to `main` deploy automatically to:

- **Vercel** — via its Git integration (framework auto-detected as Vite)
- **GitHub Pages** — via `.github/workflows/deploy.yml` (builds and publishes `dist/`)

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in each platform's env/secrets
to enable cloud sync in production.

## Recovering data from old Vercel domains

Browser localStorage belongs to one exact domain. Data saved on
`wins-tracker-app.vercel.app` cannot be read directly by `staxxs.vercel.app`.
To recover users who saved data on an old domain:

1. In Vercel, point the old alias (`wins-tracker-app.vercel.app`) to the current
   Staxxs project.
2. Deploy this current code to that alias.
3. Ask the user to open the old URL once in the same browser/device where their
   data existed.
4. The old URL will read its own localStorage, redirect to
   `https://staxxs.vercel.app/`, and import the data there.

This cannot be done with a script tag from only the new domain because browsers
block one domain from reading another domain's localStorage.

## License

This project is open source and available under the [MIT License](LICENSE).
