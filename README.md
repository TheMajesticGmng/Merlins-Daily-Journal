# 🌙 Merlin's Daily Handbook

A mobile-friendly, celestial blue-and-gold puppy care planner with a 24-hour visual timeline, editable sleep/activity blocks, potty & meal logs, training notes, history and optional private cloud accounts.

**It includes both of Merlin's routines:** the original handwritten Post-it schedule **(16 hours of possible sleep after overnight outings)**, and an optional **18-hour rest experiment**, which adds two hours of daytime sleep opportunity. Neither plan guarantees actual sleep.

## Features

- Color-coded 24-hour schedule (7 AM to 7 AM), including **2 AM and 6:30 AM** 15-minute potty outings, 2 PM and 8 PM outings, and three meals.
- Edit, remove and add blocks for **sleep, potty, walk, play, training, meal, enrichment, socialization, grooming, cuddles and settling**. Custom blocks support 5-minute intervals.
- Mark each nap as slept, then **adjust actual minutes**; separately totals *scheduled sleep* and *logged actual sleep*.
- Mark other scheduled activities completed.
- Quick daily journal for **potty: pee / poop / both / neither**, accidents, meal times/portions, training, crate practice, grooming, socialization, medication, behavior and other events.
- Daily mood, long notes, previous-day history and JSON export.
- Optional Supabase email/password login, private data sync across devices and per-user pet profile.
- A local preview that works without any backend—but stays **unencrypted in that browser**.

## Local run

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open the displayed `localhost` URL. Without cloud configuration, the app runs in **local preview** and saves only to localStorage. Its data can disappear if browser storage is cleared. Use **Settings → Export** for backup.

## Enable secure sign-in and cloud saving (Supabase)

GitHub alone hosts code, not a private per-user database. To enable login you must connect a Supabase project:

1. Create a project at https://supabase.com. Choose a strong dashboard password and enable multi-factor authentication on your Supabase account.
2. Open **SQL Editor** and execute `supabase/schema.sql`. This creates `profiles` and `day_records` and enables **Row Level Security** so authenticated users can access **only their own rows**.
3. In **Authentication → Providers → Email**, configure signup and email confirmation. In **Authentication → URL Configuration**, set the site URL and add your future GitHub Pages URL to Redirect URLs, including the final trailing slash, e.g. `https://themajesticgmng.github.io/Merlins-Daily-Journal/`. Supabase also allows `http://localhost:5173/` for local testing.
4. Get your **Project URL** and **publishable key** (or legacy **anon** key) from **Project Settings → API**. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
   ```

5. Start `npm run dev`, then create an account in the app. Email confirmation may be required before signing in.
6. **NEVER put a Supabase service_role / secret key in the app, GitHub Pages variables or any `VITE_` variable.** Vite embeds these in publicly accessible browser JavaScript.

### How the security works

- Supabase Auth handles password processing and sessions; this app never stores raw account passwords in your database.
- All Supabase API requests use **HTTPS (TLS)** in transit; the provider encrypts stored database data at rest.
- PostgreSQL **Row Level Security** restricts every profile and date record by `auth.uid()`; public browser publishable keys **cannot bypass those policies**.
- The frontend does **not** implement end-to-end encryption. Supabase administrators/project owners could technically access stored data.
- GitHub Pages serves **public app code**; it never stores your journal entries in the repository. Secrets must remain out of source control.
- Accounts are **individual**, not automatically shared. Household sharing requires an additional access-control design; don't share passwords to work around this.
- Treat JSON exports and local preview data as **unencrypted sensitive files**.

## Deploy on GitHub Pages

The included GitHub Actions workflow builds the app and deploys it automatically.

1. The source has been prepared for [`TheMajesticGmng/Merlins-Daily-Journal`](https://github.com/TheMajesticGmng/Merlins-Daily-Journal). Confirm the project files are on `main`. Never upload `node_modules` or `.env.local`.
2. In **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values from Supabase. They are public browser config values, not privileged secrets.
3. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Push to `main` or manually run the `Deploy handbook to GitHub Pages` workflow. The action sets Vite's site base path from your actual repo name.
5. Confirm the published Pages URL, then register it under Supabase **Authentication → URL Configuration** as described above.
6. Test account sign-up, sign-in, saving a note, changing date, refreshing, signing out and signing back in. Confirm the data persists. Optionally create a separate test account and confirm it **cannot** read another account's records.

**Note:** GitHub Pages availability for private repositories depends on your GitHub plan. A public repository is suitable for this code because the journal data lives in protected Supabase tables, not in GitHub.

## Dev tests

```bash
npm test
npm run build
```

Tests verify timeline coverage, template totals and overnight breaks. Test the cloud backend separately after deploying `schema.sql` to your own Supabase project.

## Limits and planned enhancements

- A completed sleep block defaults to planned sleep duration; edit the minutes if the actual nap differs. It does not automatically detect sleep or infer it from phone activity.
- The 18-hour schedule is an **experiment**, not a veterinary requirement. A short 1:30 PM nap before the 2 PM potty break may be impractical and can be removed or moved.
- The History view shows recent **saved** dates, not unvisited blank dates.
- Account authentication and cross-device saving **require your own Supabase project**; without this, preview works only on the current browser.
- Household sharing and reminder notifications are not yet implemented.
- For a public production launch, add email rate limits, monitoring/backups, a privacy policy and security review for the hosting/auth configuration.

**Health note:** This is a schedule and notes tool, not a medical device. If Merlin has repeated urinary accidents with straining, blood, unusual thirst or other concerning symptoms, seek veterinary advice.

### Clone the repository

```bash
git clone https://github.com/TheMajesticGmng/Merlins-Daily-Journal.git
cd Merlins-Daily-Journal
npm install
npm run dev
```

Note: This repository is **public**; never commit household journal content or passwords. Cloud-backed logins and saving remain disabled until you connect Supabase.
