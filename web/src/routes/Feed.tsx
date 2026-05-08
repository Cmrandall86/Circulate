import { Link } from '@tanstack/react-router'
import { useFeed } from '../hooks/useFeed'
import ItemCard from '../components/ItemCard'
import Button from '../components/ui/Button'

export default function Feed() {
  const { data: items, isLoading, error } = useFeed()

  if (isLoading) {
    return <div className="text-ink-500">Loading feed...</div>
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 card border border-red-500/30 rounded-lg">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load feed</h2>
        <p className="text-ink-600 text-sm">Something went wrong. Please try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-ink-400">Feed</h1>
        <Link to="/new">
          <Button className="btn-accent">Create Item</Button>
        </Link>
      </div>

      {!items || items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-600 mb-4">No items yet. Create one to get started!</p>
          <Link to="/new">
            <Button className="btn-accent">Create Your First Item</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

