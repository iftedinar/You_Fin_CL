'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Layers, Loader2, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { scheduleNext, type Grade } from '@/lib/srs'
import { cn } from '@/lib/utils'
import type { FlashcardRow } from '@/lib/types'
import toast from 'react-hot-toast'

interface CardWithTitle extends FlashcardRow {
  resources?: { title: string } | null
}

const GRADE_BUTTONS: { grade: Grade; label: string; hint: string; cls: string }[] = [
  { grade: 'again', label: 'Again', hint: '<10 min', cls: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
  { grade: 'hard', label: 'Hard', hint: 'shorter gap', cls: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { grade: 'good', label: 'Good', hint: 'normal gap', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { grade: 'easy', label: 'Easy', hint: 'longer gap', cls: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100' },
]

export default function ReviewPage() {
  const [queue, setQueue] = useState<CardWithTitle[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    const nowIso = new Date().toISOString()
    const [{ data: due }, { count }] = await Promise.all([
      supabase
        .from('flashcards')
        .select('*, resources(title)')
        .lte('due_at', nowIso)
        .order('due_at', { ascending: true })
        .limit(50),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }),
    ])
    setQueue((due ?? []) as CardWithTitle[])
    setTotalCards(count ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  async function handleGrade(grade: Grade) {
    const card = queue[0]
    if (!card) return

    const update = scheduleNext(card, grade)
    setFlipped(false)
    setReviewed(r => r + 1)
    setQueue(q => {
      const rest = q.slice(1)
      // "Again" cards come back at the end of this session's queue
      return grade === 'again' ? [...rest, { ...card, ...update }] : rest
    })

    const { error } = await supabase.from('flashcards').update(update).eq('id', card.id)
    if (error) toast.error('Failed to save review — check that the flashcards migration has been run')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const card = queue[0]

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" /> Review
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Spaced repetition — cards resurface right before you&apos;d forget them
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-gray-900">{queue.length} due</p>
          <p className="text-xs text-gray-400">{totalCards} cards total · {reviewed} done today</p>
        </div>
      </div>

      {totalCards === 0 ? (
        <div className="card text-center py-14">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No flashcards yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Add a resource and KnowBase will auto-generate flashcards from it.
          </p>
          <Link href="/library" className="btn-primary justify-center inline-flex">Go to library</Link>
        </div>
      ) : !card ? (
        <div className="card text-center py-14">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">All caught up! 🎉</p>
          <p className="text-sm text-gray-400 mt-1">
            {reviewed > 0 ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'} this session. ` : ''}
            Come back when more cards are due.
          </p>
          <button onClick={fetchQueue} className="btn-secondary justify-center inline-flex mt-4">
            <RotateCcw className="w-4 h-4" /> Check again
          </button>
        </div>
      ) : (
        <>
          {/* Card */}
          <button
            onClick={() => setFlipped(f => !f)}
            className="card w-full text-left min-h-[260px] flex flex-col cursor-pointer hover:shadow-card-hover transition-shadow"
          >
            <p className="text-xs text-gray-400 mb-3">
              From: {card.resources?.title ?? 'your library'}
            </p>
            <div className="flex-1 flex items-center justify-center px-4 py-6">
              <p className={cn('text-center leading-relaxed', flipped ? 'text-gray-700' : 'text-lg font-medium text-gray-900')}>
                {flipped ? card.back : card.front}
              </p>
            </div>
            <p className="text-center text-xs text-gray-400 pt-3 border-t border-surface-border">
              {flipped ? 'How well did you know it?' : 'Click to reveal answer'}
            </p>
          </button>

          {/* Grading */}
          {flipped && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {GRADE_BUTTONS.map(({ grade, label, hint, cls }) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  className={cn('flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors', cls)}
                >
                  {label}
                  <span className="text-[10px] font-normal opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
