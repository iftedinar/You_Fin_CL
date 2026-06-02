import OpenAI from 'openai'
import type { ExtractedKnowledge } from '@/lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const MAX_CHARS = 80000

export async function extractKnowledge(rawText: string): Promise<ExtractedKnowledge> {
  const truncated = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Content truncated for processing]'
    : rawText

  const prompt = `You are an expert knowledge extraction assistant. Extract structured educational content from the text below.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation — with exactly this structure:

{
  "title": "Clear descriptive title of this content",
  "summary_short": "2-3 sentence overview of what this covers",
  "summary_long": "4-6 paragraph detailed summary covering all main ideas",
  "key_concepts": [
    { "term": "concept name", "definition": "clear definition in 1-2 sentences" }
  ],
  "key_takeaways": [
    "Actionable or important lesson as a full sentence"
  ],
  "formulas": [
    { "name": "formula name", "formula": "the formula itself", "explanation": "what it means and when to use it" }
  ],
  "strategies": [
    { "name": "strategy name", "description": "what it is", "conditions": "when to use it", "risks": "what can go wrong" }
  ],
  "difficulty": "beginner" or "intermediate" or "advanced",
  "topic_tags": ["tag1", "tag2", "tag3"],
  "quiz_questions": [
    {
      "question": "A clear question about the content",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

Rules:
- key_concepts: extract 5-15 important terms/concepts
- key_takeaways: extract 5-10 important lessons
- formulas: only include if actual formulas/equations exist (can be empty array)
- strategies: extract any methods, frameworks, or strategies discussed (can be empty array)
- quiz_questions: generate 5-10 good questions that test understanding
- topic_tags: 3-8 relevant topic tags
- difficulty: assess based on complexity of content
- All fields are required, arrays can be empty if not applicable

Content to extract from:
---
${truncated}
---`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
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
