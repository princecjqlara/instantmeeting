export const DEFAULT_LEADS_PIPELINE_STAGES = [
    'prospect',
    'qualified',
    'unqualified',
    'sold',
] as const

export type LeadPipelineStage = (typeof DEFAULT_LEADS_PIPELINE_STAGES)[number] | string

interface DeriveLeadPipelineStageInput {
    submittedAt?: string | null
    qualificationVerdict?: 'qualified' | 'unqualified' | 'review' | null
    currentStage?: string | null
    isDraft?: boolean
}

interface ManualMoveInput {
    from?: string | null
    to?: string | null
}

function normalizeStageValue(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normalizeLeadsPipelineStages(value: unknown): string[] {
    const seen = new Set<string>()
    const normalized = Array.isArray(value)
        ? value
              .map((item) => normalizeStageValue(item))
              .filter(Boolean)
              .filter((item) => {
                  if (seen.has(item)) return false
                  seen.add(item)
                  return true
              })
        : []

    if (normalized.length === 0) {
        return [...DEFAULT_LEADS_PIPELINE_STAGES]
    }

    return normalized
}

export function deriveLeadPipelineStage(input: DeriveLeadPipelineStageInput): string {
    const currentStage = normalizeStageValue(input.currentStage)
    if (currentStage === 'sold') {
        return 'sold'
    }

    if (input.isDraft || !input.submittedAt) {
        return 'prospect'
    }

    switch (input.qualificationVerdict) {
        case 'qualified':
            return 'qualified'
        case 'unqualified':
            return 'unqualified'
        case 'review':
            return 'prospect'
        default:
            return ''
    }
}

export function canManuallyMoveLeadToStage(input: ManualMoveInput): boolean {
    const from = normalizeStageValue(input.from)
    const to = normalizeStageValue(input.to)

    if (!to || from === to) return true
    if (to !== 'sold') return true

    return from === 'qualified'
}
