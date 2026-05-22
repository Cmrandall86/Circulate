import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import Navbar from '../components/Navbar'

export default function Root() {
  return (
    <div className="min-h-screen bg-base-900">
      <Navbar />
      <main className="max-w-[1800px] mx-auto w-full px-6 py-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
