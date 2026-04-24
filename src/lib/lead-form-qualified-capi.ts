export interface MetaCapiConfigRow {
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
    meta_capi_test_event_code?: string | null
}

interface MetaCapiConfig {
    accessToken: string
    datasetId: string
    testEventCode?: string
}

export type MetaCapiSendResult =
    | { sent: true }
    | { sent: false; reason: 'request_failed'; status: number }
    | { sent: false; reason: 'request_error' }

interface LeadFormQualifiedLeadRecord {
    id: string
    guest_name?: string | null
    guest_email?: string | null
    guest_phone?: string | null
    meta_qualified_sent_at?: string | null
    meta_purchase_sent_at?: string | null
}

interface LeadFormQualifiedMetaInput {
    supabase: any
    leadForm: MetaCapiConfigRow & {
        id?: string | null
        slug?: string | null
        user_id?: string | null
        facebook_purchase_value?: number | null
        send_qualified_to_facebook?: boolean | null
        send_purchase_to_facebook?: boolean | null
    }
    lead: LeadFormQualifiedLeadRecord
    eventSourceUrl: string
    clientIpAddress?: string | null
    clientUserAgent?: string | null
    fbp?: string | null
    fbc?: string | null
    fbclid?: string | null
}

export function buildLeadFormQualifiedEventId(leadId: string) {
    return `lead-form-qualified:${leadId}`
}

export function shouldSendLeadFormQualifiedMetaEvent(metaQualifiedSentAt: string | null | undefined) {
    return !(typeof metaQualifiedSentAt === 'string' && metaQualifiedSentAt.trim())
}

export function shouldSendLeadFormPurchaseMetaEvent(metaPurchaseSentAt: string | null | undefined) {
    return !(typeof metaPurchaseSentAt === 'string' && metaPurchaseSentAt.trim())
}

async function fetchLeadFormOwnerMetaCapiConfig(
    supabase: any,
    userId: string | null | undefined
): Promise<MetaCapiConfig | null> {
    if (!userId) {
        return null
    }

    const { data, error } = await supabase
        .from('users')
        .select('meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error('Failed to load lead-form owner Meta CAPI config:', error)
        return null
    }

    return normalizeMetaCapiConfig(data)
}

function normalizeMetaCapiConfig(row: MetaCapiConfigRow | null | undefined): MetaCapiConfig | null {
    const accessToken = row?.meta_capi_access_token?.trim()
    const datasetId = row?.meta_capi_dataset_id?.trim()
    const testEventCode = row?.meta_capi_test_event_code?.trim()

    if (!accessToken || !datasetId) {
        return null
    }

    return {
        accessToken,
        datasetId,
        ...(testEventCode ? { testEventCode } : {}),
    }
}

async function resolveLeadFormMetaCapiConfig(
    supabase: any,
    leadForm: LeadFormQualifiedMetaInput['leadForm'],
    resolveConfig?: (supabase: any, leadForm: LeadFormQualifiedMetaInput['leadForm']) => Promise<MetaCapiConfig | null>
): Promise<MetaCapiConfig | null> {
    const formConfig = normalizeMetaCapiConfig(leadForm)
    if (formConfig) {
        return formConfig
    }

    if (resolveConfig) {
        return resolveConfig(supabase, leadForm)
    }

    return fetchLeadFormOwnerMetaCapiConfig(supabase, leadForm.user_id)
}

async function buildInstantMeetingMetaEvent(input: Record<string, unknown>) {
    const module = await import(new URL('./instantmeeting-payment-capi.ts', import.meta.url).href)
    return module.buildInstantMeetingMetaEvent(input as any)
}

async function sendInstantMeetingMetaCapiEventWithConfig(config: any, event: Record<string, unknown>) {
    const module = await import(new URL('./instantmeeting-payment-capi-server.ts', import.meta.url).href)
    return module.sendInstantMeetingMetaCapiEventWithConfig(config, event)
}

