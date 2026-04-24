import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { sendInstantMeetingPaymentMetaCapiEvent } from '@/lib/instantmeeting-payment-capi-server'

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

const PUBLIC_INSTANTMEETING_LANDING_TRIGGERS = [
    'website_visit',
    'diagnostic_start',
    'diagnostic_complete',
    'checkout_opened',
    'payment_info_added',
] as const

type PublicInstantMeetingLandingTrigger = (typeof PUBLIC_INSTANTMEETING_LANDING_TRIGGERS)[number]

function isPublicInstantMeetingLandingTrigger(
    value: unknown
): value is PublicInstantMeetingLandingTrigger {
    return typeof value === 'string' &&
        PUBLIC_INSTANTMEETING_LANDING_TRIGGERS.includes(value as PublicInstantMeetingLandingTrigger)
}

function normalizeOptionalText(value: unknown): string | null {
    return typeof value === 'string' ? value.trim() || null : null
}

function normalizeDiagnosticScore(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    if (value === '') return null

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null

    return Math.max(0, Math.min(100, Math.round(parsed)))
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const trigger = isPublicInstantMeetingLandingTrigger(body.trigger)
        ? body.trigger
        : 'website_visit'
    const pageUrl = typeof body.page_url === 'string' ? body.page_url : req.nextUrl.origin
    const fbp = typeof body.fbp === 'string' ? body.fbp : null
    const fbc = typeof body.fbc === 'string' ? body.fbc : null
    const fbclid = typeof body.fbclid === 'string' ? body.fbclid : null

    const supabase = getSupabaseClient()
    const result = await sendInstantMeetingPaymentMetaCapiEvent(supabase, {
        trigger,
        eventSourceUrl: pageUrl,
        email: normalizeOptionalText(body.email),
        phone: normalizeOptionalText(body.phone),
        name: normalizeOptionalText(body.name),
        fbp,
        fbc,
        fbclid,
        clientIpAddress: getClientIpAddress(req),
        clientUserAgent: req.headers.get('user-agent'),
        diagnosticScore: normalizeDiagnosticScore(body.diagnostic_score),
        diagnosticVerdict: normalizeOptionalText(body.diagnostic_verdict),
        landingVariant: normalizeOptionalText(body.landing_variant),
        plan: normalizeOptionalText(body.plan),
    })

    return NextResponse.json(
        { ok: true, sent: result.sent },
        { status: result.sent ? 200 : 202 }
    )
}
