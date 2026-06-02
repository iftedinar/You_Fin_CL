import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { answerQuestion } from '@/lib/claude'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resourceId, question, history } = await req.json()
  if (!resourceId || !question) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Fetch the resource
  const { data: resource, error } = await supabase
    .from('resources')
    .select('raw_text, extracted, title')
    .eq('id', resourceId)
    .eq('user_id', user.id)
    .single()

  if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

  const context = resource.raw_text ?? JSON.stringify(resource.extracted)
  const answer = await answerQuestion(question, context, history ?? [])

  return NextResponse.json({ answer })
}
