export const INSTANTMEETING_PAYMENT_PIPELINE_STAGES = ['unqualified', 'sold'] as const
export const INSTANTMEETING_SOLD_VALUE_PHP = 699

export type InstantMeetingPaymentStage = (typeof INSTANTMEETING_PAYMENT_PIPELINE_STAGES)[number]
export type InstantMeetingPaymentTrigger = 'website_visit' | 'payment_review_submit' | 'admin_verify'

interface TriggerResolution {
    trigger: InstantMeetingPaymentTrigger
    pipelineStage: InstantMeetingPaymentStage
    eventName: 'PageView' | 'Lead' | 'Purchase'
    value: number | null
}

export function resolveInstantMeetingPaymentTrigger(
    trigger: InstantMeetingPaymentTrigger
): TriggerResolution {
    switch (trigger) {
        case 'website_visit':
            return {
                trigger,
                pipelineStage: 'unqualified',
                eventName: 'PageView',
                value: null,
            }
        case 'payment_review_submit':
            return {
                trigger,
                pipelineStage: 'unqualified',
                eventName: 'Lead',
                value: null,
            }
        case 'admin_verify':
            return {
                trigger,
                pipelineStage: 'sold',
                eventName: 'Purchase',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
    }

    throw new Error(`Unknown InstantMeeting payment trigger: ${String(trigger)}`)
}
