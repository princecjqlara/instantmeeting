import { createHash, randomUUID } from 'node:crypto'

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

export type LeadFormFunnelMetaEventName = 'PageView' | 'InstantMeetingLeadFormStart' | 'Schedule'

interface LeadFormQualifiedLeadRecord {
    id: string
    guest_name?: string | null
    guest_email?: string | null
    guest_phone?: string | null
    qualification_score?: number | null
    qualification_verdict?: string | null
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

interface LeadFormFunnelMetaInput extends Omit<LeadFormQualifiedMetaInput, 'lead'> {
    eventName: LeadFormFunnelMetaEventName
    lead?: LeadFormQualifiedLeadRecord | null
    eventId?: string | null
}

interface WaitingGuestsErrorLike {
    message?: string | null
}

const REQUIRED_WAITING_GUEST_COLUMNS = new Set(['meeting_id', 'guest_name', 'status'])
const LEAD_FORM_DEFAULT_PURCHASE_VALUE_PHP = 699

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

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLowerCase()
    return normalized || null
}

function normalizePhone(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const digits = value.replace(/\D+/g, '')
    return digits || null
}

function normalizeNamePart(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLowerCase().replace(/[^a-z\s'-]+/g, '')
    return normalized || null
}

function hashValue(value: string | null): string | null {
    if (!value) return null
    return createHash('sha256').update(value).digest('hex')
}

function splitName(value: unknown) {
    const normalized = normalizeNamePart(value)
    if (!normalized) {
        return { firstName: null, lastName: null }
    }

    const parts = normalized.split(/\s+/).filter(Boolean)
    return {
        firstName: parts[0] || null,
        lastName: parts.length > 1 ? parts[parts.length - 1] : null,
    }
}

function normalizeCookieValue(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized || null
}

function buildFbc(fbc: unknown, fbclid: unknown): string | null {
    const normalizedFbc = normalizeCookieValue(fbc)
    if (normalizedFbc) return normalizedFbc

    const clickId = normalizeCookieValue(fbclid)
    if (!clickId) return null

    return `fb.1.${Date.now()}.${clickId}`
}

function resolveLeadFormBaseEvent(input: Record<string, unknown>) {
    if (input.trigger === 'admin_verify') {
        return {
            eventName: 'Purchase',
            pipelineStage: 'sold',
            pipelineTrigger: 'admin_verify',
            value: LEAD_FORM_DEFAULT_PURCHASE_VALUE_PHP,
        }
    }

    if (input.trigger === 'website_visit') {
        return {
            eventName: 'PageView',
            pipelineStage: 'view',
            pipelineTrigger: 'lead_form_view',
            value: null,
        }
    }

    return {
        eventName: 'Lead',
        pipelineStage: 'lead',
        pipelineTrigger: 'payment_review_submit',
        value: null,
    }
}

function buildInstantMeetingMetaEvent(input: Record<string, unknown>) {
    const resolved = resolveLeadFormBaseEvent(input)
    const { firstName, lastName } = splitName(input.name)
    const eventSourceUrl = typeof input.eventSourceUrl === 'string' && input.eventSourceUrl.trim()
        ? input.eventSourceUrl.trim()
        : 'https://instantmeeting.ai/'
    const userData: Record<string, unknown> = {}

    const hashedEmail = hashValue(normalizeEmail(input.email))
    const hashedPhone = hashValue(normalizePhone(input.phone))
    const hashedFirstName = hashValue(firstName)
    const hashedLastName = hashValue(lastName)
    const normalizedFbp = normalizeCookieValue(input.fbp)
    const normalizedFbc = buildFbc(input.fbc, input.fbclid)

    if (hashedEmail) userData.em = [hashedEmail]
    if (hashedPhone) userData.ph = [hashedPhone]
    if (hashedFirstName) userData.fn = [hashedFirstName]
    if (hashedLastName) userData.ln = [hashedLastName]
    if (typeof input.clientIpAddress === 'string' && input.clientIpAddress.trim()) {
        userData.client_ip_address = input.clientIpAddress.trim()
    }
    if (typeof input.clientUserAgent === 'string' && input.clientUserAgent.trim()) {
        userData.client_user_agent = input.clientUserAgent.trim()
    }
    if (normalizedFbp) userData.fbp = normalizedFbp
    if (normalizedFbc) userData.fbc = normalizedFbc

    const customData: Record<string, unknown> = {
        pipeline_stage: resolved.pipelineStage,
        pipeline_trigger: resolved.pipelineTrigger,
    }
    const valueOverride = typeof input.valueOverride === 'number' &&
        Number.isFinite(input.valueOverride) &&
        input.valueOverride > 0
        ? input.valueOverride
        : null
    const resolvedValue = valueOverride ?? resolved.value

    if (resolvedValue !== null) {
        customData.currency = 'PHP'
        customData.value = resolvedValue
    }

    return {
        event_name: resolved.eventName,
        event_time: typeof input.eventTime === 'number'
            ? input.eventTime
            : Math.floor(Date.now() / 1000),
        event_id: typeof input.eventId === 'string' && input.eventId.trim()
            ? input.eventId.trim()
            : randomUUID(),
        action_source: 'website' as const,
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: customData,
    }
}

function buildMetaCapiRequestBody(event: Record<string, unknown>, config: MetaCapiConfig) {
    const payload: {
        data: Record<string, unknown>[]
        test_event_code?: string
    } = {
        data: [event],
    }

    const testEventCode = config.testEventCode?.trim()
    if (testEventCode) {
        payload.test_event_code = testEventCode
    }

    return payload
}

async function sendInstantMeetingMetaCapiEventWithConfig(
    config: MetaCapiConfig,
    event: Record<string, unknown>
): Promise<MetaCapiSendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v20.0/${config.datasetId}/events?access_token=${encodeURIComponent(config.accessToken)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildMetaCapiRequestBody(event, config)),
                cache: 'no-store',
            }
        )

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            console.error('Meta CAPI request failed:', response.status, body)
            return { sent: false, reason: 'request_failed', status: response.status }
        }

        return { sent: true }
    } catch (error) {
        console.error('Meta CAPI request errored:', error)
        return { sent: false, reason: 'request_error' }
    }
}

