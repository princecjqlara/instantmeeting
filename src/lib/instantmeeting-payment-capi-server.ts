import type { SupabaseClient } from '@supabase/supabase-js'

import {
    buildInstantMeetingMetaEvent,
    type BuildInstantMeetingMetaEventInput,
} from '@/lib/instantmeeting-payment-capi'

interface MetaCapiConfigRow {
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
}

interface InstantMeetingMetaCapiConfig {
    accessToken: string
    datasetId: string
}

function normalizeMetaConfig(row: MetaCapiConfigRow | null | undefined): InstantMeetingMetaCapiConfig | null {
    const accessToken = row?.meta_capi_access_token?.trim()
    const datasetId = row?.meta_capi_dataset_id?.trim()

    if (!accessToken || !datasetId) {
        return null
    }

    return { accessToken, datasetId }
}

export async function fetchOrganizerMetaCapiConfig(
    supabase: SupabaseClient,
    organizerId: string
): Promise<InstantMeetingMetaCapiConfig | null> {
    const { data, error } = await supabase
        .from('users')
        .select('meta_capi_access_token, meta_capi_dataset_id')
        .eq('id', organizerId)
        .maybeSingle()

    if (error) {
        console.error('Failed to load organizer Meta CAPI config:', error)
        return null
    }

    return normalizeMetaConfig(data)
}

export async function fetchInstantMeetingMetaCapiConfig(
    supabase: SupabaseClient
): Promise<InstantMeetingMetaCapiConfig | null> {
    const { data, error } = await supabase
        .from('users')
        .select('meta_capi_access_token, meta_capi_dataset_id, created_at')
        .eq('role', 'organizer')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('Failed to load InstantMeeting Meta CAPI config:', error)
        return null
    }

    return normalizeMetaConfig(data)
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

    try {
        const response = await fetch(
            `https://graph.facebook.com/v20.0/${config.datasetId}/events?access_token=${encodeURIComponent(config.accessToken)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [event] }),
                cache: 'no-store',
            }
        )

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            console.error('Meta CAPI request failed:', response.status, body)
            return {
                sent: false,
                reason: 'request_failed' as const,
                status: response.status,
            }
        }

        return { sent: true as const }
    } catch (error) {
        console.error('Meta CAPI request errored:', error)
        return { sent: false as const, reason: 'request_error' as const }
    }
}
