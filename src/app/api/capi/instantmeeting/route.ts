import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { sendInstantMeetingMetaCapiEvent } from '@/lib/instantmeeting-payment-capi-server'

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

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const pageUrl = typeof body.page_url === 'string' ? body.page_url : req.nextUrl.origin
    const fbp = typeof body.fbp === 'string' ? body.fbp : null
    const fbc = typeof body.fbc === 'string' ? body.fbc : null
    const fbclid = typeof body.fbclid === 'string' ? body.fbclid : null

    const supabase = getSupabaseClient()
    const result = await sendInstantMeetingMetaCapiEvent(supabase, {
        trigger: 'website_visit',
        eventSourceUrl: pageUrl,
        fbp,
        fbc,
        fbclid,
        clientIpAddress: getClientIpAddress(req),
        clientUserAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json(
        { ok: true, sent: result.sent },
        { status: result.sent ? 200 : 202 }
    )
}
