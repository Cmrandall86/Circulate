import { Link } from '@tanstack/react-router'
import type { Item, ItemImage } from '../lib/types'
import Card from './ui/Card'
import Badge from './ui/Badge'

interface ItemCardProps {
  item: Item & { item_images?: (ItemImage & { signed_url?: string })[] }
}

export default function ItemCard({ item }: ItemCardProps) {
  const firstImage = item.item_images?.[0]
  const imageUrl = firstImage?.signed_url || firstImage?.path

  return (
    <Link to="/item/$id" params={{ id: item.id }} className="block h-full">
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
            <span className="text-ink-600 text-sm">No image</span>
          </div>
        )}
        <div className="flex flex-col flex-1">
          <h3 className="text-lg font-semibold text-ink-400 mb-2 line-clamp-2">{item.title}</h3>
          {item.description && (
            <p className="text-ink-600 text-sm mb-2 line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-2">
            <Badge variant={item.status === 'active' ? 'success' : 'default'}>
              {item.status}
            </Badge>
            {item.category && (
              <span className="text-ink-600 text-sm">{item.category}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

