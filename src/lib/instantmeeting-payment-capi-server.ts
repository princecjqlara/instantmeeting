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
