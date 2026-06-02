import { extract } from '@extractus/article-extractor'

export async function extractArticle(url: string): Promise<{ text: string; title: string }> {
  const result = await extract(url)

  if (!result) throw new Error('Could not extract article content from this URL')

  const raw = result.content ?? ''
  // Strip HTML tags
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  if (!text || text.length < 100) {
    throw new Error('Article content is too short or could not be extracted')
  }

  return {
    text,
    title: result.title ?? new URL(url).hostname,
  }
}
