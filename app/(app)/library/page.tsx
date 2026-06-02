'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Youtube, Globe, FileText, StickyNote,
  Clock, CheckCircle, BookOpen, Bookmark,
  Search, Loader2, AlertCircle, RefreshCw
} from 'lucide-react'
import { cn, formatDate, difficultyColor, studyStatusColor, studyStatusLabel, truncate } from '@/lib/utils'
import type { Resource } from '@/lib/types'

const SOURCE_ICONS: Record<string, React.ElementType> = {
  youtube: Youtube,
  article: Globe,
  pdf: FileText,
  note: StickyNote,
}

const STUDY_STATUS_ICONS: Record<string, React.ElementType> = {
  not_started: Clock,
  in_progress: BookOpen,
  completed: CheckCircle,
  saved_for_later: Bookmark,
}

const FILTERS = ['all', 'youtube', 'article', 'pdf', 'note'] as const

export default function LibraryPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all')
  const supabase = createClient()

  const fetchResources = useCallback(async () => {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false })
    setResources((data ?? []) as Resource[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchResources()

    // Listen for new resources added via modal
    window.addEventListener('resource-added', fetchResources)

    // Poll for status updates on processing items
    const interval = setInterval(fetchResources, 8000)

    return () => {
      window.removeEventListener('resource-added', fetchResources)
      clearInterval(interval)
    }
  }, [fetchResources])

  const filtered = resources.filter(r => {
    const matchesFilter = filter === 'all' || r.source_type === filter
    const matchesSearch = !search || 
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.extracted?.topic_tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const processing = resources.filter(r => r.status === 'processing').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-gray-900">Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {resources.length} resource{resources.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        {processing > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {processing} processing…
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by title or topic…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 border border-surface-border hover:bg-surface-tertiary'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Resource grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || filter !== 'all' ? 'No resources match your search' : 'No resources yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {!search && filter === 'all' && 'Click "Add resource" to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(resource => (
            <ResourceCard key={resource.id} resource={resource} onRefresh={fetchResources} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResourceCard({ resource, onRefresh }: { resource: Resource; onRefresh: () => void }) {
  const SourceIcon = SOURCE_ICONS[resource.source_type] ?? FileText
  const StatusIcon = STUDY_STATUS_ICONS[resource.study_status] ?? Clock

  const isProcessing = resource.status === 'processing'
  const isError = resource.status === 'error'

  return (
    <div className={cn(
      'card flex flex-col gap-3 hover:shadow-card-hover transition-shadow',
      isProcessing && 'opacity-75'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
            <SourceIcon className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <span className="text-xs text-gray-400 capitalize">{resource.source_type}</span>
        </div>

        {isProcessing ? (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </div>
        ) : isError ? (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="w-3 h-3" />
            Error
          </div>
        ) : (
          <span className={cn('badge text-xs', difficultyColor(resource.extracted?.difficulty ?? ''))}>
            {resource.extracted?.difficulty ?? 'n/a'}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug">
          {truncate(resource.title, 60)}
        </h3>
        {resource.extracted?.summary_short && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {truncate(resource.extracted.summary_short, 100)}
          </p>
        )}
        {isError && (
          <p className="text-xs text-red-400 mt-1">{resource.error_message ?? 'Extraction failed'}</p>
        )}
      </div>

      {/* Tags */}
      {(resource.extracted?.topic_tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {resource.extracted!.topic_tags.slice(0, 3).map(tag => (
            <span key={tag} className="badge bg-surface-tertiary text-gray-500 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-border">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <StatusIcon className="w-3 h-3" />
          {studyStatusLabel(resource.study_status)}
        </div>
        <span className="text-xs text-gray-400">{formatDate(resource.created_at)}</span>
      </div>

      {/* Action */}
      {!isProcessing && !isError && (
        <Link
          href={`/resource/${resource.id}`}
          className="btn-primary text-xs py-1.5 justify-center"
        >
          Open resource
        </Link>
      )}
      {isError && (
        <button onClick={onRefresh} className="btn-secondary text-xs py-1.5 justify-center">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  )
}
