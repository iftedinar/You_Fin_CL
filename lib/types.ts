export type SourceType = 'youtube' | 'article' | 'pdf' | 'note'

export type ResourceStatus = 'processing' | 'ready' | 'error'

export type StudyStatus = 'not_started' | 'in_progress' | 'completed' | 'saved_for_later'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

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

export interface ExtractedKnowledge {
  title: string
  summary_short: string
  summary_long: string
  key_concepts: KeyConcept[]
  key_takeaways: string[]
  formulas: Formula[]
  strategies: Strategy[]
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
