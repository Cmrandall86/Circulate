import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { removeStorageAvatar, uploadAvatar } from '@/lib/avatar'
import { normalizePublicArea } from '@/lib/publicArea'
import type { Profile } from '@/lib/types'

export type ProfileUpdateInput = {
  display_name: string
  public_area: string
}

export const profileKeys = {
  all: ['profiles'] as const,
  me: ['profiles', 'me'] as const,
}

export function useMyProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: async (): Promise<Profile> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, public_area, role, created_at, updated_at')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: ProfileUpdateInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: input.display_name.trim() || null,
          public_area: normalizePublicArea(input.public_area),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('id, display_name, avatar_url, public_area, role, created_at, updated_at')
        .single()

      if (error) throw error
      return data as Profile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.me })
    },
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      const newPath = await uploadAvatar(file, user.id)

      const { data, error } = await supabase
        .from('profiles')
        .update({
          avatar_url: newPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('id, display_name, avatar_url, public_area, role, created_at, updated_at')
        .single()

      if (error) throw error

      if (existing?.avatar_url) {
        await removeStorageAvatar(existing.avatar_url)
      }

      return data as Profile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.me })
    },
  })
}
