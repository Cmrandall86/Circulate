import IconButton from '@/components/ui/IconButton'
import type { ItemImageWithUrl } from './types'

type ItemGalleryProps = {
  images: ItemImageWithUrl[]
  itemTitle: string
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ItemGallery({
  images,
  itemTitle,
  selectedIndex,
  onSelectIndex,
}: ItemGalleryProps) {
  const imageCount = images.length
  const hasMultiple = imageCount > 1

  function goToPrevious() {
    onSelectIndex((selectedIndex - 1 + imageCount) % imageCount)
  }

  function goToNext() {
    onSelectIndex((selectedIndex + 1) % imageCount)
  }

  function handleGalleryKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!hasMultiple) return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToNext()
    }
  }

  const currentImage = images[selectedIndex]

  return (
    <div className="mb-6">
      <div
        role="region"
        aria-label={`${itemTitle} image gallery`}
        tabIndex={hasMultiple ? 0 : undefined}
        onKeyDown={handleGalleryKeyDown}
        className={`relative mb-4 h-96 w-full overflow-hidden rounded-lg bg-base-800 ${
          hasMultiple ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-400' : ''
        }`}
      >
        <img
          src={currentImage?.signed_url || ''}
          alt={`${itemTitle} — image ${selectedIndex + 1} of ${imageCount}`}
          className="h-full w-full object-contain"
        />

        {hasMultiple && (
          <>
            <IconButton
              aria-label={`Previous image (${selectedIndex + 1} of ${imageCount})`}
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-overlay/80 text-white hover:bg-overlay hover:text-white focus-visible:ring-white"
            >
              <ChevronLeftIcon />
            </IconButton>

            <IconButton
              aria-label={`Next image (${selectedIndex + 1} of ${imageCount})`}
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-overlay/80 text-white hover:bg-overlay hover:text-white focus-visible:ring-white"
            >
              <ChevronRightIcon />
            </IconButton>

            <div
              className="text-caption absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-overlay/80 px-3 py-1 text-white"
              aria-live="polite"
              aria-atomic="true"
            >
              {selectedIndex + 1} / {imageCount}
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div
          role="tablist"
          aria-label={`${itemTitle} image thumbnails`}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((img, idx) => {
            const selected = idx === selectedIndex
            return (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`Show image ${idx + 1} of ${imageCount}`}
                onClick={() => onSelectIndex(idx)}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-900 ${
                  selected ? 'border-mint-400' : 'border-base-700 hover:border-base-600'
                }`}
              >
                <img
                  src={img.signed_url || ''}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
