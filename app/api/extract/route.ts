import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractYouTubeTranscript } from '@/lib/extractors/youtube'
import { extractArticle } from '@/lib/extractors/article'
import { extractPDF } from '@/lib/extractors/pdf'
import { extractDOCX } from '@/lib/extractors/docx'
import { extractTXT } from '@/lib/extractors/txt'
import { extractKnowledge, type SourceMeta } from '@/lib/claude'

// Long videos use chunked extraction and can exceed 60s.
// On Vercel Hobby with Fluid Compute this allows up to 300s.
export const maxDuration = 300

function detectUrlType(url: string): 'youtube' | 'article' {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
  } catch {}
  return 'article'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rawText = ''
  let title = 'Untitled'
  let sourceType = ''
  let sourceUrl: string | null = null
  const meta: SourceMeta = {}

  try {
    const contentType = req.headers.get('content-type') ?? ''

    // ── File upload ──
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

      if (ext === 'pdf') {
        const result = await extractPDF(buffer)
        rawText = result.text
        title = result.title
        sourceType = 'pdf'
      } else if (ext === 'docx') {
        const result = await extractDOCX(buffer)
        rawText = result.text
        title = result.title
        sourceType = 'docx'
      } else if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
        const result = await extractTXT(buffer, file.name)
        rawText = result.text
        title = result.title
        sourceType = 'txt'
      } else {
        return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD files.' }, { status: 400 })
      }

    } else {
      const body = await req.json()
      const type = body.type === 'url' ? detectUrlType(body.url) : body.type

      if (type === 'youtube') {
        sourceUrl = body.url
        const result = await extractYouTubeTranscript(body.url)
        rawText = result.text
        title = result.title
        sourceType = 'youtube'
        meta.author = result.author
        meta.durationSeconds = result.durationSeconds

      } else if (type === 'article') {
        sourceUrl = body.url
        const result = await extractArticle(body.url)
        rawText = result.text
        title = result.title
        sourceType = 'article'
        meta.author = result.author

      } else if (type === 'note') {
        rawText = body.text
        title = body.title || 'Personal note'
        sourceType = 'note'

      } else {
        return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
      }
    }

    meta.sourceType = sourceType
    meta.title = title

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
      const extracted = await extractKnowledge(rawText, meta)
      await supabase
        .from('resources')
        .update({ extracted, title: extracted.title || title, status: 'ready' })
        .eq('id', resource.id)

      // Seed spaced-repetition flashcards (best-effort — table may not exist yet)
      if (extracted.flashcards.length > 0) {
        const { error: fcError } = await supabase.from('flashcards').insert(
          extracted.flashcards
            .filter(f => f.front && f.back)
            .map(f => ({
              user_id: user.id,
              resource_id: resource.id,
              front: f.front,
              back: f.back,
            }))
        )
        if (fcError) console.error('Flashcard insert failed (run the flashcards migration?):', fcError.message)
      }
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
