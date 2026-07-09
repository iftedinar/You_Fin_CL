import { Innertube } from 'youtubei.js'
import { YoutubeTranscript } from 'youtube-transcript'
import type { TranscriptSegment } from '@/lib/types'

export interface YouTubeExtract {
  /** Transcript with [MM:SS] markers every ~30s — feed this to the AI so it can cite timestamps */
  text: string
  segments: TranscriptSegment[]
  title: string
  author: string | null
  durationSeconds: number | null
  description: string | null
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** Join segments into text with a [MM:SS] marker at the start of each ~30s block. */
function buildTimestampedText(segments: TranscriptSegment[]): string {
  const BLOCK = 30
  let out = ''
  let nextMark = 0
  for (const seg of segments) {
    if (seg.start >= nextMark) {
      out += `\n[${formatTimestamp(seg.start)}] `
      nextMark = Math.floor(seg.start / BLOCK) * BLOCK + BLOCK
    }
    out += seg.text.replace(/\s+/g, ' ').trim() + ' '
  }
  return out.trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

// ── Strategy 1: youtubei.js (Innertube) — most reliable, includes metadata ──
async function viaInnertube(videoId: string): Promise<YouTubeExtract> {
  const yt = await Innertube.create({ retrieve_player: false })
  const info = await yt.getInfo(videoId)

  const transcriptInfo = await info.getTranscript()
  const rawSegments = transcriptInfo?.transcript?.content?.body?.initial_segments ?? []
  if (rawSegments.length === 0) throw new Error('No transcript segments returned')

  const segments: TranscriptSegment[] = []
  for (const seg of rawSegments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = seg as any
    const text = decodeEntities(String(s?.snippet?.text ?? '')).trim()
    if (!text) continue
    segments.push({ start: Number(s.start_ms ?? 0) / 1000, text })
  }
  if (segments.length === 0) throw new Error('Transcript was empty')

  return {
    text: buildTimestampedText(segments),
    segments,
    title: info.basic_info.title ?? `YouTube Video (${videoId})`,
    author: info.basic_info.author ?? null,
    durationSeconds: info.basic_info.duration ?? null,
    description: info.basic_info.short_description?.slice(0, 2000) ?? null,
  }
}

// ── Strategy 2: youtube-transcript package (legacy fallback) ──
async function viaYoutubeTranscript(videoId: string): Promise<YouTubeExtract> {
  const items = await YoutubeTranscript.fetchTranscript(videoId)
  if (!items || items.length === 0) throw new Error('No transcript returned')

  const segments: TranscriptSegment[] = items.map(t => ({
    // Some versions report offset in ms, some in seconds — normalize
    start: t.offset > 36000 ? t.offset / 1000 : t.offset,
    text: decodeEntities(t.text).trim(),
  })).filter(s => s.text)

  return {
    text: buildTimestampedText(segments),
    segments,
    title: await fetchOEmbedTitle(videoId),
    author: null,
    durationSeconds: null,
    description: null,
  }
}

// ── Strategy 3: Supadata API (optional — set SUPADATA_API_KEY) ──
async function viaSupadata(videoId: string): Promise<YouTubeExtract> {
  const key = process.env.SUPADATA_API_KEY
  if (!key) throw new Error('SUPADATA_API_KEY not set (optional fallback)')

  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
    { headers: { 'x-api-key': key } }
  )
  if (!res.ok) throw new Error(`Supadata returned ${res.status}`)
  const data = await res.json()
  const content: Array<{ text: string; offset: number }> = data.content ?? []
  if (content.length === 0) throw new Error('Supadata returned empty transcript')

  const segments: TranscriptSegment[] = content.map(c => ({
    start: (c.offset ?? 0) / 1000,
    text: decodeEntities(c.text).trim(),
  })).filter(s => s.text)

  return {
    text: buildTimestampedText(segments),
    segments,
    title: await fetchOEmbedTitle(videoId),
    author: null,
    durationSeconds: null,
    description: null,
  }
}

async function fetchOEmbedTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (res.ok) {
      const data = await res.json()
      if (data.title) return data.title
    }
  } catch { /* ignore */ }
  return `YouTube Video (${videoId})`
}

export async function extractYouTubeTranscript(url: string): Promise<YouTubeExtract> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const errors: string[] = []

  for (const strategy of [viaInnertube, viaYoutubeTranscript, viaSupadata]) {
    try {
      return await strategy(videoId)
    } catch (err) {
      errors.push(`${strategy.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(
    'Could not fetch a transcript for this video. It may have captions disabled, be private, or be a live stream. ' +
    `Details: ${errors.join(' | ')}`
  )
}
