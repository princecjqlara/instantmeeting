import type { SupabaseClient } from '@supabase/supabase-js'

import {
    buildInstantMeetingMetaEvent,
    type BuildInstantMeetingMetaEventInput,
} from '@/lib/instantmeeting-payment-capi'
import {
    normalizeMetaCapiConfig,
    selectMetaCapiConfig,
    type MetaCapiConfig,
} from '@/lib/meta-capi-config'
import { buildMetaCapiRequestBody } from '@/lib/meta-capi-request'
import { isMissingUsersColumnError } from '@/lib/users-column-compat'

export type MetaCapiSendResult =
    | { sent: true }
    | { sent: false; reason: 'request_failed'; status: number }
    | { sent: false; reason: 'request_error' }

interface InstantMeetingPaymentFunnelRow {
    id: string
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
    meta_capi_test_event_code?: string | null
    instantmeeting_payment_purchase_value_php?: number | null
}

export interface InstantMeetingPaymentFunnelSettings {
    ownerId: string
    purchaseValue: number
    config: MetaCapiConfig | null
}

interface FetchInstantMeetingPaymentFunnelSettingsOptions {
    organizerId?: string | null
}

interface PaymentOwnerQueryResult {
    data: InstantMeetingPaymentFunnelRow | null
    error: { message: string } | null
}

const INSTANTMEETING_PAYMENT_PURCHASE_VALUE_COLUMN = 'instantmeeting_payment_purchase_value_php'

function paymentOwnerSelect(includePurchaseValueColumn: boolean) {
    return [
        'id',
        'email',
        'meta_capi_access_token',
        'meta_capi_dataset_id',
        'meta_capi_test_event_code',
        'created_at',
        ...(includePurchaseValueColumn ? [INSTANTMEETING_PAYMENT_PURCHASE_VALUE_COLUMN] : []),
    ].join(', ')
}

function resolveInstantMeetingPurchaseValue(row: InstantMeetingPaymentFunnelRow | null | undefined) {
    return typeof row?.instantmeeting_payment_purchase_value_php === 'number' &&
        Number.isFinite(row.instantmeeting_payment_purchase_value_php) &&
        row.instantmeeting_payment_purchase_value_php > 0
        ? Math.round(row.instantmeeting_payment_purchase_value_php)
        : 699
}

function toPaymentFunnelSettings(
    row: InstantMeetingPaymentFunnelRow
): InstantMeetingPaymentFunnelSettings {
    return {
        ownerId: row.id,
        purchaseValue: resolveInstantMeetingPurchaseValue(row),
        config: normalizeMetaCapiConfig(row),
    }
}

async function runPaymentOwnerQuery(
    buildQuery: (select: string) => PromiseLike<PaymentOwnerQueryResult>,
    includePurchaseValueColumn = true
): Promise<PaymentOwnerQueryResult> {
    const result = await buildQuery(paymentOwnerSelect(includePurchaseValueColumn))

    if (
        includePurchaseValueColumn &&
        isMissingUsersColumnError(result.error, INSTANTMEETING_PAYMENT_PURCHASE_VALUE_COLUMN)
    ) {
        return runPaymentOwnerQuery(buildQuery, false)
    }

    return result
}

export async function fetchOrganizerMetaCapiConfig(
    supabase: SupabaseClient,
    organizerId: string
): Promise<MetaCapiConfig | null> {
    const { data, error } = await supabase
        .from('users')
        .select('meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code')
        .eq('id', organizerId)
        .maybeSingle()

    if (error) {
        console.error('Failed to load organizer Meta CAPI config:', error)
        return null
    }

    return normalizeMetaCapiConfig(data)
}

export async function fetchInstantMeetingMetaCapiConfig(
    supabase: SupabaseClient
): Promise<MetaCapiConfig | null> {
    const { data, error } = await supabase
        .from('users')
        .select('role, meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code, created_at')
        .not('meta_capi_access_token', 'is', null)
        .not('meta_capi_dataset_id', 'is', null)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Failed to load InstantMeeting Meta CAPI config:', error)
        return null
    }

    return selectMetaCapiConfig(data)
}