async function buildLeadFormMetaEvent(input: {
    eventName: string
    eventSourceUrl: string
    eventId?: string | null
    lead?: LeadFormQualifiedLeadRecord | null
    clientIpAddress?: string | null
    clientUserAgent?: string | null
    fbp?: string | null
    fbc?: string | null
    fbclid?: string | null
    customData: Record<string, unknown>
}) {
    const base = buildInstantMeetingMetaEvent({
        trigger: input.eventName === 'PageView' ? 'website_visit' : 'payment_review_submit',
        eventSourceUrl: input.eventSourceUrl,
        email: input.lead?.guest_email,
        phone: input.lead?.guest_phone,
        name: input.lead?.guest_name,
        clientIpAddress: input.clientIpAddress,
        clientUserAgent: input.clientUserAgent,
        fbp: input.fbp,
        fbc: input.fbc,
        fbclid: input.fbclid,
        eventId: input.eventId,
    } as any)

    return {
        ...base,
        event_name: input.eventName,
        custom_data: input.customData,
    }
}

function buildLeadFormQualityCustomData(input: {
    leadForm: LeadFormQualifiedMetaInput['leadForm']
    lead?: LeadFormQualifiedLeadRecord | null
    pipelineStage: string
    pipelineTrigger: string
    extra?: Record<string, unknown>
}) {
    const customData: Record<string, unknown> = {
        pipeline_stage: input.pipelineStage,
        pipeline_trigger: input.pipelineTrigger,
    }

    if (input.leadForm.slug) customData.lead_form_slug = input.leadForm.slug
    if (input.leadForm.id) customData.lead_form_id = input.leadForm.id
    if (typeof input.lead?.qualification_score === 'number') {
        customData.lead_score = input.lead.qualification_score
    }
    if (input.lead?.qualification_verdict) {
        customData.lead_verdict = input.lead.qualification_verdict
    }

    return {
        ...customData,
        ...(input.extra || {}),
    }
}

function resolveLeadFormFunnelPipeline(eventName: LeadFormFunnelMetaEventName) {
    if (eventName === 'PageView') {
        return { pipelineStage: 'view', pipelineTrigger: 'lead_form_view' }
    }

    if (eventName === 'InstantMeetingLeadFormStart') {
        return { pipelineStage: 'started', pipelineTrigger: 'lead_form_start' }
    }

    return { pipelineStage: 'booked', pipelineTrigger: 'booking_created' }
}

function omitColumn<T extends Record<string, unknown>>(record: T, column: keyof T) {
    const next = { ...record }
    delete next[column]
    return next
}

