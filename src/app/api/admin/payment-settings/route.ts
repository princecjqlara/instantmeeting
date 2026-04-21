import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'

import { authOptions } from '@/lib/auth'
import { fetchInstantMeetingPaymentFunnelSettings } from '@/lib/instantmeeting-payment-capi-server'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function requireOrganizerSession() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', session.user.email)
        .maybeSingle()

    if (!user || user.role !== 'organizer') {
        return null
    }

    return user
}

export async function GET() {
    const organizer = await requireOrganizerSession()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const settings = await fetchInstantMeetingPaymentFunnelSettings(supabase)

    if (!settings) {
        return NextResponse.json({ error: 'Payment owner not found' }, { status: 404 })
    }

    return NextResponse.json({
        meta_capi_access_token: settings.config?.accessToken || '',
        meta_capi_dataset_id: settings.config?.datasetId || '',
        meta_capi_test_event_code: settings.config?.testEventCode || '',
        instantmeeting_payment_purchase_value_php: settings.purchaseValue,
    })
}

export async function PATCH(req: NextRequest) {
    const organizer = await requireOrganizerSession()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const parsedPurchaseValue = Number(body.instantmeeting_payment_purchase_value_php)

    const payload = {
        meta_capi_access_token:
            typeof body.meta_capi_access_token === 'string'
                ? body.meta_capi_access_token.trim() || null
                : null,
        meta_capi_dataset_id:
            typeof body.meta_capi_dataset_id === 'string'
                ? body.meta_capi_dataset_id.trim() || null
                : null,
        meta_capi_test_event_code:
            typeof body.meta_capi_test_event_code === 'string'
                ? body.meta_capi_test_event_code.trim() || null
                : null,
        instantmeeting_payment_purchase_value_php:
            Number.isFinite(parsedPurchaseValue) && parsedPurchaseValue > 0
                ? Math.round(parsedPurchaseValue)
                : 699,
    }

    const supabase = getSupabaseClient()
    const settings = await fetchInstantMeetingPaymentFunnelSettings(supabase)

    if (!settings) {
        return NextResponse.json({ error: 'Payment owner not found' }, { status: 404 })
    }

    const { error } = await supabase.from('users').update(payload).eq('id', settings.ownerId)
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        meta_capi_access_token: payload.meta_capi_access_token || '',
        meta_capi_dataset_id: payload.meta_capi_dataset_id || '',
        meta_capi_test_event_code: payload.meta_capi_test_event_code || '',
        instantmeeting_payment_purchase_value_php: payload.instantmeeting_payment_purchase_value_php,
    })
}
