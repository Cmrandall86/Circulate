import { Link } from '@tanstack/react-router'
import type { Item, ItemImage } from '../lib/types'
import {
  archivedItemBadgeVariant,
  archivedItemLabel,
  type ArchivedItemKind,
  itemStatusBadgeVariant,
  itemStatusLabel,
} from '@/features/items/status'
import Card from './ui/Card'
import Badge from './ui/Badge'

interface ItemCardProps {
  item: Item & { item_images?: (ItemImage & { signed_url?: string })[] }
  archiveKind?: ArchivedItemKind
  interestCount?: number
  hasUnreadInterest?: boolean
  publicArea?: string | null
  /** Cap card width on larger screens when the feed has only a few items. */
  constrainWidth?: boolean
}

export default function ItemCard({
  item,
  archiveKind,
  interestCount,
  hasUnreadInterest,
  publicArea,
  constrainWidth = false,
}: ItemCardProps) {
  const firstImage = item.item_images?.[0]
  const imageUrl = firstImage?.signed_url || firstImage?.path
  const badgeLabel = archiveKind
    ? archivedItemLabel(archiveKind)
    : itemStatusLabel(item.status)
  const badgeVariant = archiveKind
    ? archivedItemBadgeVariant(archiveKind)
    : itemStatusBadgeVariant(item.status)

  return (
    <Link
      to="/item/$id"
      params={{ id: item.id }}
      className={`block h-full w-full ${constrainWidth ? 'max-w-full sm:max-w-[260px]' : ''}`}
    >
      <Card className="p-4 [@media(hover:hover)]:hover:border-mint-400 transition-colors cursor-pointer h-full flex flex-col">
        {imageUrl ? (
          <div className="w-full aspect-[4/5] bg-base-700 rounded-lg mb-4 overflow-hidden flex items-center justify-center">
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-contain object-center"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/5] bg-base-700 rounded-lg mb-4 flex items-center justify-center">
            <span className="text-caption">No image</span>
          </div>
        )}
        <div className="flex flex-col flex-1">
          <h3 className="text-heading mb-2 line-clamp-2">{item.title}</h3>
          {item.description && (
            <p className="text-caption mb-2 line-clamp-2">{item.description}</p>
          )}
          {publicArea && (
            <p className="text-caption mb-2">{publicArea}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant={badgeVariant}>
                {badgeLabel}
              </Badge>
              {interestCount !== undefined && interestCount > 0 && (
                <span
                  className={`text-caption inline-flex items-center gap-1 ${
                    hasUnreadInterest ? 'text-link' : 'text-ink-600'
                  }`}
                >
                  {hasUnreadInterest && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-mint-400"
                      aria-hidden="true"
                    />
                  )}
                  {interestCount === 1 ? '1 interested' : `${interestCount} interested`}
                </span>
              )}
            </div>
            {item.category && (
              <span className="text-caption shrink-0">{item.category}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