async function updateWaitingGuestMetaFlags(
    supabase: any,
    leadId: string,
    payload: Record<string, unknown>
) {
    const module = await import(new URL('./waiting-guests-column-compat.ts', import.meta.url).href)
    return module.updateWaitingGuestWithCompat(supabase, leadId, payload)
}

async function claimLeadFormPurchaseSend(supabase: any, leadId: string, claimTimestamp: string) {
    const result = await supabase
        .from('waiting_guests')
        .update({ meta_purchase_sent_at: claimTimestamp })
        .eq('id', leadId)
        .is('meta_purchase_sent_at', null)
        .select('id')
        .maybeSingle()

    if (result.error) {
        return { claimed: false, error: result.error }
    }

    return { claimed: Boolean(result.data?.id), error: null }
}

async function claimLeadFormQualifiedSend(supabase: any, leadId: string, claimTimestamp: string) {
    const result = await supabase
        .from('waiting_guests')
        .update({ meta_qualified_sent_at: claimTimestamp })
        .eq('id', leadId)
        .is('meta_qualified_sent_at', null)
        .select('id')
        .maybeSingle()

    if (result.error) {
        return { claimed: false, error: result.error }
    }

    return { claimed: Boolean(result.data?.id), error: null }
}

async function releaseLeadFormPurchaseClaim(supabase: any, leadId: string, claimTimestamp: string) {
    return supabase
        .from('waiting_guests')
        .update({ meta_purchase_sent_at: null })
        .eq('id', leadId)
        .eq('meta_purchase_sent_at', claimTimestamp)
}

async function releaseLeadFormQualifiedClaim(supabase: any, leadId: string, claimTimestamp: string) {
    return supabase
        .from('waiting_guests')
        .update({ meta_qualified_sent_at: null })
        .eq('id', leadId)
        .eq('meta_qualified_sent_at', claimTimestamp)
}

export async function maybeSendLeadFormQualifiedMetaEvent(
    input: LeadFormQualifiedMetaInput,
    deps: {
        resolveConfig?: (supabase: any, leadForm: LeadFormQualifiedMetaInput['leadForm']) => Promise<MetaCapiConfig | null>
        sendWithConfig?: typeof sendInstantMeetingMetaCapiEventWithConfig
        markLeadFlags?: typeof updateWaitingGuestMetaFlags
        claimSend?: typeof claimLeadFormQualifiedSend
        releaseClaim?: typeof releaseLeadFormQualifiedClaim
    } = {}
): Promise<MetaCapiSendResult | { sent: false; reason: 'missing_config' | 'already_sent' | 'disabled' }> {
    if (!shouldSendLeadFormQualifiedMetaEvent(input.lead.meta_qualified_sent_at)) {
        return { sent: false, reason: 'already_sent' }
    }

    if (!input.leadForm.send_qualified_to_facebook) {
        return { sent: false, reason: 'disabled' }
    }

    const config = await resolveLeadFormMetaCapiConfig(
        input.supabase,
        input.leadForm,
        deps.resolveConfig
    )
    if (!config) {
        return { sent: false, reason: 'missing_config' }
    }

    const claimTimestamp = new Date().toISOString()
    const claimSend = deps.claimSend ?? claimLeadFormQualifiedSend
    const releaseClaim = deps.releaseClaim ?? releaseLeadFormQualifiedClaim

    const claimResult = await claimSend(input.supabase, input.lead.id, claimTimestamp)
    if (claimResult.error) {
        console.error('Failed to claim lead-form qualified Meta event send:', claimResult.error)
        return { sent: false, reason: 'request_error' }
    }

    if (!claimResult.claimed) {
        return { sent: false, reason: 'already_sent' }
    }

    const baseEvent = await buildInstantMeetingMetaEvent({
        trigger: 'payment_review_submit',
        eventSourceUrl: input.eventSourceUrl,
        email: input.lead.guest_email,
        phone: input.lead.guest_phone,
        name: input.lead.guest_name,
        clientIpAddress: input.clientIpAddress,
        clientUserAgent: input.clientUserAgent,
        fbp: input.fbp,
        fbc: input.fbc,
        fbclid: input.fbclid,
        eventId: buildLeadFormQualifiedEventId(input.lead.id),
    })

    const event = {
        ...baseEvent,
        custom_data: {
            ...baseEvent.custom_data,
            pipeline_stage: 'qualified',
            pipeline_trigger: 'qualified',
        },
    }

    const sendWithConfig = deps.sendWithConfig ?? sendInstantMeetingMetaCapiEventWithConfig
    const markLeadFlags = deps.markLeadFlags ?? updateWaitingGuestMetaFlags

    const result = await sendWithConfig(config, event)

    if (result.sent) {
        const markResult = await markLeadFlags(input.supabase, input.lead.id, {
            meta_qualified_sent_at: new Date().toISOString(),
        })

        if (markResult.error) {
            console.error('Failed to mark lead-form qualified Meta event as sent:', markResult.error)
        }
    } else {
        const releaseResult = await releaseClaim(input.supabase, input.lead.id, claimTimestamp)
        if (releaseResult?.error) {
            console.error('Failed to release lead-form qualified Meta event claim:', releaseResult.error)
        }
    }

    return result
}

