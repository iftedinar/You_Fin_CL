
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { answerLibraryQuestion } from '@/lib/claude'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, history } = await req.json()
  if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 })

  const { data: resources } = await supabase
    .from('resources')
    .select('title, source_type, extracted, status')
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(40)

  const libraryContext = (resources ?? [])
    .filter(r => r.extracted)
    .map(r => {
      const ex = r.extracted as any
      const concepts = (ex?.key_concepts ?? []).slice(0, 6).map((c: any) => c.term).join(', ')
      const tags = (ex?.topic_tags ?? []).join(', ')
      return `• "${r.title}" (${r.source_type}, ${ex?.difficulty ?? 'unknown'} level) — tags: ${tags || 'none'} — concepts: ${concepts || 'none'}`
    })
    .join('\n')

  const answer = await answerLibraryQuestion(question, libraryContext, history ?? [])

  return NextResponse.json({ answer })
}
