import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

export function sourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    youtube: 'YouTube',
    article: 'Article',
    pdf: 'PDF',
    note: 'Note',
  }
  return labels[type] ?? type
}

export function difficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    beginner: 'bg-emerald-100 text-emerald-700',
    intermediate: 'bg-amber-100 text-amber-700',
    advanced: 'bg-red-100 text-red-700',
  }
  return colors[difficulty] ?? 'bg-gray-100 text-gray-600'
}

export function studyStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    completed: 'Completed',
    saved_for_later: 'Saved for later',
  }
  return labels[status] ?? status
}

export function studyStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    saved_for_later: 'bg-purple-100 text-purple-700',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-600'
}