export async function maybeSendLeadFormPurchaseMetaEvent(
    input: LeadFormQualifiedMetaInput,
    deps: {
        resolveConfig?: (supabase: any, leadForm: LeadFormQualifiedMetaInput['leadForm']) => Promise<MetaCapiConfig | null>
        sendWithConfig?: typeof sendInstantMeetingMetaCapiEventWithConfig
        markLeadFlags?: typeof updateWaitingGuestMetaFlags
        claimSend?: typeof claimLeadFormPurchaseSend
        releaseClaim?: typeof releaseLeadFormPurchaseClaim
    } = {}
): Promise<MetaCapiSendResult | { sent: false; reason: 'missing_config' | 'disabled' | 'already_sent' }> {
    if (!input.leadForm.send_purchase_to_facebook) {
        return { sent: false, reason: 'disabled' }
    }

    if (!shouldSendLeadFormPurchaseMetaEvent(input.lead.meta_purchase_sent_at)) {
        return { sent: false, reason: 'already_sent' }
    }

    const config = await resolveLeadFormMetaCapiConfig(
        input.supabase,
        input.leadForm,
        deps.resolveConfig
    )
    if (!config) {
        return { sent: false, reason: 'missing_config' }
    }

    const claimTimestamp = new Date().toISOString()
    const claimSend = deps.claimSend ?? claimLeadFormPurchaseSend
    const releaseClaim = deps.releaseClaim ?? releaseLeadFormPurchaseClaim

    const claimResult = await claimSend(input.supabase, input.lead.id, claimTimestamp)
    if (claimResult.error) {
        console.error('Failed to claim lead-form purchase Meta event send:', claimResult.error)
        return { sent: false, reason: 'request_error' }
    }

    if (!claimResult.claimed) {
        return { sent: false, reason: 'already_sent' }
    }

    const event = await buildInstantMeetingMetaEvent({
        trigger: 'admin_verify',
        eventSourceUrl: input.eventSourceUrl,
        email: input.lead.guest_email,
        phone: input.lead.guest_phone,
        name: input.lead.guest_name,
        clientIpAddress: input.clientIpAddress,
        clientUserAgent: input.clientUserAgent,
        fbp: input.fbp,
        fbc: input.fbc,
        fbclid: input.fbclid,
        eventId: `lead-form-purchase:${input.lead.id}`,
        valueOverride:
            typeof input.leadForm.facebook_purchase_value === 'number'
                ? input.leadForm.facebook_purchase_value
                : 699,
    })

    const sendWithConfig = deps.sendWithConfig ?? sendInstantMeetingMetaCapiEventWithConfig
    const result = await sendWithConfig(config, {
        ...event,
        custom_data: {
            ...event.custom_data,
            pipeline_trigger: 'sold',
        },
    })

    if (!result.sent) {
        const releaseResult = await releaseClaim(input.supabase, input.lead.id, claimTimestamp)
        if (releaseResult?.error) {
            console.error('Failed to release lead-form purchase Meta event claim:', releaseResult.error)
        }
    }

    return result
}
