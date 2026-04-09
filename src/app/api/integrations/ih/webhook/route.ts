import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const IH_API_URL = process.env.INSTANT_HOMES_API_URL ?? 'http://localhost:3100'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'instanthomes-dev-webhook-secret'

/**
 * POST /api/integrations/ih/webhook
 *
 * Internal route for IM services to trigger webhook events to InstantHomes.
 * This acts as the webhook sender — IM internals call this route, which then
 * forwards signed webhook events to the IH server.
 *
 * Body: { imUserId, type, payload }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { imUserId, type, payload } = body

        if (!imUserId || !type) {
            return NextResponse.json({ error: 'imUserId and type are required' }, { status: 400 })
        }

        // Check if the user has an IH connection
        const { data: user } = await db()
            .from('users')
            .select('ih_linked, ih_tenant_id')
            .eq('id', imUserId)
            .single()

        if (!user?.ih_linked) {
            return NextResponse.json({ skipped: true, reason: 'User not linked to IH' })
        }

        // Build the webhook payload
        const webhookPayload = {
            type,
            payload: payload || {},
            imUserId,
            timestamp: new Date().toISOString(),
        }

        const payloadString = JSON.stringify(webhookPayload)

        // Sign with HMAC-SHA256
        const { createHmac } = await import('crypto')
        const signature = `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex')}`

        // Send to IH webhook endpoint
        const ihResponse = await fetch(`${IH_API_URL}/api/integrations/instant-meeting/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-IM-Signature': signature,
            },
            body: payloadString,
        })

        if (!ihResponse.ok) {
            console.error(`Webhook delivery failed: ${ihResponse.status}`)
            return NextResponse.json({ delivered: false, status: ihResponse.status }, { status: 502 })
        }

        // Log the event in cross_platform_events
        await db()
            .from('cross_platform_events')
            .insert({
                host_id: imUserId,
                source: 'im_webhook',
                source_id: null,
                event_type: type,
                metadata: payload || {},
            })

        return NextResponse.json({ delivered: true })
    } catch (error) {
        console.error('Webhook sender error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
