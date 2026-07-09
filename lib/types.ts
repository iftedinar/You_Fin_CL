export type SourceType = 'youtube' | 'article' | 'pdf' | 'docx' | 'txt' | 'note'

export type ResourceStatus = 'processing' | 'ready' | 'error'

export type StudyStatus = 'not_started' | 'in_progress' | 'completed' | 'saved_for_later'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface TranscriptSegment {
  start: number // seconds
  text: string
}

export interface KeyConcept {
  term: string
  definition: string
}

export interface Formula {
  name: string
  formula: string
  explanation: string
}

export interface Strategy {
  name: string
  description: string
  conditions?: string
  risks?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

// Section-by-section breakdown. start_seconds is set for YouTube sources
// (clickable timestamps); null for articles/PDFs (ordered sections instead).
export interface Chapter {
  title: string
  start_seconds: number | null
  summary: string
  key_points: string[]
}

export interface DataPoint {
  value: string
  context: string
}

export interface MentionedResource {
  name: string
  type: 'book' | 'tool' | 'website' | 'ticker' | 'person' | 'course' | 'other'
  context: string
}

export interface Flashcard {
  front: string
  back: string
}

export interface GoDeeperItem {
  topic: string
  why: string
  suggested_search: string
}

export interface ExtractedKnowledge {
  title: string
  summary_short: string
  summary_long: string
  chapters: Chapter[]
  key_concepts: KeyConcept[]
  key_takeaways: string[]
  key_data_points: DataPoint[]
  formulas: Formula[]
  strategies: Strategy[]
  mentioned_resources: MentionedResource[]
  flashcards: Flashcard[]
  go_deeper: GoDeeperItem[]
  difficulty: Difficulty
  topic_tags: string[]
  quiz_questions: QuizQuestion[]
}

export interface Resource {
  id: string
  user_id: string
  title: string
  source_type: SourceType
  source_url: string | null
  raw_text: string | null
  extracted: ExtractedKnowledge | null
  status: ResourceStatus
  study_status: StudyStatus
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  resource_id: string
  user_id: string
  content: string
  created_at: string
}

export interface QuizAttempt {
  id: string
  resource_id: string
  user_id: string
  score: number
  total: number
  answers: number[]
  created_at: string
}

export interface TestAttempt {
  id: string
  user_id: string
  resource_ids: string[]
  score: number
  total: number
  answers: (number | null)[]
  questions: QuizQuestion[]
  created_at: string
}

// Spaced-repetition flashcard row (flashcards table)
export interface FlashcardRow {
  id: string
  user_id: string
  resource_id: string
  front: string
  back: string
  ease: number
  interval_days: number
  reps: number
  due_at: string
  created_at: string
}
