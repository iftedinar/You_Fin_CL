'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, Sparkles, RotateCcw, ListChecks } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Resource, QuizQuestion } from '@/lib/types'
import toast from 'react-hot-toast'

type Stage = 'setup' | 'quiz' | 'results'

const QUESTION_COUNT = 10

export default function TestPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loadingLib, setLoadingLib] = useState(true)
  const [stage, setStage] = useState<Stage>('setup')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
      setResources((data ?? []) as Resource[])
      setLoadingLib(false)
    })()
  }, [])

  const pooledQuestions = resources.flatMap(r => r.extracted?.quiz_questions ?? [])

  function startQuickTest() {
    if (pooledQuestions.length === 0) {
      toast.error('No saved quiz questions yet — add some resources first')
      return
    }
    const shuffled = [...pooledQuestions].sort(() => Math.random() - 0.5).slice(0, QUESTION_COUNT)
    setQuestions(shuffled)
    setAnswers(Array(shuffled.length).fill(null))
    setStage('quiz')
  }

  async function generateFresh() {
    if (resources.length === 0) {
      toast.error("Add some resources first so there's material to test you on")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: QUESTION_COUNT }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate')
      if (!data.questions?.length) throw new Error('No questions generated')
      setQuestions(data.questions)
      setAnswers(Array(data.questions.length).fill(null))
      setStage('quiz')
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  const score = answers.filter((a, i) => a === questions[i]?.correct).length

  async function handleSubmit() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('test_attempts').insert({
          user_id: user.id,
          resource_ids: resources.map(r => r.id),
          score,
          total: questions.length,
          answers,
          questions,
        })
      }
    } catch {
      // non-fatal — keep going to results either way
    }
    setSaving(false)
    setStage('results')
  }

  function reset() {
    setQuestions([])
    setAnswers([])
    setStage('setup')
  }

  if (loadingLib) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <ListChecks className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Test</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Quiz yourself across everything you&apos;ve saved — mix questions from your library or have the AI generate fresh ones that connect ideas across resources.
      </p>

      {stage === 'setup' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-gray-600">
              You have <span className="font-semibold text-gray-900">{resources.length}</span> ready resource{resources.length === 1 ? '' : 's'} with{' '}
              <span className="font-semibold text-gray-900">{pooledQuestions.length}</span> saved quiz question{pooledQuestions.length === 1 ? '' : 's'} to draw from.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card flex flex-col">
              <p className="font-semibold text-gray-900 text-sm mb-1">Quick test</p>
              <p className="text-xs text-gray-500 mb-4 flex-1">
                Pulls {Math.min(QUESTION_COUNT, pooledQuestions.length)} random questions from across your saved resources. Fast — no AI call needed.
              </p>
              <button onClick={startQuickTest} className="btn-secondary w-full justify-center text-sm">
                Start quick test
              </button>
            </div>

            <div className="card flex flex-col border-brand-200">
              <p className="font-semibold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" /> Generate new questions
              </p>
              <p className="text-xs text-gray-500 mb-4 flex-1">
                AI writes a fresh set of {QUESTION_COUNT} questions that connect and compare ideas across your resources — never the same test twice.
              </p>
              <button onClick={generateFresh} disabled={generating} className="btn-primary w-full justify-center text-sm">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate & start'}
              </button>
            </div>
          </div>

          {resources.length === 0 && (
            <div className="card text-center py-8 text-sm text-gray-400">
              Add a few resources to your library first — the test draws on what you&apos;ve saved.
            </div>
          )}
        </div>
      )}

      {stage === 'quiz' && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="card">
              <p className="text-sm font-semibold text-gray-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi
                  return (
                    <button
                      key={oi}
                      onClick={() => setAnswers(prev => prev.map((a, i) => i === qi ? oi : a))}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors',
                        selected ? 'bg-brand-50 border-brand-300 text-brand-800' : 'bg-white border-surface-border hover:border-gray-300 text-gray-700'
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={answers.some(a => a === null) || saving}
            className="btn-primary w-full justify-center"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : `Submit (${answers.filter(a => a !== null).length}/${questions.length} answered)`}
          </button>
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-4">
          <div className={cn(
            'card border-2 text-center',
            score >= questions.length * 0.7 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
          )}>
            <p className="text-2xl font-bold text-gray-900">{score}/{questions.length}</p>
            <p className="text-sm text-gray-500 mt-1">
              {score >= questions.length * 0.7 ? '🎉 Strong grasp across your library!' : '📚 Good check-in — review the explanations below and try again.'}
            </p>
          </div>

          {questions.map((q, qi) => {
            const selected = answers[qi]
            const correct = q.correct
            return (
              <div key={qi} className="card">
                <p className="text-sm font-semibold text-gray-900 mb-3">{qi + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2',
                        oi === correct
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : oi === selected
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-surface-border text-gray-700'
                      )}
                    >
                      {oi === correct && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                      {oi === selected && oi !== correct && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      {opt}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-surface-border">
                  <span className="font-medium">Explanation:</span> {q.explanation}
                </p>
              </div>
            )
          })}

          <button onClick={reset} className="btn-secondary w-full justify-center">
            <RotateCcw className="w-4 h-4" /> Take another test
          </button>
        </div>
      )}
    </div>
  )
}
