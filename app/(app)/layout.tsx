import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import GuestBanner from '@/components/layout/GuestBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const isGuest = !!user.is_anonymous

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar userEmail={user.email ?? ''} isGuest={isGuest} />
      <main className="flex-1 overflow-y-auto flex flex-col">
        {isGuest && <GuestBanner />}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
