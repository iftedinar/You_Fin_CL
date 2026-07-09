'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Lightbulb, HelpCircle, MessageSquare,
  StickyNote, Loader2, CheckCircle, XCircle, ChevronRight,
  ExternalLink, Trash2, Tag, Download, PlayCircle, Compass,
  BarChart3, BookMarked, Library as LibraryIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, difficultyColor, studyStatusLabel } from '@/lib/utils'
import { downloadMarkdown } from '@/lib/export-md'
import { extractYouTubeId, formatTimestamp } from '@/lib/extractors/youtube'
import type { Resource, Note, QuizQuestion, QuizAttempt } from '@/lib/types'
import toast from 'react-hot-toast'

type Tab = 'summary' | 'concepts' | 'quiz' | 'qa' | 'notes'

export default function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('summary')
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  async function fetchResource() {
    const res = await fetch(`/api/resource/${id}`)
    if (!res.ok) { router.push('/library'); return }
    const data = await res.json()
    setResource(data)
    setLoading(false)
    return data
  }

  useEffect(() => {
    fetchResource()
  }, [id])

  // Poll while processing
  useEffect(() => {
    if (resource?.status === 'processing') {
      const interval = setInterval(async () => {
        const data = await fetchResource()
        if (data?.status !== 'processing') clearInterval(interval)
      }, 4000)
      setPollingInterval(interval)
      return () => clearInterval(interval)
    } else if (pollingInterval) {
      clearInterval(pollingInterval)
    }
  }, [resource?.status])

  async function handleDelete() {
    if (!confirm('Delete this resource? This cannot be undone.')) return
    await fetch(`/api/resource/${id}`, { method: 'DELETE' })
    router.push('/library')
  }

  async function handleStatusChange(study_status: string) {
    await fetch(`/api/resource/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ study_status }),
    })
    setResource(r => r ? { ...r, study_status: study_status as Resource['study_status'] } : r)
    toast.success('Status updated')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!resource) return null

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'summary',  label: 'Summary',   icon: BookOpen },
    { id: 'concepts', label: 'Concepts',  icon: Lightbulb },
    { id: 'quiz',     label: 'Quiz',      icon: HelpCircle },
    { id: 'qa',       label: 'Ask AI',    icon: MessageSquare },
    { id: 'notes',    label: 'My Notes',  icon: StickyNote },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back */}
      <Link href="/library" className="btn-ghost text-sm mb-4 inline-flex">
        <ArrowLeft className="w-4 h-4" /> Library
      </Link>

      {/* Header card */}
      <div className="card mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">{resource.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="badge bg-surface-tertiary text-gray-500 capitalize text-xs">
                {resource.source_type}
              </span>
              {resource.extracted?.difficulty && (
                <span className={cn('badge text-xs', difficultyColor(resource.extracted.difficulty))}>
                  {resource.extracted.difficulty}
                </span>
              )}
              <span className="text-xs text-gray-400">{formatDate(resource.created_at)}</span>
            </div>
            {resource.source_url && (
              <a
                href={resource.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1.5"
              >
                <ExternalLink className="w-3 h-3" /> View original
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={resource.study_status}
              onChange={e => handleStatusChange(e.target.value)}
              className="text-xs border border-surface-border rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="saved_for_later">Saved for later</option>
            </select>
            {resource.extracted && (
              <button
                onClick={() => downloadMarkdown(resource)}
                title="Export notes as Markdown (Obsidian/Notion-ready)"
                className="btn-ghost p-2 text-gray-400 hover:text-brand-600"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleDelete} className="btn-ghost p-2 text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Topic tags */}
        {(resource.extracted?.topic_tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-border">
            <Tag className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
            {resource.extracted!.topic_tags.map(tag => (
              <span key={tag} className="badge bg-brand-50 text-brand-600 text-xs">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Status: processing */}
      {resource.status === 'processing' && (
        <div className="card border-amber-200 bg-amber-50 flex items-center gap-3 mb-5">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Extracting knowledge…</p>
            <p className="text-xs text-amber-600">Short content takes ~30 seconds; long videos can take a few minutes. The page updates automatically.</p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      {resource.status === 'ready' && (
        <>
          <div className="flex gap-1 mb-5 bg-white border border-surface-border rounded-xl p-1">
            {TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors',
                  tab === tabId
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-surface-tertiary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {tab === 'summary'  && <SummaryTab resource={resource} />}
          {tab === 'concepts' && <ConceptsTab resource={resource} />}
          {tab === 'quiz'     && <QuizTab resource={resource} />}
          {tab === 'qa'       && <QATab resource={resource} />}
          {tab === 'notes'    && <NotesTab resource={resource} />}
        </>
      )}
    </div>
  )
}

// ── Summary Tab ──────────────────────────────────────────────
function SummaryTab({ resource }: { resource: Resource }) {
  const ex = resource.extracted!
  const videoId = resource.source_type === 'youtube' && resource.source_url
    ? extractYouTubeId(resource.source_url)
    : null
  const [playAt, setPlayAt] = useState<number | null>(null)
  const chapters = ex.chapters ?? []
  const dataPoints = ex.key_data_points ?? []
  const mentioned = ex.mentioned_resources ?? []
  const goDeeper = ex.go_deeper ?? []

  return (
    <div className="space-y-5">
      {/* Embedded video player — reloads at the clicked timestamp */}
      {videoId && playAt !== null && (
        <div className="card p-0 overflow-hidden">
          <div className="aspect-video">
            <iframe
              key={playAt}
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(playAt)}&autoplay=1`}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="card">
        <p className="section-label mb-3">Quick summary</p>
        <p className="text-gray-700 leading-relaxed">{ex.summary_short}</p>
        {videoId && playAt === null && (
          <button onClick={() => setPlayAt(0)} className="btn-secondary text-xs mt-3">
            <PlayCircle className="w-3.5 h-3.5" /> Watch video here
          </button>
        )}
      </div>

      {/* Chapter-by-chapter breakdown with clickable timestamps */}
      {chapters.length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Chapter breakdown</p>
          <div className="space-y-4">
            {chapters.map((ch, i) => (
              <div key={i} className="p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  {ch.start_seconds != null && videoId ? (
                    <button
                      onClick={() => setPlayAt(ch.start_seconds)}
                      className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded transition-colors"
                    >
                      <PlayCircle className="w-3 h-3" /> {formatTimestamp(ch.start_seconds)}
                    </button>
                  ) : ch.start_seconds != null ? (
                    <span className="text-xs font-mono text-gray-400">[{formatTimestamp(ch.start_seconds)}]</span>
                  ) : null}
                  <p className="text-sm font-semibold text-gray-900">{ch.title}</p>
                </div>
                <p className="text-sm text-gray-600 mt-1.5">{ch.summary}</p>
                {(ch.key_points ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ch.key_points.map((p, pi) => (
                      <li key={pi} className="flex items-start gap-2 text-xs text-gray-600">
                        <ChevronRight className="w-3 h-3 text-brand-400 mt-0.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="section-label mb-3">Detailed summary</p>
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-3">
          {ex.summary_long.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      {(ex.key_takeaways ?? []).length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Key takeaways</p>
          <ul className="space-y-2">
            {ex.key_takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <ChevronRight className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ex.strategies ?? []).length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Strategies & methods</p>
          <div className="space-y-4">
            {ex.strategies.map((s, i) => (
              <div key={i} className="p-3 bg-surface-secondary rounded-lg">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                {s.conditions && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    <span className="font-medium">When to use:</span> {s.conditions}
                  </p>
                )}
                {s.risks && (
                  <p className="text-xs text-red-500 mt-1">
                    <span className="font-medium">Risks:</span> {s.risks}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(ex.formulas ?? []).length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Formulas</p>
          <div className="space-y-3">
            {ex.formulas.map((f, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-surface-border">
                <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                <p className="font-mono text-sm text-brand-700 bg-brand-50 px-2 py-1 rounded mt-1.5 inline-block">{f.formula}</p>
                <p className="text-xs text-gray-500 mt-1.5">{f.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specific numbers/stats cited in the source */}
      {dataPoints.length > 0 && (
        <div className="card">
          <p className="section-label mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Data points cited
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {dataPoints.map((d, i) => (
              <div key={i} className="p-2.5 bg-surface-secondary rounded-lg">
                <p className="text-sm font-semibold text-brand-700">{d.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.context}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Books, tools, tickers, people the source references */}
      {mentioned.length > 0 && (
        <div className="card">
          <p className="section-label mb-3 flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5" /> Mentioned in this resource
          </p>
          <div className="space-y-2">
            {mentioned.map((m, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 bg-surface-secondary rounded-lg">
                <span className="badge bg-brand-50 text-brand-600 text-xs capitalize shrink-0 mt-0.5">{m.type}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.context}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI-suggested next topics */}
      {goDeeper.length > 0 && (
        <div className="card">
          <p className="section-label mb-3 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> Go deeper — what to learn next
          </p>
          <div className="space-y-3">
            {goDeeper.map((g, i) => (
              <div key={i} className="p-3 bg-surface-secondary rounded-lg">
                <p className="text-sm font-semibold text-gray-900">{g.topic}</p>
                <p className="text-xs text-gray-600 mt-1">{g.why}</p>
                <div className="flex gap-2 mt-2">
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.suggested_search)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Find videos
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(g.suggested_search)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Find articles
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RelatedResources resource={resource} />
    </div>
  )
}

// ── Related resources (shared topic tags in your library) ───
function RelatedResources({ resource }: { resource: Resource }) {
  const [related, setRelated] = useState<Array<{ id: string; title: string; shared: string[] }>>([])
  const supabase = createClient()
  const tags = (resource.extracted?.topic_tags ?? []).map(t => t.toLowerCase())

  useEffect(() => {
    if (tags.length === 0) return
    supabase
      .from('resources')
      .select('id, title, extracted')
      .eq('status', 'ready')
      .neq('id', resource.id)
      .then(({ data }) => {
        const scored = (data ?? [])
          .map(r => {
            const otherTags: string[] = (r.extracted?.topic_tags ?? []).map((t: string) => t.toLowerCase())
            const shared = otherTags.filter(t => tags.includes(t))
            return { id: r.id as string, title: r.title as string, shared }
          })
          .filter(r => r.shared.length > 0)
          .sort((a, b) => b.shared.length - a.shared.length)
          .slice(0, 4)
        setRelated(scored)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id])

  if (related.length === 0) return null

  return (
    <div className="card">
      <p className="section-label mb-3 flex items-center gap-1.5">
        <LibraryIcon className="w-3.5 h-3.5" /> Related in your library
      </p>
      <div className="space-y-2">
        {related.map(r => (
          <Link
            key={r.id}
            href={`/resource/${r.id}`}
            className="flex items-center justify-between gap-3 p-2.5 bg-surface-secondary hover:bg-surface-tertiary rounded-lg transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
            <div className="flex gap-1 shrink-0">
              {r.shared.slice(0, 2).map(t => (
                <span key={t} className="badge bg-brand-50 text-brand-600 text-xs">{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Concepts Tab ─────────────────────────────────────────────
function ConceptsTab({ resource }: { resource: Resource }) {
  const concepts = resource.extracted?.key_concepts ?? []
  return (
    <div className="card">
      <p className="section-label mb-4">Key concepts ({concepts.length})</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {concepts.map((c, i) => (
          <div key={i} className="p-3 bg-surface-secondary rounded-xl border border-surface-border">
            <p className="text-sm font-semibold text-brand-700">{c.term}</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{c.definition}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Quiz Tab ─────────────────────────────────────────────────
function QuizTab({ resource }: { resource: Resource }) {
  const questions: QuizQuestion[] = resource.extracted?.quiz_questions ?? []
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const score = answers.filter((a, i) => a === questions[i].correct).length

  async function handleSubmit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('quiz_attempts').insert({
        resource_id: resource.id,
        user_id: user.id,
        score,
        total: questions.length,
        answers,
      })
    }
    setSubmitted(true)
    setSaving(false)
  }

  if (questions.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-gray-400">No quiz questions available for this resource.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <div className={cn(
          'card border-2 text-center',
          score >= questions.length * 0.7 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        )}>
          <p className="text-2xl font-bold text-gray-900">{score}/{questions.length}</p>
          <p className="text-sm text-gray-500 mt-1">
            {score >= questions.length * 0.7 ? '🎉 Great work!' : '📚 Keep studying — you\'ll get there!'}
          </p>
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={qi} className="card">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi
              const isCorrect = oi === q.correct
              const showResult = submitted

              return (
                <button
                  key={oi}
                  onClick={() => {
                    if (submitted) return
                    setAnswers(prev => prev.map((a, i) => i === qi ? oi : a))
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors',
                    showResult && isCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : showResult && selected && !isCorrect
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : selected
                      ? 'bg-brand-50 border-brand-300 text-brand-800'
                      : 'bg-white border-surface-border hover:border-gray-300 text-gray-700'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {showResult && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {showResult && selected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    {opt}
                  </div>
                </button>
              )
            })}
          </div>
          {submitted && (
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-surface-border">
              <span className="font-medium">Explanation:</span> {q.explanation}
            </p>
          )}
        </div>
      ))}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={answers.some(a => a === null) || saving}
          className="btn-primary w-full justify-center"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? 'Saving…' : `Submit (${answers.filter(a => a !== null).length}/${questions.length} answered)`}
        </button>
      )}

      {submitted && (
        <button
          onClick={() => { setAnswers(Array(questions.length).fill(null)); setSubmitted(false) }}
          className="btn-secondary w-full justify-center"
        >
          Retake quiz
        </button>
      )}
    </div>
  )
}

// ── Q&A Tab ──────────────────────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string }

function QATab({ resource }: { resource: Resource }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: resource.id,
          question,
          history: messages,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      toast.error('Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  const starters = [
    'Summarize this in simple terms',
    'What are the main risks mentioned?',
    'Give me a practical example',
    'How can I apply this?',
  ]

  return (
    <div className="card flex flex-col" style={{ minHeight: '520px' }}>
      <p className="section-label mb-4">Ask questions about this resource</p>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: '380px' }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">Ask anything about this resource</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {starters.map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 bg-surface-tertiary text-gray-600 rounded-full hover:bg-surface-border transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : 'bg-surface-secondary text-gray-800 rounded-bl-sm border border-surface-border'
            )}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-secondary rounded-xl rounded-bl-sm px-3.5 py-2.5 border border-surface-border">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-surface-border">
        <input
          className="input flex-1 text-sm"
          placeholder="Ask a question…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary px-3 py-2" disabled={!input.trim() || loading}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

// ── Notes Tab ────────────────────────────────────────────────
function NotesTab({ resource }: { resource: Resource }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('notes')
      .select('*')
      .eq('resource_id', resource.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data ?? []) as Note[]))
  }, [resource.id])

  async function handleSave() {
    if (!newNote.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notes')
      .insert({ resource_id: resource.id, user_id: user.id, content: newNote })
      .select()
      .single()

    if (data) setNotes(prev => [data as Note, ...prev])
    setNewNote('')
    setSaving(false)
    toast.success('Note saved')
  }

  async function handleDelete(noteId: string) {
    await supabase.from('notes').delete().eq('id', noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-label mb-3">Add a note</p>
        <textarea
          className="input min-h-[100px] resize-none text-sm"
          placeholder="Write your thoughts, key lessons, or things to remember…"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
        />
        <button
          onClick={handleSave}
          disabled={!newNote.trim() || saving}
          className="btn-primary mt-3"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save note
        </button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="card group">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{note.content}</p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="btn-ghost p-1 opacity-0 group-hover:opacity-100 text-red-400 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">{formatDate(note.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No notes yet. Add your first note above.
        </div>
      )}
    </div>
  )
}
