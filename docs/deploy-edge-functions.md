# Deploy Edge Functions

Deployment guide for Circulate's Supabase Edge Functions.

## Functions

| Function | Purpose |
|---|---|
| `admin-users` | User management — list, create, update, ban, delete |
| `admin-items` | Item moderation — fetch, archive, update, delete for any item |

Both functions verify the caller's JWT and confirm `profiles.role === 'admin'` before using the service-role key.

## Prerequisites

```bash
supabase link --project-ref your-project-ref
```

## Deploy

```bash
supabase functions deploy admin-users
supabase functions deploy admin-items
```

## Set Secrets

```bash
supabase secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  ALLOW_ORIGINS="http://localhost:5173,https://use-circulate.netlify.app"
```

Find these values in Supabase Dashboard → Settings → API.  
⚠️ `SUPABASE_SERVICE_ROLE_KEY` is privileged — never expose it in `VITE_*` variables.

## Verify

```bash
supabase functions logs admin-users
supabase functions logs admin-items
```

Expected on startup:
```
Edge function starting with env check: { hasUrl: true, hasAnon: true, hasService: true }
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 500 errors | Missing secrets | Re-run `supabase secrets set` |
| 403 Forbidden | Profile not admin | `update profiles set role='admin' where id = auth.uid();` |
| CORS errors | `ALLOW_ORIGINS` mismatch | Update to include your frontend URL |

## `admin-users` Testing Checklist

- [ ] Create user (member role)
- [ ] Create user (admin role)
- [ ] Edit display name
- [ ] Edit role (not your own)
- [ ] Self-demotion blocked
- [ ] Reset password
- [ ] Soft-ban user
- [ ] Hard-delete user
- [ ] Search by email/name
- [ ] Pagination works
