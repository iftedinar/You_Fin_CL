import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractYouTubeTranscript } from '@/lib/extractors/youtube'
import { extractArticle } from '@/lib/extractors/article'
import { extractPDF } from '@/lib/extractors/pdf'
import { extractKnowledge } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rawText = ''
  let title = 'Untitled'
  let sourceType = ''
  let sourceUrl: string | null = null

  try {
    const contentType = req.headers.get('content-type') ?? ''

    // ── PDF upload ──
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await extractPDF(buffer)
      rawText = result.text
      title = result.title
      sourceType = 'pdf'

    } else {
      const body = await req.json()

      if (body.type === 'youtube') {
        sourceUrl = body.url
        const result = await extractYouTubeTranscript(body.url)
        rawText = result.text
        title = result.title
        sourceType = 'youtube'

      } else if (body.type === 'article') {
        sourceUrl = body.url
        const result = await extractArticle(body.url)
        rawText = result.text
        title = result.title
        sourceType = 'article'

      } else if (body.type === 'note') {
        rawText = body.text
        title = body.title || 'Personal note'
        sourceType = 'note'

      } else {
        return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
      }
    }

    // Insert resource as 'processing'
    const { data: resource, error: insertError } = await supabase
      .from('resources')
      .insert({
        user_id: user.id,
        title,
        source_type: sourceType,
        source_url: sourceUrl,
        raw_text: rawText,
        status: 'processing',
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Run AI extraction — awaited so it completes before the serverless function exits
    try {
      const extracted = await extractKnowledge(rawText)
      await supabase
        .from('resources')
        .update({ extracted, title: extracted.title || title, status: 'ready' })
        .eq('id', resource.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed'
      await supabase
        .from('resources')
        .update({ status: 'error', error_message: message })
        .eq('id', resource.id)
    }

    return NextResponse.json({ id: resource.id, title })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
