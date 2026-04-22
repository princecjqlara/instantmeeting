export interface OnboardingLeadFormQuestion {
    [key: string]: unknown
}

export interface OnboardingLeadFormDraft {
    title: string
    description: string
    ai_criteria: string
    auto_admit_threshold: number
    unqualified_message: string
    questions: OnboardingLeadFormQuestion[]
}

export function buildOnboardingLeadFormPayload(draft: OnboardingLeadFormDraft) {
    return {
        title: draft.title,
        description: draft.description,
        ai_criteria: draft.ai_criteria,
        auto_admit_threshold: draft.auto_admit_threshold,
        unqualified_message: draft.unqualified_message,
        fallback_to_waiting: true,
        questions: draft.questions,
    }
}
