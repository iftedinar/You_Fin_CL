'use client'

import { useState, useRef } from 'react'
import { X, Youtube, Globe, FileText, StickyNote, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Tab = 'youtube' | 'article' | 'pdf' | 'note'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'article', label: 'Article', icon: Globe },
  { id: 'pdf',     label: 'PDF',     icon: FileText },
  { id: 'note',    label: 'Note',    icon: StickyNote },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function AddResourceModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('youtube')
  const [url, setUrl] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setUrl(''); setNoteText(''); setNoteTitle(''); setFile(null); setLoading(false)
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (tab === 'pdf' && file) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/extract', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
        toast.success('PDF added! Extracting knowledge…')
      } else if (tab === 'note') {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'note', text: noteText, title: noteTitle }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to save note')
        toast.success('Note added! Extracting knowledge…')
      } else {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: tab, url }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
        toast.success('Resource added! Extracting knowledge…')
      }

      handleClose()
      // Refresh the library page
      window.dispatchEvent(new Event('resource-added'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = tab === 'pdf'
    ? !!file
    : tab === 'note'
    ? noteText.trim().length > 20
    : url.trim().length > 5

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg border border-surface-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-base font-semibold text-gray-900">Add resource</h2>
          <button onClick={handleClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-5 pt-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                tab === id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-surface-tertiary'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {(tab === 'youtube' || tab === 'article') && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                {tab === 'youtube' ? 'YouTube URL' : 'Article URL'}
              </label>
              <input
                type="url"
                className="input"
                placeholder={
                  tab === 'youtube'
                    ? 'https://youtube.com/watch?v=...'
                    : 'https://example.com/article'
                }
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {tab === 'youtube'
                  ? 'Works with any YouTube video that has captions enabled'
                  : 'Works with most news sites, blogs, and online articles'}
              </p>
            </div>
          )}

          {tab === 'pdf' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">PDF file</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                  file ? 'border-brand-300 bg-brand-50' : 'border-surface-border hover:border-brand-300 hover:bg-surface-tertiary'
                )}
              >
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                {file ? (
                  <p className="text-sm text-brand-700 font-medium">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 font-medium">Click to upload PDF</p>
                    <p className="text-xs text-gray-400 mt-1">Up to 20 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {tab === 'note' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. My notes on moving averages"
                  value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Your notes</label>
                <textarea
                  className="input min-h-[140px] resize-y"
                  placeholder="Paste your notes, ideas, or text you want to learn from…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{noteText.length} characters</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit || loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Processing…' : 'Extract knowledge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
