'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Mail, Lock, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

/**
 * Converts an anonymous (guest) session into a permanent account.
 * All resources, notes, quiz scores, and flashcards created as a guest
 * stay attached to the same user id — nothing is lost.
 */
export default function UpgradePage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [isGuest, setIsGuest] = useState<boolean | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsGuest(!!user?.is_anonymous)
    })
  }, [supabase])

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)

    const { error: emailError } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    )
    if (emailError) {
      toast.error(emailError.message)
      setLoading(false)
      return
    }

    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) {
      toast.error(pwError.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (isGuest === false) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-sm card text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">You already have a full account</h2>
          <Link href="/library" className="btn-primary justify-center mt-2">Back to library</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-sm card text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Confirm your email</h2>
          <p className="text-sm text-gray-500 mb-4">
            We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>.
            Click it to finish upgrading — everything you saved as a guest stays with your account.
          </p>
          <Link href="/library" className="btn-secondary justify-center">Keep studying meanwhile</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-900">KnowBase</span>
        </div>

        <div className="card">
          <Link href="/library" className="btn-ghost text-xs mb-3 inline-flex">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Keep your guest data</h1>
          <p className="text-sm text-gray-500 mb-6">
            Add an email and password — all resources, notes, and progress you created as a guest carry over.
          </p>

          <form onSubmit={handleUpgrade} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {loading ? 'Creating account…' : 'Create my account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
