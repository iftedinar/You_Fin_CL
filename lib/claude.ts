import OpenAI from 'openai'
import type { ExtractedKnowledge, QuizQuestion } from '@/lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Configurable via env — no code change needed to upgrade models
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini'

const MAX_CHARS = 400_000        // hard cap (~2.5 hrs of dense transcript)
const SINGLE_PASS_LIMIT = 26_000 // above this, use chunked map-reduce
const TARGET_CHUNK = 22_000
const MAX_CHUNKS = 10

export interface SourceMeta {
  sourceType?: string
  title?: string | null
  author?: string | null
  durationSeconds?: number | null
}

// ─────────────────────────────────────────────────────────────
// Shared output schema (kept in one place so map/reduce/single-pass agree)
// ─────────────────────────────────────────────────────────────
const FINAL_SCHEMA = `{
  "title": "Clear descriptive title",
  "summary_short": "2-3 sentence overview",
  "summary_long": "Detailed multi-paragraph summary (paragraphs separated by \\n\\n)",
  "chapters": [
    {
      "title": "Section/chapter name",
      "start_seconds": 123,
      "summary": "2-4 sentence summary of what THIS section covers",
      "key_points": ["specific point made in this section", "..."]
    }
  ],
  "key_concepts": [
    { "term": "concept name", "definition": "clear, complete definition (1-3 sentences) with a concrete example where it helps" }
  ],
  "key_takeaways": ["Actionable or important lesson as a full sentence, specific to this content"],
  "key_data_points": [
    { "value": "the specific number/statistic/date exactly as stated", "context": "what it refers to and why it matters" }
  ],
  "formulas": [
    { "name": "formula name", "formula": "the formula itself", "explanation": "what it means, when to use it, plus a short worked numeric example" }
  ],
  "strategies": [
    { "name": "strategy name", "description": "what it is and how it works", "conditions": "when/where to use it", "risks": "what can go wrong or its limitations" }
  ],
  "mentioned_resources": [
    { "name": "exact name of book/tool/website/person/ticker/course mentioned", "type": "book|tool|website|ticker|person|course|other", "context": "why it was mentioned / what was said about it" }
  ],
  "flashcards": [
    { "front": "question or term prompting recall", "back": "concise correct answer (1-3 sentences)" }
  ],
  "go_deeper": [
    { "topic": "a related topic worth studying next", "why": "how it builds on this content and what gap it fills", "suggested_search": "a specific search query to find good material on it" }
  ],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "topic_tags": ["tag1", "tag2"],
  "quiz_questions": [
    { "question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "why correct, briefly why others are not" }
  ]
}`

interface ExtractionPlan {
  label: string
  concepts: string
  takeaways: string
  chapters: string
  quiz: string
  flashcards: string
  summaryGuidance: string
  maxTokens: number
}

function planExtraction(length: number): ExtractionPlan {
  if (length < 3000) {
    return {
      label: 'short-form',
      concepts: '4-6', takeaways: '4-6', chapters: '2-4', quiz: '5-6', flashcards: '8-10',
      summaryGuidance: 'summary_long should be 2-3 focused paragraphs — do not pad short content with filler.',
      maxTokens: 6000,
    }
  }
  if (length < 12000) {
    return {
      label: 'medium-length',
      concepts: '7-10', takeaways: '6-9', chapters: '4-7', quiz: '7-9', flashcards: '10-14',
      summaryGuidance: 'summary_long should be 4-6 paragraphs following the order the content was presented.',
      maxTokens: 9000,
    }
  }
  return {
    label: 'long-form',
    concepts: '11-16', takeaways: '9-12', chapters: '6-12', quiz: '10-14', flashcards: '14-20',
    summaryGuidance: 'summary_long should be 6-10 paragraphs walking through the material section by section, in order, so a reader who never saw the source could follow the full arc.',
    maxTokens: 14000,
  }
}

function safeParseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T
    }
    throw new Error('AI returned invalid JSON. Please try again.')
  }
}

/** Fill any missing arrays so the UI never crashes on older/partial extractions. */
export function normalizeExtracted(ex: Partial<ExtractedKnowledge>): ExtractedKnowledge {
  return {
    title: ex.title ?? 'Untitled',
    summary_short: ex.summary_short ?? '',
    summary_long: ex.summary_long ?? '',
    chapters: ex.chapters ?? [],
    key_concepts: ex.key_concepts ?? [],
    key_takeaways: ex.key_takeaways ?? [],
    key_data_points: ex.key_data_points ?? [],
    formulas: ex.formulas ?? [],
    strategies: ex.strategies ?? [],
    mentioned_resources: ex.mentioned_resources ?? [],
    flashcards: ex.flashcards ?? [],
    go_deeper: ex.go_deeper ?? [],
    difficulty: ex.difficulty ?? 'intermediate',
    topic_tags: ex.topic_tags ?? [],
    quiz_questions: ex.quiz_questions ?? [],
  }
}

