import { supabase } from '@/lib/supabaseClient'
import { compress } from '@/lib/image'

/** Storage path prefix for member-uploaded avatars in the images bucket. */
export function isStorageAvatarPath(value: string): boolean {
  return value.startsWith('avatars/')
}

export async function getAvatarDisplayUrl(
  avatarUrl: string | null | undefined
): Promise<string | null> {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }
  const { data, error } = await supabase.storage
    .from('images')
    .createSignedUrl(avatarUrl, 3600)
  if (error) {
    console.error('Error creating avatar signed URL:', error)
    return null
  }
  return data.signedUrl
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const compressed = await compress(file)
  const path = `avatars/${userId}/${Date.now()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) throw uploadError
  return path
}

export async function removeStorageAvatar(path: string): Promise<void> {
  if (!isStorageAvatarPath(path)) return
  const { error } = await supabase.storage.from('images').remove([path])
  if (error) console.error('Error removing old avatar:', error)
}
