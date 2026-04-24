export const INSTANTMEETING_PAYMENT_PIPELINE_STAGES = [
    'landing_visit',
    'diagnostic_started',
    'diagnostic_completed',
    'checkout_opened',
    'payment_info_added',
    'lead',
    'sold',
]
export const INSTANTMEETING_SOLD_VALUE_PHP = 699

export function resolveInstantMeetingPaymentTrigger(trigger) {
    switch (trigger) {
        case 'website_visit':
            return {
                trigger,
                pipelineStage: 'landing_visit',
                eventName: 'PageView',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'diagnostic_start':
            return {
                trigger,
                pipelineStage: 'diagnostic_started',
                eventName: 'InstantMeetingDiagnosticStart',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'diagnostic_complete':
            return {
                trigger,
                pipelineStage: 'diagnostic_completed',
                eventName: 'InstantMeetingDiagnosticComplete',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'checkout_opened':
            return {
                trigger,
                pipelineStage: 'checkout_opened',
                eventName: 'InitiateCheckout',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'payment_info_added':
            return {
                trigger,
                pipelineStage: 'payment_info_added',
                eventName: 'AddPaymentInfo',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'payment_review_submit':
            return {
                trigger,
                pipelineStage: 'lead',
                eventName: 'Lead',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
        case 'admin_verify':
            return {
                trigger,
                pipelineStage: 'sold',
                eventName: 'Purchase',
                value: INSTANTMEETING_SOLD_VALUE_PHP,
            }
    }

    throw new Error(`Unknown InstantMeeting payment trigger: ${trigger}`)
}
