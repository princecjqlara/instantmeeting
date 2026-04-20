export const INSTANTMEETING_PAYMENT_PIPELINE_STAGES = ['unqualified', 'sold']
export const INSTANTMEETING_SOLD_VALUE_PHP = 699

export function resolveInstantMeetingPaymentTrigger(trigger) {
    switch (trigger) {
        case 'website_visit':
            return {
                trigger,
                pipelineStage: 'unqualified',
                eventName: 'PageView',
                value: null,
            }
        case 'admin_reject':
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
        default:
            throw new Error(`Unknown InstantMeeting payment trigger: ${trigger}`)
    }
}
