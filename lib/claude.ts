import OpenAI from 'openai'
import type { ExtractedKnowledge, QuizQuestion } from '@/lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const MAX_CHARS = 140000

interface ExtractionPlan {
  label: string
  concepts: string
  takeaways: string
  formulasGuidance: string
  strategiesGuidance: string
  quiz: string
  summaryGuidance: string
  maxTokens: number
}

// Scale how much we ask the model to extract based on how much source material there is.
// A 5-minute clip and a 2-hour lecture / research paper should NOT come out looking the same.
function planExtraction(length: number): ExtractionPlan {
  if (length < 3000) {
    return {
      label: 'short-form',
      concepts: '4-6',
      takeaways: '4-6',
      formulasGuidance: 'Include any formulas that actually appear — do not invent them (empty array if none).',
      strategiesGuidance: 'Include any strategies or frameworks that actually appear (empty array if none).',
      quiz: '5-6',
      summaryGuidance: 'summary_long should be 2-3 focused paragraphs — this is short content, so do not pad it with filler.',
      maxTokens: 4096,
    }
  }
  if (length < 15000) {
    return {
      label: 'medium-length',
      concepts: '7-10',
      takeaways: '6-9',
      formulasGuidance: 'Include every formula or equation that appears, each with a brief worked example where possible.',
      strategiesGuidance: 'Include every strategy or framework discussed, each with when to use it and its main risk.',
      quiz: '7-9',
      summaryGuidance: 'summary_long should be 4-6 paragraphs that move through the content in roughly the order it was presented.',
      maxTokens: 6500,
    }
  }
  if (length < 50000) {
    return {
      label: 'long-form',
      concepts: '11-16',
      takeaways: '9-12',
      formulasGuidance: 'Extract EVERY formula or equation mentioned — for each one, give a short worked numeric example showing how to use it.',
      strategiesGuidance: 'Extract EVERY strategy, framework, or method discussed. For each, explain what it is, the conditions where it works, its risks/failure modes, and a short example scenario.',
      quiz: '10-14',
      summaryGuidance: 'summary_long should be 6-9 paragraphs that walk through the material section by section, in the order presented, so a reader who never saw the source could follow the full arc of it.',
      maxTokens: 9000,
    }
  }
  return {
    label: 'very long / research-paper-length',
    concepts: '15-22',
    takeaways: '11-16',
    formulasGuidance: 'Extract EVERY formula, equation, ratio, or quantitative model mentioned — do not skip minor ones. Give each a short worked numeric example.',
    strategiesGuidance: 'Extract EVERY strategy, framework, methodology, or approach discussed however briefly. For each, give what it is, the conditions where it applies, its risks/limitations, and a concrete example scenario.',
    quiz: '14-20',
    summaryGuidance: 'summary_long should be 9-14 paragraphs that comprehensively walk through every major section of the source in order — including transitions between topics, supporting evidence/data mentioned, and any caveats or counterarguments raised — so a reader who never saw the source comes away with a near-complete understanding.',
    maxTokens: 14000,
  }
}

export async function extractKnowledge(rawText: string): Promise<ExtractedKnowledge> {
  const truncated = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Content truncated for processing]'
    : rawText

  const plan = planExtraction(rawText.length)

  const prompt = `You are an expert knowledge extraction assistant. Extract structured educational content from the text below.

This is ${plan.label} content (~${rawText.length.toLocaleString()} characters). Scale the DEPTH and AMOUNT of what you extract to match: longer, denser material has more to teach, so pull proportionally more out of it. Do not compress a long lecture, article, or paper down to the same level of detail you'd give a short clip — extract more concepts, takeaways, formulas, strategies, and quiz questions, and write a fuller summary, in direct proportion to how much teachable material the source actually contains. Conversely, do not pad short content with filler or invented detail.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation — with exactly this structure:

{
  "title": "Clear descriptive title of this content",
  "summary_short": "2-3 sentence overview of what this covers",
  "summary_long": "Detailed summary — see length guidance below",
  "key_concepts": [
    { "term": "concept name", "definition": "clear, complete definition (1-3 sentences), with a concrete example where it helps understanding" }
  ],
  "key_takeaways": [
    "Actionable or important lesson as a full sentence, specific to this content (not generic advice)"
  ],
  "formulas": [
    { "name": "formula name", "formula": "the formula itself", "explanation": "what it means, when to use it, and a short worked numeric example if the source supports one" }
  ],
  "strategies": [
    { "name": "strategy name", "description": "what it is and how it works", "conditions": "when/where to use it", "risks": "what can go wrong or its limitations" }
  ],
  "difficulty": "beginner" or "intermediate" or "advanced",
  "topic_tags": ["tag1", "tag2", "tag3"],
  "quiz_questions": [
    {
      "question": "A clear question that tests real understanding, not just recall of a definition",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this answer is correct, and briefly why the others are not"
    }
  ]
}

Extraction targets for THIS content (these scale with content length — follow them):
- key_concepts: ${plan.concepts} entries
- key_takeaways: ${plan.takeaways} entries
- formulas: ${plan.formulasGuidance}
- strategies: ${plan.strategiesGuidance}
- quiz_questions: ${plan.quiz} questions — mix recall, application, and "what would happen if…" scenario questions; vary which option index is correct
- topic_tags: 3-8 relevant tags
- summary_long: ${plan.summaryGuidance}
- difficulty: assess based on the complexity of the content, not its length

Quality bar: every field should reflect what is actually IN the source — never invent formulas, strategies, or facts that aren't there. But also do not under-extract: if the source is long and rich, your output should be noticeably more thorough than it would be for a short source, in direct proportion to how much teachable material it contains.

Content to extract from:
---
${truncated}
---`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: plan.maxTokens,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as ExtractedKnowledge
    return parsed
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.')
  }
}

export async function answerQuestion(
  question: string,
  context: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const systemPrompt = `You are a knowledgeable study assistant. Answer questions based on the provided resource content.

Always:
- Be clear and educational
- Reference specific parts of the content when relevant
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
    model: 'gpt-4o',
    max_tokens: 1024,
    messages,
  })

  return response.choices[0]?.message?.content ?? 'No response generated.'
}

// ── Library-wide AI Assistant (sidebar) ─────────────────────
// Unlike answerQuestion (scoped to one resource), this assistant can draw on
// the user's whole library AND general finance/trading knowledge.
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
    model: 'gpt-4o',
    max_tokens: 1400,
    temperature: 0.4,
    messages,
  })

  return response.choices[0]?.message?.content ?? 'No response generated.'
}

// ── Cross-resource Test generation ──────────────────────────
// Builds a fresh quiz that draws on (and connects) multiple saved resources at once.
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

Generate exactly ${count} multiple-choice quiz questions as a JSON array — return ONLY the array, no markdown, no commentary — using this exact shape:

[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "explanation": "..."
  }
]

Rules:
- Draw questions from across DIFFERENT resources — don't cluster them all on one topic
- Where it makes sense, write questions that connect or compare ideas from two different resources (e.g. "Both Resource A and Resource B discuss X — which statement correctly contrasts how each treats it?")
- Mix difficulty: include some recall, some application/scenario questions, and at least a few that require synthesizing across resources
- Vary which option index (0-3) is correct across the set
- Keep each question self-contained — the student will see only the question and options, not the digest
- Base every question on material actually summarized above — never invent facts`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as QuizQuestion[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    throw new Error('AI returned invalid JSON while generating the test. Please try again.')
  }
}
