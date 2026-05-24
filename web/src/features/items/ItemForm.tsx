import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import ImageUploader from '@/components/ImageUploader'
import { useMyGroups } from '@/features/groups/api'
import { useCreateItem, useUpdateItem, useItemGroups, useItemImages, uploadItemImages, useDeleteImage, updateImageOrder } from './api'
import { useMyProfile } from '@/features/profile/api'
import { normalizePublicArea } from '@/lib/publicArea'
import { refreshItemDetailCaches } from '@/lib/itemQueryCache'
import { supabase } from '@/lib/supabaseClient'
import type { Item } from '@/lib/types'
import type { ImageFile } from './types'

interface ItemFormProps {
  itemId?: string
  item?: Item
  /**
   * True when an admin is editing an item they do not own.
   * Shows an admin notice and bypasses client-side ownership checks on image deletion.
   */
  isAdminEdit?: boolean
  /**
   * When provided, called instead of the normal useUpdateItem path.
   * Used when an admin is updating another user's item via the Edge Function.
   * Must return { id: string }.
   */
  onUpdate?: (data: import('./types').ItemFormData) => Promise<{ id: string }>
  /** Owner profile public area when an admin edits another user's item. */
  ownerPublicArea?: string | null
}

export default function ItemForm({ itemId, item, isAdminEdit = false, onUpdate, ownerPublicArea }: ItemFormProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: myProfile } = useMyProfile()
  const { data: groups } = useMyGroups()
  const { data: existingVisibilityGroups } = useItemGroups(itemId ?? '')
  const { data: existingImages } = useItemImages(itemId ?? '')
  const createItem = useCreateItem()
  const updateItem = useUpdateItem(itemId ?? '')
  const deleteImage = useDeleteImage()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('')
  const [category, setCategory] = useState('')
  const [useLocationOverride, setUseLocationOverride] = useState(false)
  const [locationOverride, setLocationOverride] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'groups'>('public')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [images, setImages] = useState<ImageFile[]>([])
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [error, setError] = useState('')

  const profilePublicArea = isAdminEdit
    ? (ownerPublicArea ?? null)
    : (myProfile?.public_area ?? null)

  // Load existing item data for edit mode
  useEffect(() => {
    if (item) {
      setTitle(item.title || '')
      setDescription(item.description || '')
      setCondition(item.condition || '')
      setCategory(item.category || '')
      const hasOverride = !!item.approx_location?.trim()
      setUseLocationOverride(hasOverride)
      setLocationOverride(item.approx_location?.trim() ?? '')
      setVisibility(item.visibility as 'public' | 'groups' || 'public')
    }
  }, [item])

  // Load existing visibility groups for edit mode
  useEffect(() => {
    if (existingVisibilityGroups && existingVisibilityGroups.length > 0) {
      setSelectedGroupIds(existingVisibilityGroups.map(vg => vg.group_id))
    }
  }, [existingVisibilityGroups])

  // Load existing images for edit mode
  useEffect(() => {
    if (existingImages && existingImages.length > 0) {
      const imageFiles: ImageFile[] = existingImages.map(img => ({
        id: img.id,
        url: img.signed_url,
        isExisting: true,
        sortOrder: img.sort_order,
      }))
      setImages(imageFiles)
    }
  }, [existingImages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (visibility === 'groups' && selectedGroupIds.length === 0) {
      setError('Please select at least one group for visibility')
      return
    }

    const formData = {
      title,
      description,
      condition,
      category,
      approx_location: useLocationOverride
        ? normalizePublicArea(locationOverride)
        : null,
      visibility,
      group_ids: visibility === 'groups' ? selectedGroupIds : [],
    }

    try {
      setIsUploadingImages(true)
      
      let savedItem
      if (itemId) {
        if (onUpdate) {
          savedItem = await onUpdate(formData)
        } else {
          savedItem = await updateItem.mutateAsync(formData)
        }
      } else {
        savedItem = await createItem.mutateAsync(formData)
      }
      
      const finalItemId = savedItem.id

      // Delete marked images
      if (imagesToDelete.length > 0) {
        await Promise.all(
          imagesToDelete.map(id =>
            deleteImage.mutateAsync({
              imageId: id,
              itemId: finalItemId,
              bypassOwnerCheck: isAdminEdit,
            })
          )
        )
      }

      // Upload new images
      const newFiles = images.filter(img => !img.isExisting && img.file).map(img => img.file!)
      if (newFiles.length > 0) {
        await uploadItemImages(finalItemId, newFiles)
      }

      // Update image order if needed
      const existingImageIds = images
        .filter(img => img.isExisting && !imagesToDelete.includes(img.id))
        .map(img => img.id)
      
      if (existingImageIds.length > 0) {
        await updateImageOrder(finalItemId, existingImageIds)
      }

      // Refetch after metadata + image changes so item detail shows fresh data
      // without a manual browser refresh (covers normal + admin query paths).
      await refreshItemDetailCaches(qc, finalItemId)

      navigate({ to: `/item/${finalItemId}` })
    } catch (err: any) {
      setError(err.message || 'Failed to save item')
    } finally {
      setIsUploadingImages(false)
    }
  }

  const handleImageRemove = (imageId: string) => {
    const imageToRemove = images.find(img => img.id === imageId)
    if (imageToRemove?.isExisting) {
      // Mark for deletion
      setImagesToDelete(prev => [...prev, imageId])
    }
    // Remove from UI
    setImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const isPending = createItem.isPending || updateItem.isPending || isUploadingImages

  return (
    <Card className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl text-ink-400 mb-6">
        {itemId ? 'Edit Item' : 'Create New Item'}
      </h1>

      {isAdminEdit && (
        <div className="mb-4 px-3 py-2 rounded border border-yellow-600/40 bg-yellow-600/10 text-yellow-400 text-sm">
          Admin edit — you are modifying another user's item.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Item title"
          required
        />

        <div>
          <label className="block text-sm font-medium text-ink-400 mb-2">
            Description
          </label>
          <textarea
            className="w-full bg-base-900 border border-base-700 rounded-lg px-3 py-2 text-ink-400 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your item..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g., New, Like New, Good"
          />

          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Books, Electronics"
          />
        </div>

        <div className="border-t border-base-700 pt-6 space-y-3">
          <h3 className="text-lg text-ink-400">Public area</h3>
          <p className="text-sm text-ink-600">
            Items use your profile public area by default. Set or update yours in{' '}
            <Link to="/settings" className="text-mint-400 underline">
              Settings
            </Link>
            .
          </p>
          <p className="text-sm text-ink-500">
            {profilePublicArea
              ? <>Your profile area: <span className="text-ink-400">{profilePublicArea}</span></>
              : 'No profile public area set yet.'}
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useLocationOverride}
              onChange={(e) => setUseLocationOverride(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4"
            />
            <span className="text-ink-400 text-sm">Use a different area for this item</span>
          </label>
          {useLocationOverride && (
            <>
              <Input
                label="Item public area override"
                value={locationOverride}
                onChange={(e) => setLocationOverride(e.target.value)}
                placeholder="e.g. Capitol Hill, Seattle"
                disabled={isPending}
              />
              <p className="text-ink-600 text-sm -mt-4">
                General neighborhood or city only — never a street address.
              </p>
            </>
          )}
        </div>

        {/* Images section */}
        <div className="border-t border-base-700 pt-6">
          <h3 className="text-lg text-ink-400 mb-4">Images</h3>
          <ImageUploader
            images={images}
            onChange={setImages}
            onRemove={handleImageRemove}
            maxFiles={5}
          />
          <p className="text-sm text-ink-600 mt-2">
            Add up to 5 images. First image will be the cover photo. On mobile, you can take photos directly.
          </p>
        </div>

        {/* Who can see this section */}
        <div className="border-t border-base-700 pt-6">
          <h3 className="text-lg text-ink-400 mb-4">Who can see this?</h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'groups')}
                className="w-4 h-4"
              />
              <div>
                <div className="text-ink-400">Public</div>
                <div className="text-ink-600 text-sm">Anyone can see this item</div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="groups"
                checked={visibility === 'groups'}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'groups')}
                className="w-4 h-4"
              />
              <div>
                <div className="text-ink-400">Specific Groups</div>
                <div className="text-ink-600 text-sm">Only members of selected groups can see this</div>
              </div>
            </label>
          </div>

          {/* Group selection */}
          {visibility === 'groups' && (
            <div className="mt-4 border border-base-700 rounded-lg p-4">
              <div className="text-sm text-ink-400 mb-3">Select groups:</div>
              {groups && groups.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {groups.map(group => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-base-800 rounded">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => handleGroupToggle(group.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-ink-400">{group.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-ink-600 text-sm">
                  You don't belong to any groups yet. Create or join a group first.
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="btn-accent"
            disabled={isPending}
          >
            {isUploadingImages ? 'Uploading images...' : isPending ? 'Saving...' : (itemId ? 'Update Item' : 'Create Item')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate({ to: '/' })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

