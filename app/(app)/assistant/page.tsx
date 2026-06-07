'use client'

import { useEffect, useState, useRef } from 'react'
import { Sparkles, Loader2, ChevronRight, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Message = { role: 'user' | 'assistant'; content: string }

const SAMPLE_QUESTIONS = [
  'Explain compound interest with a real example',
  "What's the difference between stocks and bonds?",
  'What is dollar-cost averaging and when does it make sense?',
  'How do I read a candlestick chart?',
  'Technical analysis vs. fundamental analysis — what is the difference?',
  'What does a P/E ratio actually tell you?',
  'What are the biggest risks new traders overlook?',
  "Summarize the strategies across the resources I've saved",
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(question: string) {
    if (!question.trim() || loading) return
    setInput('')
    const history = messages
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      toast.error('Failed to get a response')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Ask anything about finance and trading — your assistant knows what&apos;s in your library and can also answer from general knowledge.
      </p>

      <div className="card flex flex-col" style={{ minHeight: '560px' }}>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: '430px' }}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">Try one of these, or ask your own question</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                {SAMPLE_QUESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
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
                'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
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

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-surface-border">
          <input
            className="input flex-1 text-sm"
            placeholder="Ask about finance, trading, or anything in your library…"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary px-3 py-2" disabled={!input.trim() || loading}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