function metaHeader(meta?: SourceMeta): string {
  if (!meta) return ''
  const parts: string[] = []
  if (meta.sourceType) parts.push(`Source type: ${meta.sourceType}`)
  if (meta.title) parts.push(`Original title: ${meta.title}`)
  if (meta.author) parts.push(`Author/channel: ${meta.author}`)
  if (meta.durationSeconds) parts.push(`Duration: ${Math.round(meta.durationSeconds / 60)} minutes`)
  return parts.length ? `Source metadata:\n${parts.join('\n')}\n\n` : ''
}

const TIMESTAMP_RULES = `Timestamps: the text contains [MM:SS] or [H:MM:SS] markers. For each chapter, set "start_seconds" to the (integer) seconds value of the marker nearest to where that section begins. If the text has NO such markers, set "start_seconds" to null for every chapter.`

// ─────────────────────────────────────────────────────────────
// Single-pass extraction (short/medium content)
// ─────────────────────────────────────────────────────────────
async function extractSinglePass(rawText: string, meta?: SourceMeta): Promise<ExtractedKnowledge> {
  const plan = planExtraction(rawText.length)

  const prompt = `You are an expert knowledge-extraction assistant. Your job is to pull EVERYTHING teachable out of the source below so a learner never needs to re-watch/re-read it. Prefer specifics over generalities: exact numbers, named examples, verbatim terms.

${metaHeader(meta)}This is ${plan.label} content (~${rawText.length.toLocaleString()} characters).

Return ONLY a valid JSON object with exactly this structure:

${FINAL_SCHEMA}

Extraction targets for THIS content:
- chapters: ${plan.chapters} — break the content into its natural sections IN ORDER; each chapter's key_points must be concrete and specific to that section (numbers, examples, names — not vague restatements). ${TIMESTAMP_RULES}
- key_concepts: ${plan.concepts}
- key_takeaways: ${plan.takeaways}
- key_data_points: every specific number, statistic, percentage, price, date, or study result actually cited (empty array if none)
- formulas: every formula/equation that appears, each with a short worked numeric example (empty array if none — NEVER invent)
- strategies: every strategy/framework/method discussed, with conditions and risks (empty array if none)
- mentioned_resources: every book, tool, website, course, ticker, or person the source explicitly references (empty array if none)
- flashcards: ${plan.flashcards} — mix term→definition, concept→application, and number/fact recall; fronts must be answerable WITHOUT seeing the source
- go_deeper: 4-6 related topics to study next, ordered from most natural next step to most advanced
- quiz_questions: ${plan.quiz} — mix recall, application, and scenario questions; vary which option index is correct
- topic_tags: 3-8 tags
- ${plan.summaryGuidance}
- difficulty: judge by complexity, not length

Quality bar: every field must reflect what is actually IN the source — never invent facts. But do NOT under-extract: if it's in the source and teachable, capture it.

Content:
---
${rawText}
---`

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: plan.maxTokens,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  return normalizeExtracted(safeParseJSON<Partial<ExtractedKnowledge>>(response.choices[0]?.message?.content ?? ''))
}

// ─────────────────────────────────────────────────────────────
// Chunked map-reduce extraction (long content)
// Map: cheap fast model reads every chunk in parallel and takes detailed notes.
// Reduce: main model merges the notes into the final structured output.
// This means a 2-hour lecture gets FULLY read — nothing is truncated away.
// ─────────────────────────────────────────────────────────────
interface ChunkNotes {
  sections: Array<{ title: string; start_marker: string | null; summary: string; key_points: string[] }>
  concepts: Array<{ term: string; definition: string }>
  data_points: Array<{ value: string; context: string }>
  formulas: Array<{ name: string; formula: string; explanation: string }>
  strategies: Array<{ name: string; description: string; conditions: string; risks: string }>
  mentioned_resources: Array<{ name: string; type: string; context: string }>
  notable_quotes: string[]
}

function splitIntoChunks(text: string): string[] {
  const total = text.length
  const chunkSize = Math.max(TARGET_CHUNK, Math.ceil(total / MAX_CHUNKS))
  const chunks: string[] = []
  let pos = 0
  while (pos < total) {
    let end = Math.min(pos + chunkSize, total)
    if (end < total) {
      // Prefer breaking at a timestamp marker or paragraph within the last 15%
      const windowStart = end - Math.floor(chunkSize * 0.15)
      const window = text.slice(windowStart, end)
      const tsIdx = window.lastIndexOf('\n[')
      const paraIdx = window.lastIndexOf('\n\n')
      const cut = Math.max(tsIdx, paraIdx)
      if (cut > 0) end = windowStart + cut
    }
    chunks.push(text.slice(pos, end))
    pos = end
  }
  return chunks
}

