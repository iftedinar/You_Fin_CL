import { extract } from '@extractus/article-extractor'

export interface ArticleExtract {
  text: string
  title: string
  author: string | null
  siteName: string | null
}

/**
 * Convert extracted HTML into structure-preserving plain text:
 * headings become markdown #'s, list items become bullets, paragraphs keep
 * their breaks. This lets the AI see the article's actual structure instead
 * of a single flattened blob.
 */
function htmlToStructuredText(html: string): string {
  let t = html
    // Remove non-content blocks entirely
    .replace(/<(script|style|noscript|iframe|svg|figure)[\s\S]*?<\/\1>/gi, ' ')
    // Headings → markdown
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h[456][^>]*>([\s\S]*?)<\/h[456]>/gi, '\n\n#### $1\n\n')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<\/(ul|ol)>/gi, '\n')
    // Block quotes / code
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n$1\n\n')
    // Tables → rows on their own lines, cells separated by |
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    // Paragraphs and breaks
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')

  // Decode common entities
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')

  // Collapse whitespace but keep paragraph breaks
  return t
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Strategy 1: @extractus/article-extractor ──
async function viaExtractus(url: string): Promise<ArticleExtract> {
  const result = await extract(url)
  if (!result) throw new Error('Extractor returned nothing')

  const text = htmlToStructuredText(result.content ?? '')
  if (!text || text.length < 200) throw new Error('Extracted content too short')

  return {
    text,
    title: result.title ?? new URL(url).hostname,
    author: result.author || null,
    siteName: result.source || null,
  }
}

// ── Strategy 2: Jina Reader (free; JINA_API_KEY optional for higher limits) ──
// Renders JavaScript-heavy pages and returns clean markdown.
async function viaJinaReader(url: string): Promise<ArticleExtract> {
  const headers: Record<string, string> = { Accept: 'text/plain' }
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`

  const res = await fetch(`https://r.jina.ai/${url}`, { headers })
  if (!res.ok) throw new Error(`Jina Reader returned ${res.status}`)

  const raw = await res.text()
  if (!raw || raw.length < 300) throw new Error('Jina Reader content too short')

  // Jina prepends "Title: ...\nURL Source: ...\nMarkdown Content:\n"
  let title = new URL(url).hostname
  const titleMatch = raw.match(/^Title:\s*(.+)$/m)
  if (titleMatch) title = titleMatch[1].trim()
  const bodyIdx = raw.indexOf('Markdown Content:')
  const text = (bodyIdx >= 0 ? raw.slice(bodyIdx + 'Markdown Content:'.length) : raw).trim()

  if (text.length < 200) throw new Error('Jina Reader body too short')
  return { text, title, author: null, siteName: null }
}

export async function extractArticle(url: string): Promise<ArticleExtract> {
  const errors: string[] = []
  for (const strategy of [viaExtractus, viaJinaReader]) {
    try {
      return await strategy(url)
    } catch (err) {
      errors.push(`${strategy.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  throw new Error(
    'Could not extract readable content from this URL. It may be paywalled, require login, or block bots. ' +
    `Details: ${errors.join(' | ')}`
  )
}
