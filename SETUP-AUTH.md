# Cloud sync setup (Supabase)

The app works fully offline out of the box (data in your browser's `localStorage`).
To sign in and sync your wins across devices, connect a free Supabase project.
Sign-in methods included: **Google** and **Email + password**.

---

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free tier is plenty).
2. Create a new project. Pick any name and a database password.
3. Wait ~2 minutes for it to provision.

## 2. Create the data table

Open **SQL Editor** in your Supabase dashboard, paste this, and click **Run**:

```sql
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "own data select" on public.user_data
  for select using (auth.uid() = user_id);
create policy "own data insert" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "own data update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Row Level Security ensures each user can only ever read/write their own row.

## 3. Paste your API keys into the app

In Supabase go to **Project Settings → API** and copy:

- **Project URL**
- **anon / public** key (safe to expose in the browser — RLS protects the data)

Open `index.html` and replace the placeholders near the top of the `<script>`:

```js
const SUPABASE_URL="https://YOUR-PROJECT.supabase.co";   // ← your Project URL
const SUPABASE_ANON_KEY="YOUR-ANON-KEY";                 // ← your anon key
```

## 4. Enable sign-in methods

In Supabase → **Authentication → Providers**:

### Email + password
- Enabled by default. Nothing to do.
- Tip: while testing, you can turn **off** "Confirm email" (Authentication → Providers → Email)
  so new accounts log in immediately without the confirmation email.

### Google
1. Create a Google OAuth client at https://console.cloud.google.com/apis/credentials
   → **Create Credentials → OAuth client ID → Web application**.
2. Under **Authorized redirect URIs**, add the callback shown in Supabase's Google
   provider settings (looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
3. Copy the **Client ID** and **Client Secret** into Supabase → Authentication →
   Providers → Google, and enable it.

## 5. Allow your app's URL (redirects)

In Supabase → **Authentication → URL Configuration**, add your app's address to
**Site URL** and **Redirect URLs**, e.g. `http://localhost:8000` (local) and your
deployed URL if you host it.

> **Important:** Google sign-in needs an `http://` or `https://` origin — it does **not**
> work when the file is opened directly as `file:///...`. Run it from a local server
> (below) or deploy it. Email/password works either way.

## 6. Run it locally

From the project folder:

```bash
# Python
python -m http.server 8000

# or Node
npx serve -l 8000
```

Then open http://localhost:8000 and click the person icon (top-right) to sign in.

---

## How sync works

- All changes save to `localStorage` **and** (when signed in) to your Supabase row,
  debounced by ~0.8s.
- On sign-in, your cloud data loads and replaces the local view. If your account has no
  cloud data yet, whatever is currently local is uploaded (a one-time migration).
- Signing out returns the app to local-only mode; your browser copy stays intact.