async function extractChunkNotes(chunk: string, index: number, total: number, meta?: SourceMeta): Promise<ChunkNotes> {
  const prompt = `You are taking DETAILED study notes on part ${index + 1} of ${total} of a longer source. Capture everything teachable in THIS part — specifics, not generalities. Another AI will merge all parts, so err on the side of including more.

${metaHeader(meta)}Return ONLY valid JSON:

{
  "sections": [
    { "title": "natural section name", "start_marker": "[MM:SS] marker where this section starts, or null if no markers present", "summary": "2-4 sentences on what this section covers", "key_points": ["specific concrete point (numbers, names, examples)", "..."] }
  ],
  "concepts": [ { "term": "...", "definition": "1-3 sentence definition as explained in the source" } ],
  "data_points": [ { "value": "exact number/stat/date as stated", "context": "what it refers to" } ],
  "formulas": [ { "name": "...", "formula": "...", "explanation": "..." } ],
  "strategies": [ { "name": "...", "description": "...", "conditions": "...", "risks": "..." } ],
  "mentioned_resources": [ { "name": "book/tool/site/ticker/person/course mentioned", "type": "book|tool|website|ticker|person|course|other", "context": "what was said about it" } ],
  "notable_quotes": ["short verbatim quote worth remembering (max 3)"]
}

Rules: 2-5 sections for this part. Empty arrays where nothing applies — NEVER invent. Use empty array, not null.

Part ${index + 1}/${total}:
---
${chunk}
---`

  const response = await openai.chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 4000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  const parsed = safeParseJSON<Partial<ChunkNotes>>(response.choices[0]?.message?.content ?? '')
  return {
    sections: parsed.sections ?? [],
    concepts: parsed.concepts ?? [],
    data_points: parsed.data_points ?? [],
    formulas: parsed.formulas ?? [],
    strategies: parsed.strategies ?? [],
    mentioned_resources: parsed.mentioned_resources ?? [],
    notable_quotes: parsed.notable_quotes ?? [],
  }
}

async function extractMapReduce(rawText: string, meta?: SourceMeta): Promise<ExtractedKnowledge> {
  const chunks = splitIntoChunks(rawText)

  // Map phase — all chunks in parallel; tolerate individual chunk failures
  const settled = await Promise.allSettled(
    chunks.map((c, i) => extractChunkNotes(c, i, chunks.length, meta))
  )
  const notes = settled
    .filter((s): s is PromiseFulfilledResult<ChunkNotes> => s.status === 'fulfilled')
    .map(s => s.value)
  if (notes.length === 0) throw new Error('Extraction failed on all content chunks. Please try again.')

  const digest = notes.map((n, i) => `=== PART ${i + 1} NOTES ===\n${JSON.stringify(n)}`).join('\n\n')
  const plan = planExtraction(rawText.length)

  const prompt = `You are merging detailed study notes (taken part-by-part over a long source, in order) into ONE final structured knowledge extraction. The notes below are your ONLY source — synthesize and deduplicate them, but do not invent anything not present in them.

${metaHeader(meta)}Return ONLY a valid JSON object with exactly this structure:

${FINAL_SCHEMA}

Merge rules:
- chapters: turn the parts' "sections" into ${plan.chapters} chapters covering the WHOLE source in order. Merge adjacent near-duplicate sections. Convert each chapter's start_marker ([MM:SS] or [H:MM:SS]) to integer "start_seconds"; use null if markers are absent. Keep key_points concrete — carry the numbers, names, and examples through from the notes.
- key_concepts: deduplicate across parts; keep the clearest definition of each; target ${plan.concepts}.
- key_data_points: carry through EVERY distinct data point from the notes.
- formulas / strategies / mentioned_resources: union across all parts, deduplicated. Do not drop any.
- key_takeaways: ${plan.takeaways}, drawn from across the entire source (not just one part).
- flashcards: ${plan.flashcards} — spread across the whole source; mix definitions, applications, and number/fact recall.
- go_deeper: 4-6 related next topics, ordered from most natural next step to most advanced.
- quiz_questions: ${plan.quiz} — spread across the whole source; mix recall, application, and scenario; vary the correct option index.
- summary_long: ${plan.summaryGuidance}
- Weave 1-2 of the most striking notable_quotes into chapter summaries where they fit.

Notes to merge:
---
${digest.slice(0, 250_000)}
---`

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: plan.maxTokens,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  return normalizeExtracted(safeParseJSON<Partial<ExtractedKnowledge>>(response.choices[0]?.message?.content ?? ''))
}