export async function fetchInstantMeetingPaymentFunnelSettings(
    supabase: SupabaseClient,
    options: FetchInstantMeetingPaymentFunnelSettingsOptions = {}
): Promise<InstantMeetingPaymentFunnelSettings | null> {
    const organizerId = options.organizerId?.trim() || null
    const configuredOrganizerEmail = process.env.ORGANIZER_EMAIL?.trim().toLowerCase() || null

    const baseQuery = (select: string) =>
        supabase
            .from('users')
            .select(select)
            .eq('role', 'organizer')

    const explicitOwnerResult = organizerId
        ? await runPaymentOwnerQuery(
              (select) => baseQuery(select).eq('id', organizerId).maybeSingle()
          )
        : { data: null, error: null }

    if (explicitOwnerResult.error) {
        console.error('Failed to load explicit InstantMeeting payment owner:', explicitOwnerResult.error)
        return null
    }

    if (organizerId) {
        const data = explicitOwnerResult.data

        if (!data?.id) {
            return null
        }

        return toPaymentFunnelSettings(data)
    }

    const configuredOwnerResult = configuredOrganizerEmail
        ? await runPaymentOwnerQuery(
              (select) =>
                  baseQuery(select).eq('email', configuredOrganizerEmail).maybeSingle()
          )
        : { data: null, error: null }

    if (configuredOwnerResult.error) {
        console.error('Failed to load configured InstantMeeting payment owner:', configuredOwnerResult.error)
        return null
    }

    const fallbackOwnerResult = configuredOwnerResult.data
        ? { data: configuredOwnerResult.data, error: null }
        : await runPaymentOwnerQuery(
              (select) =>
                  baseQuery(select)
                      .order('created_at', { ascending: true })
                      .limit(1)
                      .maybeSingle()
          )

    const { data, error } = fallbackOwnerResult

    if (error) {
        console.error('Failed to load InstantMeeting payment funnel settings:', error)
        return null
    }

    if (!data?.id) {
        return null
    }

    return toPaymentFunnelSettings(data)
}

export async function sendInstantMeetingMetaCapiEventWithConfig(
    config: MetaCapiConfig,
    event: Record<string, unknown>
): Promise<MetaCapiSendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v20.0/${config.datasetId}/events?access_token=${encodeURIComponent(config.accessToken)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    buildMetaCapiRequestBody(event, {
                        testEventCode: config.testEventCode,
                    })
                ),
                cache: 'no-store',
            }
        )

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            console.error('Meta CAPI request failed:', response.status, body)
            return {
                sent: false,
                reason: 'request_failed',
                status: response.status,
            }
        }

        return { sent: true }
    } catch (error) {
        console.error('Meta CAPI request errored:', error)
        return { sent: false, reason: 'request_error' }
    }
}

export async function sendInstantMeetingMetaCapiEvent(
    supabase: SupabaseClient,
    input: BuildInstantMeetingMetaEventInput & {
        organizerId?: string | null
    }
) {
    const config = input.organizerId
        ? await fetchOrganizerMetaCapiConfig(supabase, input.organizerId)
        : await fetchInstantMeetingMetaCapiConfig(supabase)

    if (!config) {
        return { sent: false, reason: 'missing_config' as const }
    }

    const event = buildInstantMeetingMetaEvent(input)

    return sendInstantMeetingMetaCapiEventWithConfig(config, event)
}

export async function sendInstantMeetingPaymentMetaCapiEvent(
    supabase: SupabaseClient,
    input: BuildInstantMeetingMetaEventInput & {
        organizerId?: string | null
    }
) {
    const settings = await fetchInstantMeetingPaymentFunnelSettings(supabase, { organizerId: input.organizerId })

    if (!settings?.config) {
        return { sent: false, reason: 'missing_config' as const }
    }

    const event = buildInstantMeetingMetaEvent({
        ...input,
        valueOverride:
            input.trigger === 'admin_verify'
                ? input.valueOverride ?? settings.purchaseValue
                : input.valueOverride,
    })

    return sendInstantMeetingMetaCapiEventWithConfig(settings.config, event)
}
