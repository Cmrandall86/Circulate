# Stuff Cycler

A community platform for sharing and cycling items. Users post things they want to give away, control who can see them (public or specific groups), and browse what others are offering.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deployment:** Netlify (frontend), Supabase hosted (backend)

## Features

- Item feed with image gallery and visibility controls (public or group-restricted)
- Multi-image upload with client-side compression
- Groups system — create groups, invite members, share items privately
- Auth — email/password, Google, Discord
- Admin panel for user management (list, create, edit roles, ban, delete)
- Role-based access control (admin / member)

## Project Structure

```
Stuff_Cycler/
├── web/                    # Vite + React frontend
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── features/       # Feature modules (items, groups)
│   │   ├── hooks/          # React hooks (auth, feed, roles)
│   │   ├── lib/            # Supabase client, types, utilities
│   │   ├── routes/         # Page components (TanStack Router)
│   │   └── theme/          # CSS design tokens
│   └── .env.local          # Local environment variables (not committed)
└── supabase/
    ├── functions/          # Edge Functions
    │   └── admin-users/    # Admin user management API
    ├── migrations/         # Database migrations (applied in order)
    ├── archive-debug-scripts/  # Historical fix scripts (reference only)
    ├── bootstrap.sql       # Full schema setup script
    ├── backfill-profiles.sql   # Utility: ensure all users have profiles
    └── config.toml         # Supabase CLI config
```

## Local Setup

### Prerequisites
- Node 20+
- npm
- A Supabase project ([free tier](https://supabase.com))

### 1. Environment Variables

Create `web/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME="Stuff Cycler"
VITE_IMAGE_BUCKET="images"
```

### 2. Database Setup

In the Supabase SQL editor, run in order:
1. `supabase/bootstrap.sql` — creates all tables, functions, triggers, and RLS policies
2. Each file in `supabase/migrations/` in numeric order
3. (Optional) `supabase/backfill-profiles.sql` — if you have existing auth users

### 3. Storage

Create a private bucket named `images` in Supabase Storage. The RLS policies in `supabase/migrations/08_storage_policies_images.sql` handle access control.

### 4. Authentication

In Supabase Dashboard → Authentication → Providers:
- Enable **Email** (allow password signups)
- Enable **Google** and **Discord** with your OAuth credentials
- Under URL Configuration set **Site URL** to `http://localhost:5173` and add it as a redirect URL

### 5. Edge Function

Deploy the admin users function:

```bash
supabase link --project-ref your-project-ref
supabase functions deploy admin-users
supabase secrets set SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 6. Make Yourself Admin

Run in the Supabase SQL editor while logged into the app:

```sql
update profiles set role = 'admin' where id = auth.uid();
```

### 7. Install and Run

```bash
cd web
npm install
npm run dev
```

App runs at http://localhost:5173.

## Deployment (Netlify)

The app deploys automatically from the `main` branch via Netlify. Environment variables must be set in **Netlify → Site Settings → Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_NAME`
- `VITE_IMAGE_BUCKET`

## Testing Checklist

- [ ] Email/password sign-up creates a profile automatically
- [ ] Sign in/out flows work
- [ ] Google and Discord OAuth sign-in work
- [ ] Non-admin cannot access `/admin/users`
- [ ] Admin can list, create, edit, and delete users
- [ ] Password reset email → `/reset-password` → redirect to sign-in
- [ ] Items can be created with images and visibility settings
- [ ] Groups can be created and members invited
- [ ] Feed shows items respecting visibility rules
