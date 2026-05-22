export type LeadQuestionType =
    | 'short_answer'
    | 'long_answer'
    | 'email'
    | 'phone'
    | 'single_choice'
    | 'multi_choice'
    | 'date'

export interface LeadQuestionOption {
    id: string
    label: string
    value: string
    points?: number
}

export interface LeadScoringRule {
    id: string
    keywords: string
    points: number
}

export interface LeadFormQuestion {
    id: string
    form_id: string
    order_index: number
    question_text: string
    help_text?: string | null
    type: LeadQuestionType
    options: LeadQuestionOption[]
    required: boolean
    ai_weight: number
    disqualify_on?: string | null
    scoring_rules?: LeadScoringRule[]
    ideal_answer?: string | null
    max_points?: number
}

export interface LeadForm {
    id: string
    user_id: string
    slug: string
    title: string
    description?: string | null
    is_active: boolean
    auto_admit_threshold: number
    ai_criteria?: string | null
    unqualified_message?: string | null
    fallback_to_waiting: boolean
    qualified_media_mode?: QualifiedGuestMediaMode | null
    created_at: string
    updated_at: string
}

export interface LeadFormWithQuestions extends LeadForm {
    questions: LeadFormQuestion[]
}

export interface LeadAnswer {
    question_id: string
    question_text: string
    type: LeadQuestionType
    answer: string | string[]
}

export type LeadVerdict = 'qualified' | 'unqualified' | 'review'

export type QualifiedGuestMediaMode = 'audio_video' | 'audio_only' | 'video_only' | 'none'

export interface LeadQualificationResult {
    score: number
    verdict: LeadVerdict
    reasoning: string
    hard?: boolean
    per_question_notes?: Array<{ question_id: string; note: string }>
}
