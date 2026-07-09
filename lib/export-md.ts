import type { Resource } from '@/lib/types'
import { formatTimestamp } from '@/lib/extractors/youtube'

/** Build an Obsidian/Notion-friendly Markdown document from a resource. */
export function buildMarkdown(resource: Resource): string {
  const ex = resource.extracted
  const lines: string[] = []

  lines.push(`# ${resource.title}`)
  lines.push('')
  const metaBits = [
    `**Source:** ${resource.source_type}`,
    resource.source_url ? `[Original link](${resource.source_url})` : null,
    ex?.difficulty ? `**Level:** ${ex.difficulty}` : null,
    `**Saved:** ${new Date(resource.created_at).toLocaleDateString()}`,
  ].filter(Boolean)
  lines.push(metaBits.join(' · '))
  if (ex?.topic_tags?.length) lines.push(`**Tags:** ${ex.topic_tags.map(t => `#${t.replace(/\s+/g, '-')}`).join(' ')}`)
  lines.push('')

  if (!ex) return lines.join('\n')

  if (ex.summary_short) {
    lines.push('## Summary', '', ex.summary_short, '')
  }
  if (ex.summary_long) {
    lines.push('## Detailed summary', '', ex.summary_long, '')
  }

  if (ex.chapters?.length) {
    lines.push('## Chapters')
    for (const ch of ex.chapters) {
      const ts = ch.start_seconds != null ? ` \`[${formatTimestamp(ch.start_seconds)}]\`` : ''
      lines.push('', `### ${ch.title}${ts}`, '', ch.summary)
      if (ch.key_points?.length) {
        lines.push('')
        for (const p of ch.key_points) lines.push(`- ${p}`)
      }
    }
    lines.push('')
  }

  if (ex.key_takeaways?.length) {
    lines.push('## Key takeaways', '')
    for (const t of ex.key_takeaways) lines.push(`- ${t}`)
    lines.push('')
  }

  if (ex.key_concepts?.length) {
    lines.push('## Key concepts', '')
    for (const c of ex.key_concepts) lines.push(`- **${c.term}** — ${c.definition}`)
    lines.push('')
  }

  if (ex.key_data_points?.length) {
    lines.push('## Data points cited', '')
    for (const d of ex.key_data_points) lines.push(`- **${d.value}** — ${d.context}`)
    lines.push('')
  }

  if (ex.formulas?.length) {
    lines.push('## Formulas', '')
    for (const f of ex.formulas) {
      lines.push(`### ${f.name}`, '', '```', f.formula, '```', '', f.explanation, '')
    }
  }

  if (ex.strategies?.length) {
    lines.push('## Strategies & methods', '')
    for (const s of ex.strategies) {
      lines.push(`### ${s.name}`, '', s.description)
      if (s.conditions) lines.push('', `**When to use:** ${s.conditions}`)
      if (s.risks) lines.push('', `**Risks:** ${s.risks}`)
      lines.push('')
    }
  }

  if (ex.mentioned_resources?.length) {
    lines.push('## Mentioned in this resource', '')
    for (const m of ex.mentioned_resources) lines.push(`- **${m.name}** (${m.type}) — ${m.context}`)
    lines.push('')
  }

  if (ex.flashcards?.length) {
    lines.push('## Flashcards', '')
    for (const f of ex.flashcards) lines.push(`- **Q:** ${f.front}`, `  **A:** ${f.back}`)
    lines.push('')
  }

  if (ex.go_deeper?.length) {
    lines.push('## Go deeper', '')
    for (const g of ex.go_deeper) lines.push(`- **${g.topic}** — ${g.why} _(search: "${g.suggested_search}")_`)
    lines.push('')
  }

  if (ex.quiz_questions?.length) {
    lines.push('## Quiz', '')
    ex.quiz_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`)
      q.options.forEach((opt, oi) => {
        lines.push(`   - ${oi === q.correct ? '✅' : '▫️'} ${opt}`)
      })
      lines.push(`   > ${q.explanation}`, '')
    })
  }

  return lines.join('\n')
}

export function downloadMarkdown(resource: Resource) {
  const md = buildMarkdown(resource)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resource.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'resource'}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
