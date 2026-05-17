# Storage Buckets

## Configuration

- **Bucket name:** `images`
- **Visibility:** Private (`public = false`)
- **File size limit:** 5 MB per file (recommended)
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`

## Upload Flow

1. Client compresses image (≤ 1600 px longest side, ~0.8 quality, strips EXIF) via `web/src/lib/image.ts`
2. Upload to Supabase Storage under path `items/{itemId}/{filename}`
3. Store the path in the `item_images` table

## Download Flow

All reads go through 1-hour signed URLs requested by the client. The bucket is kept private to prevent public scraping.

## Path Convention

Always use `items/{itemId}/{filename}`. Storage policies in migration `11_storage_policies_images.sql` enforce this structure. Never write objects to other top-level folders.

## Storage Policies

Migration `11_storage_policies_images.sql` sets item-scoped policies for authenticated users.  
⚠️ Migration `08_storage_policies_images.sql` grants broad anon SELECT on the entire bucket — do not apply `08` if `11` is already applied; they contradict each other.

See `docs/supabase-overview.md` for full migration notes.
