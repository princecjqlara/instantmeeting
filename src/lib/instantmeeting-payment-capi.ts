import { createHash, randomUUID } from 'node:crypto'

export {
    INSTANTMEETING_PAYMENT_PIPELINE_STAGES,
    INSTANTMEETING_SOLD_VALUE_PHP,
    resolveInstantMeetingPaymentTrigger,
} from './instantmeeting-payment-pipeline.js'

import type { InstantMeetingPaymentTrigger } from './instantmeeting-payment-pipeline'

import {
    INSTANTMEETING_SOLD_VALUE_PHP,
    resolveInstantMeetingPaymentTrigger,
} from './instantmeeting-payment-pipeline.js'

export interface BuildInstantMeetingMetaEventInput {
    trigger: InstantMeetingPaymentTrigger
    eventSourceUrl?: string | null
    email?: string | null
    phone?: string | null
    name?: string | null
    clientIpAddress?: string | null
    clientUserAgent?: string | null
    fbc?: string | null
    fbp?: string | null
    fbclid?: string | null
    eventId?: string | null
    eventTime?: number | null
}

function normalizeEmail(value: string | null | undefined): string | null {
    if (!value) return null
    const normalized = value.trim().toLowerCase()
    return normalized || null
}

function normalizePhone(value: string | null | undefined): string | null {
    if (!value) return null
    const digits = value.replace(/\D+/g, '')
    return digits || null
}

function normalizeNamePart(value: string | null | undefined): string | null {
    if (!value) return null
    const normalized = value.trim().toLowerCase().replace(/[^a-z\s'-]+/g, '')
    return normalized || null
}

function hashValue(value: string | null): string | null {
    if (!value) return null
    return createHash('sha256').update(value).digest('hex')
}

function splitName(value: string | null | undefined) {
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

function normalizeCookieValue(value: string | null | undefined): string | null {
    if (!value) return null
    const normalized = value.trim()
    return normalized || null
}

function buildFbc(fbc: string | null | undefined, fbclid: string | null | undefined): string | null {
    const normalizedFbc = normalizeCookieValue(fbc)
    if (normalizedFbc) return normalizedFbc

    const clickId = normalizeCookieValue(fbclid)
    if (!clickId) return null

    return `fb.1.${Date.now()}.${clickId}`
}

export function buildInstantMeetingMetaEvent(input: BuildInstantMeetingMetaEventInput) {
    const resolved = resolveInstantMeetingPaymentTrigger(input.trigger)
    const { firstName, lastName } = splitName(input.name)
    const eventSourceUrl = input.eventSourceUrl?.trim() || 'https://instantmeeting.ai/'
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
    if (input.clientIpAddress?.trim()) userData.client_ip_address = input.clientIpAddress.trim()
    if (input.clientUserAgent?.trim()) userData.client_user_agent = input.clientUserAgent.trim()
    if (normalizedFbp) userData.fbp = normalizedFbp
    if (normalizedFbc) userData.fbc = normalizedFbc

    const customData: Record<string, unknown> = {
        pipeline_stage: resolved.pipelineStage,
        pipeline_trigger: resolved.trigger,
    }

    if (resolved.value !== null) {
        customData.currency = 'PHP'
        customData.value = resolved.value
    }

    return {
        event_name: resolved.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId?.trim() || randomUUID(),
        action_source: 'website' as const,
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: customData,
    }
}
