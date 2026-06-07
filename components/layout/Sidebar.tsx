'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Library, LayoutDashboard, LogOut, Plus, Sparkles, ListChecks } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import AddResourceModal from '@/components/ui/AddResourceModal'

const navItems = [
  { href: '/library', label: 'Library', icon: Library },
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { href: '/test', label: 'Test', icon: ListChecks },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showAdd, setShowAdd] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <>
      <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-surface-border h-full">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-surface-border">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">KnowBase</span>
        </div>

        {/* Add resource */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary w-full justify-center text-sm py-2"
          >
            <Plus className="w-4 h-4" />
            Add resource
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-surface-tertiary hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-3 border-t border-surface-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <span className="text-xs text-gray-500 truncate flex-1">{userEmail}</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost w-full justify-start text-gray-500 mt-1 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <AddResourceModal open={showAdd} onClose={() => setShowAdd(false)} />
    </>
  )
}
