import { YoutubeTranscript } from 'youtube-transcript'

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function extractYouTubeTranscript(url: string): Promise<{ text: string; title: string }> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const text = transcript.map(t => t.text).join(' ')

    // Try to get title from oEmbed
    let title = `YouTube Video (${videoId})`
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      if (res.ok) {
        const data = await res.json()
        title = data.title ?? title
      }
    } catch {}

    return { text, title }
  } catch (err) {
    throw new Error(`Could not fetch transcript. The video may have transcripts disabled. Error: ${err}`)
  }
}
