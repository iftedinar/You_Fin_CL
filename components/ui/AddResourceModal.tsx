'use client'

import { useState, useRef } from 'react'
import { X, Link, Upload, StickyNote, Loader2, FileText, Youtube, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Tab = 'url' | 'file' | 'note'

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.md'
const ACCEPTED_MIME = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return FileText
  if (ext === 'docx') return FileText
  return FileText
}

function detectUrlHint(url: string): 'youtube' | 'article' | null {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    return 'article'
  } catch {
    return null
  }
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function AddResourceModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('url')
  const [url, setUrl] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setUrl(''); setNoteText(''); setNoteTitle(''); setFile(null); setLoading(false); setDragOver(false)
  }

  function handleClose() { reset(); onClose() }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (tab === 'file' && file) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/extract', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
        toast.success(`${file.name} added! Extracting knowledge…`)

      } else if (tab === 'note') {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'note', text: noteText, title: noteTitle }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to save note')
        toast.success('Note added! Extracting knowledge…')

      } else if (tab === 'url') {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', url }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
        toast.success('Resource added! Extracting knowledge…')
      }

      handleClose()
      window.dispatchEvent(new Event('resource-added'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const urlHint = detectUrlHint(url)
  const canSubmit = tab === 'file'
    ? !!file
    : tab === 'note'
    ? noteText.trim().length > 20
    : url.trim().length > 10

  const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'url',  label: 'Public URL',   icon: Link,      desc: 'YouTube video or any article' },
    { id: 'file', label: 'Upload File',  icon: Upload,    desc: 'PDF, Word, TXT, or Markdown' },
    { id: 'note', label: 'Paste Text',   icon: StickyNote, desc: 'Your own notes or copied text' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg border border-surface-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add learning resource</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI will extract a summary, concepts, and quiz questions</p>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {TABS.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all',
                tab === id
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-surface-border text-gray-500 hover:border-gray-300 hover:bg-surface-tertiary'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-xs text-gray-400 leading-tight hidden sm:block">{desc}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* URL tab */}
          {tab === 'url' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                URL
              </label>
              <input
                type="url"
                className="input"
                placeholder="https://youtube.com/watch?v=... or https://any-article.com/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                autoFocus
              />
              {urlHint && (
                <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                  {urlHint === 'youtube'
                    ? <><Youtube className="w-3.5 h-3.5 text-red-500" /> Detected: YouTube video — will extract transcript</>
                    : <><Globe className="w-3.5 h-3.5 text-blue-500" /> Detected: Web article — will extract article text</>
                  }
                </p>
              )}
              {!urlHint && (
                <p className="text-xs text-gray-400 mt-2">
                  Works with YouTube videos (needs captions) and public web articles
                </p>
              )}
            </div>
          )}

          {/* File upload tab */}
          {tab === 'file' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                File <span className="text-gray-400 font-normal">— PDF, DOCX, TXT, or MD (max 20 MB)</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  dragOver
                    ? 'border-brand-400 bg-brand-50'
                    : file
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-surface-border hover:border-brand-300 hover:bg-surface-tertiary'
                )}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-brand-500" />
                    <p className="text-sm font-semibold text-brand-700">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB — click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">
                      {dragOver ? 'Drop it here' : 'Click to browse or drag & drop'}
                    </p>
                    <p className="text-xs text-gray-400">PDF · Word (DOCX) · Plain text (TXT) · Markdown (MD)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Note / paste text tab */}
          {tab === 'note' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Title <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. My notes on machine learning"
                  value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Text</label>
                <textarea
                  className="input min-h-[160px] resize-y"
                  placeholder="Paste your notes, a chapter from a book, copied text, or anything you want to learn from…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{noteText.length} chars {noteText.length < 20 && noteText.length > 0 ? '— add more text' : ''}</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-1 border-t border-surface-border">
            <button type="button" onClick={handleClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit || loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Extracting… (up to 60s)' : 'Extract knowledge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
