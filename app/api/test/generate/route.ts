
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCrossResourceQuiz } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const count = body?.count ?? 10

  const { data: resources, error } = await supabase
    .from('resources')
    .select('title, extracted')
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .not('extracted', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error || !resources || resources.length === 0) {
    return NextResponse.json({ error: 'No resources available to build a test from yet' }, { status: 400 })
  }

  const summaries = resources.map(r => {
    const ex = r.extracted as any
    return {
      title: r.title,
      difficulty: ex?.difficulty ?? 'unknown',
      tags: (ex?.topic_tags ?? []) as string[],
      concepts: ((ex?.key_concepts ?? []) as any[]).map(c => `${c.term}: ${c.definition}`).slice(0, 8),
      takeaways: ((ex?.key_takeaways ?? []) as string[]).slice(0, 6),
    }
  })

  try {
    const questions = await generateCrossResourceQuiz(summaries, count)
    return NextResponse.json({ questions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to generate questions' }, { status: 500 })
  }
}
