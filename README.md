# HomeOS

A real-time collaborative grocery and household shopping companion.

**Completely independent from TuitionOS.** This folder is self-contained and can be moved to its own repository without changing imports.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn-style UI (white + amber)
- Supabase Auth, Database, RLS, Realtime
- React Hook Form / Zod-ready patterns
- Browser Speech Recognition (optional)

## Progressive Web App

HomeOS is installable on Android and iPhone:

1. Deploy over HTTPS (required for install + service worker).
2. On Android Chrome: menu → **Install app** / **Add to Home screen**.
3. On iPhone Safari: Share → **Add to Home Screen**.

The app launches in standalone mode with offline shell fallback at `/offline`.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in Supabase keys.
2. Run the SQL migrations in order in the Supabase SQL Editor:
   - `supabase/migrations/20260717000000_homeos_schema.sql`
   - `supabase/migrations/20260717000001_fix_household_create_rls.sql` (required if you already ran the first migration before this fix)
   - `supabase/migrations/20260717000002_realtime_replica_identity.sql` (required for reliable live item sync)
   - `supabase/migrations/20260717000003_invite_lookup_rpc.sql` (required so invite links work for guests)
   - `supabase/migrations/20260717000004_accept_invite_by_email.sql` (required so invitees join after email confirm + sign-in)
3. Enable Email auth in Supabase. Set **Site URL** to your app URL and add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
4. Set `NEXT_PUBLIC_SITE_URL` to the same production URL on Vercel (not localhost).
5. Install and run:

```bash
cd homeos
npm install
npm run dev
```

## Features

- Household signup (owner) + email invite links
- Multiple shopping lists
- Realtime item sync across family members
- Smart grocery categories
- Voice input (when browser supports SpeechRecognition)
- Activity timeline
- Dashboard metrics
- Settings: profile, invite, leave/delete household

## Independence check

```bash
# From inside homeos — should find zero matches
rg "tuition-saas|next-app|\.\./" --glob '!node_modules' --glob '!.next'
```

All imports use `@/` paths within this project only.
