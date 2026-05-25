import { useEffect, useId, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getAvatarDisplayUrl } from '@/lib/avatar'
import {
  useMyProfile,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/api'

export default function Settings() {
  const { data: profile, isLoading, error } = useMyProfile()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()

  const [displayName, setDisplayName] = useState('')
  const [publicArea, setPublicArea] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const publicAreaHintId = useId()

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setPublicArea(profile.public_area ?? '')
    let cancelled = false
    getAvatarDisplayUrl(profile.avatar_url).then((url) => {
      if (!cancelled) setAvatarPreview(url)
    })
    return () => {
      cancelled = true
    }
  }, [profile])

  const isPending = updateProfile.isPending || uploadAvatar.isPending
  const mutationError =
    updateProfile.error instanceof Error
      ? updateProfile.error.message
      : uploadAvatar.error instanceof Error
        ? uploadAvatar.error.message
        : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    await updateProfile.mutateAsync({
      display_name: displayName,
      public_area: publicArea,
    })
    setSaved(true)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaved(false)
    const updated = await uploadAvatar.mutateAsync(file)
    const url = await getAvatarDisplayUrl(updated.avatar_url)
    setAvatarPreview(url)
    e.target.value = ''
  }

  if (isLoading) {
    return <div className="text-body text-ink-500">Loading settings…</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {(error as Error).message}</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-title mb-6">Settings</h1>

      <form onSubmit={handleSave} className="card p-6 space-y-6">
        <div>
          <label className="text-caption mb-2 block text-ink-500">Avatar</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-base-700 border border-base-600 overflow-hidden flex items-center justify-center shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-caption text-ink-600">None</span>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isPending}
                onChange={handleAvatarChange}
                className="text-caption text-ink-500 file:mr-3 file:rounded-xl file:border-0 file:bg-base-700 file:px-3 file:py-1.5 file:text-ink-400 hover:file:bg-base-600"
              />
              {uploadAvatar.isPending && (
                <p className="text-caption mt-1">Uploading…</p>
              )}
            </div>
          </div>
        </div>

        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How others see you"
          disabled={isPending}
        />

        <Input
          label="Public area (optional)"
          value={publicArea}
          onChange={(e) => setPublicArea(e.target.value)}
          placeholder="e.g. Capitol Hill, Seattle"
          disabled={isPending}
          descriptionId={publicAreaHintId}
        />
        <p id={publicAreaHintId} className="text-caption -mt-4">
          General area shown on your items. Exact address never goes here.
        </p>

        {mutationError && (
          <p className="text-caption text-red-400" role="alert">
            Error: {mutationError}
          </p>
        )}

        {saved && !mutationError && (
          <p className="text-caption text-link" role="status">
            Settings saved.
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
