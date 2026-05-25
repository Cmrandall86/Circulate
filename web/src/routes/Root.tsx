import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import Navbar from '../components/Navbar'

export default function Root() {
  return (
    <div className="min-h-screen bg-base-900">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="max-w-[1800px] mx-auto w-full px-6 py-6 outline-none">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
