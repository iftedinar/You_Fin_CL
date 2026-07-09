'use client'

import Link from 'next/link'
import { UserRound, X } from 'lucide-react'
import { useState } from 'react'

export default function GuestBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm">
      <UserRound className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-amber-800 flex-1">
        You&apos;re browsing as a <span className="font-semibold">guest</span>. Your data is saved to this browser session —{' '}
        <Link href="/auth/upgrade" className="font-semibold underline hover:text-amber-900">
          create a free account
        </Link>{' '}
        to keep it permanently and use it on other devices.
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
