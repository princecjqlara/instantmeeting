import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    maybeSendLeadFormFunnelMetaEvent,
    type LeadFormFunnelMetaEventName,
} from '@/lib/lead-form-qualified-capi'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function getClientIpAddress(req: NextRequest): string | null {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim()
        if (first) return first
    }

    const realIp = req.headers.get('x-real-ip')?.trim()
    return realIp || null
}

function normalizeEventName(value: unknown): LeadFormFunnelMetaEventName | null {
    if (
        value === 'PageView' ||
        value === 'InstantMeetingLeadFormStart'
    ) {
        return value
    }

    return null
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { formSlug, eventName, page_url, fbclid, fbp, fbc } = body || {}
    const normalizedEventName = normalizeEventName(eventName)

    if (!formSlug || typeof formSlug !== 'string' || !normalizedEventName) {
        return NextResponse.json({ error: 'formSlug and supported eventName required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data: form, error } = await supabase
        .from('lead_forms')
        .select('id, slug, user_id, is_active, meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code')
        .eq('slug', formSlug)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!form || !form.is_active) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    after(() =>
        maybeSendLeadFormFunnelMetaEvent({
            supabase,
            leadForm: form,
            eventName: normalizedEventName,
            eventSourceUrl:
                typeof page_url === 'string' && page_url.trim()
                    ? page_url
                    : `${req.nextUrl.origin}/leads/${form.slug}`,
            clientIpAddress: getClientIpAddress(req),
            clientUserAgent: req.headers.get('user-agent'),
            fbp: typeof fbp === 'string' ? fbp : null,
            fbc: typeof fbc === 'string' ? fbc : null,
            fbclid: typeof fbclid === 'string' ? fbclid : null,
        }).catch((sendError) => {
            console.error('Lead-form funnel Meta CAPI send failed:', sendError)
        })
    )

    return NextResponse.json({ queued: true })
}
