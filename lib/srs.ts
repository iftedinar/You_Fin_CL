// SM-2-style spaced repetition scheduling
import type { FlashcardRow } from '@/lib/types'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface SrsUpdate {
  ease: number
  interval_days: number
  reps: number
  due_at: string
}

export function scheduleNext(card: Pick<FlashcardRow, 'ease' | 'interval_days' | 'reps'>, grade: Grade): SrsUpdate {
  let { ease, interval_days: interval, reps } = card

  switch (grade) {
    case 'again':
      ease = Math.max(1.3, ease - 0.2)
      reps = 0
      interval = 0 // show again this session (due in 10 minutes)
      break
    case 'hard':
      ease = Math.max(1.3, ease - 0.15)
      interval = Math.max(1, interval * 1.2)
      reps += 1
      break
    case 'good':
      interval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease
      reps += 1
      break
    case 'easy':
      ease = Math.min(3.0, ease + 0.15)
      interval = Math.max(2, interval * ease * 1.3)
      reps += 1
      break
  }

  interval = Math.min(interval, 365)
  const dueMs = grade === 'again'
    ? Date.now() + 10 * 60 * 1000
    : Date.now() + interval * 24 * 60 * 60 * 1000

  return {
    ease: Number(ease.toFixed(2)),
    interval_days: Number(interval.toFixed(2)),
    reps,
    due_at: new Date(dueMs).toISOString(),
  }
}
