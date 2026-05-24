-- Migration 19: Profile public_area + avatar storage policies
-- public_area is optional stub text until HITL location slice (#12) refines input.
-- Avatars stored at images/avatars/{user_id}/{filename}

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_area text;

-- Avatar uploads: avatars/{user_id}/...

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'avatars'
);

SELECT '✓ Profile public_area and avatar storage policies complete' AS status;