function isMissingWaitingGuestsColumnError(
    error: WaitingGuestsErrorLike | null | undefined,
    column: string
): boolean {
    if (!error?.message) return false

    const message = error.message.toLowerCase()
    const normalizedColumn = column.toLowerCase()

    const postgresMissingColumn =
        message.includes('does not exist') &&
        (
            message.includes(`waiting_guests.${normalizedColumn}`) ||
            message.includes(`waiting_guests."${normalizedColumn}"`)
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes(`'${normalizedColumn}'`) &&
        message.includes("column of 'waiting_guests'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}

function getMissingWaitingGuestsColumn(error: WaitingGuestsErrorLike | null | undefined): string | null {
    const message = error?.message || ''
    const schemaCacheMatch = message.match(/'([^']+)' column of 'waiting_guests'/i)
    if (schemaCacheMatch?.[1]) return schemaCacheMatch[1]

    const postgresMatch = message.match(/waiting_guests\.(?:"([^"]+)"|([a-z0-9_]+))/i)
    if (postgresMatch?.[1]) return postgresMatch[1]
    if (postgresMatch?.[2]) return postgresMatch[2]

    return null
}

function getMissingOptionalWaitingGuestsColumn(
    error: WaitingGuestsErrorLike | null | undefined,
    payload: Record<string, unknown>
): string | null {
    const column = getMissingWaitingGuestsColumn(error)
    if (!column) return null
    if (!(column in payload)) return null
    if (REQUIRED_WAITING_GUEST_COLUMNS.has(column)) return null

    return isMissingWaitingGuestsColumnError(error, column) ? column : null
}

async function updateWaitingGuestWithCompat(
    supabase: any,
    guestId: string,
    payload: Record<string, unknown>
) {
    let nextPayload = { ...payload }

    while (true) {
        const result = await supabase
            .from('waiting_guests')
            .update(nextPayload)
            .eq('id', guestId)
            .select('id, status, join_token')
            .single()

        if (!result.error) {
            return result
        }

        const missingColumn = getMissingOptionalWaitingGuestsColumn(result.error, nextPayload)
        if (!missingColumn) {
            return result
        }

        nextPayload = omitColumn(nextPayload, missingColumn)
    }
}

async function updateWaitingGuestMetaFlags(
    supabase: any,
    leadId: string,
    payload: Record<string, unknown>
) {
    return updateWaitingGuestWithCompat(supabase, leadId, payload)
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
        custom_data: buildLeadFormQualityCustomData({
            leadForm: input.leadForm,
            lead: input.lead,
            pipelineStage: 'qualified',
            pipelineTrigger: 'qualified',
        }),
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

export async function maybeSendLeadFormFunnelMetaEvent(
    input: LeadFormFunnelMetaInput,
    deps: {
        resolveConfig?: (supabase: any, leadForm: LeadFormQualifiedMetaInput['leadForm']) => Promise<MetaCapiConfig | null>
        sendWithConfig?: typeof sendInstantMeetingMetaCapiEventWithConfig
    } = {}
): Promise<MetaCapiSendResult | { sent: false; reason: 'missing_config' }> {
    const config = await resolveLeadFormMetaCapiConfig(
        input.supabase,
        input.leadForm,
        deps.resolveConfig
    )
    if (!config) {
        return { sent: false, reason: 'missing_config' }
    }

    const { pipelineStage, pipelineTrigger } = resolveLeadFormFunnelPipeline(input.eventName)
    const event = await buildLeadFormMetaEvent({
        eventName: input.eventName,
        eventSourceUrl: input.eventSourceUrl,
        eventId: input.eventId,
        lead: input.lead,
        clientIpAddress: input.clientIpAddress,
        clientUserAgent: input.clientUserAgent,
        fbp: input.fbp,
        fbc: input.fbc,
        fbclid: input.fbclid,
        customData: buildLeadFormQualityCustomData({
            leadForm: input.leadForm,
            lead: input.lead,
            pipelineStage,
            pipelineTrigger,
        }),
    })

    const sendWithConfig = deps.sendWithConfig ?? sendInstantMeetingMetaCapiEventWithConfig
    return sendWithConfig(config, event)
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
        custom_data: buildLeadFormQualityCustomData({
            leadForm: input.leadForm,
            lead: input.lead,
            pipelineStage: 'sold',
            pipelineTrigger: 'sold',
            extra: {
                ...('currency' in event.custom_data ? { currency: event.custom_data.currency } : {}),
                ...('value' in event.custom_data ? { value: event.custom_data.value } : {}),
            },
        }),
    })

    if (!result.sent) {
        const releaseResult = await releaseClaim(input.supabase, input.lead.id, claimTimestamp)
        if (releaseResult?.error) {
            console.error('Failed to release lead-form purchase Meta event claim:', releaseResult.error)
        }
    }

    return result
}