export async function extractKnowledge(rawText: string, meta?: SourceMeta): Promise<ExtractedKnowledge> {
  const text = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Content truncated for processing]'
    : rawText

  return text.length > SINGLE_PASS_LIMIT
    ? extractMapReduce(text, meta)
    : extractSinglePass(text, meta)
}

// ─────────────────────────────────────────────────────────────
// Per-resource Q&A
// ─────────────────────────────────────────────────────────────
export async function answerQuestion(
  question: string,
  context: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const systemPrompt = `You are a knowledgeable study assistant. Answer questions based on the provided resource content.

Always:
- Be clear and educational
- Reference specific parts of the content when relevant — if the content has [MM:SS] timestamps, cite them so the user can jump to that moment
- Give examples when helpful
- If the question is outside the provided content, say so and answer from general knowledge while noting this

Resource content:
---
${context.slice(0, 40000)}
---`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ]

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages,
  })

  return response.choices[0]?.message?.content ?? 'No response generated.'
}

// ─────────────────────────────────────────────────────────────
// Library-wide AI Assistant (sidebar)
// ─────────────────────────────────────────────────────────────
export async function answerLibraryQuestion(
  question: string,
  libraryContext: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const systemPrompt = `You are KnowBase's AI study assistant for a personal finance & trading learning platform. You help the user understand finance, investing, trading, and economics — both from their personal library of saved resources AND from your own general knowledge.

Always:
- Be clear, friendly, and educational, like a great tutor
- Use concrete numeric examples wherever they help (e.g. "if you invest $1,000 at 7% annually compounded yearly, after 10 years you'd have about $1,967")
- When the topic appears in the user's library (snapshot below), reference the relevant resource by title and build on it
- When it's a general question not covered in their library, answer from your own finance/trading knowledge and say so briefly
- Keep answers focused — a few well-organized paragraphs, not an essay, unless asked for more depth
- Never give personalized investment advice ("you should buy X" / "sell now") — explain concepts, mechanics, and trade-offs instead, and note that real decisions should involve a licensed financial advisor

Snapshot of the user's saved library (titles, levels, tags, key concepts) — use it to personalize answers when relevant:
---
${libraryContext.slice(0, 30000) || '(The user has not saved any resources yet — answer from general finance/trading knowledge and gently suggest they add a resource to personalize future answers.)'}
---`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ]

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1400,
    temperature: 0.4,
    messages,
  })

  return response.choices[0]?.message?.content ?? 'No response generated.'
}

// ─────────────────────────────────────────────────────────────
// Cross-resource Test generation
// ─────────────────────────────────────────────────────────────
export async function generateCrossResourceQuiz(
  resourceSummaries: Array<{ title: string; difficulty: string; tags: string[]; concepts: string[]; takeaways: string[] }>,
  count: number
): Promise<QuizQuestion[]> {
  const digest = resourceSummaries.map((r, i) =>
    `[Resource ${i + 1}: "${r.title}"] (${r.difficulty})\nTags: ${r.tags.join(', ') || 'none'}\nKey concepts: ${r.concepts.join(' | ') || 'none'}\nTakeaways: ${r.takeaways.join(' | ') || 'none'}`
  ).join('\n\n')

  const prompt = `You are building a mixed test that draws on MULTIPLE learning resources at once, to help a finance/trading student check how well they connect ideas across everything they've studied.

Below is a digest of ${resourceSummaries.length} resources the student has saved:
---
${digest.slice(0, 60000)}
---

Generate exactly ${count} multiple-choice quiz questions. Return ONLY valid JSON in this shape:

{ "questions": [ { "question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..." } ] }

Rules:
- Draw questions from across DIFFERENT resources — don't cluster them all on one topic
- Where it makes sense, write questions that connect or compare ideas from two different resources
- Mix difficulty: include some recall, some application/scenario questions, and at least a few that require synthesizing across resources
- Vary which option index (0-3) is correct across the set
- Keep each question self-contained — the student will see only the question and options, not the digest
- Base every question on material actually summarized above — never invent facts`

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  try {
    const parsed = safeParseJSON<{ questions?: QuizQuestion[] } | QuizQuestion[]>(text)
    if (Array.isArray(parsed)) return parsed
    return parsed.questions ?? []
  } catch {
    throw new Error('AI returned invalid JSON while generating the test. Please try again.')
  }
}
