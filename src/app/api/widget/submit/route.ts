import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidWidgetKey, originMatchesDomains } from '@/lib/widget-key'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function cors(origin: string | null) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
    const origin = req.headers.get('origin')
    const body = await req.json()
    const { key, sessionId, name, email, phone, customFields, scheduledAt } = body
    if (!isValidWidgetKey(key) || !name) {
        return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(origin) })
    }
    const supabase = db()
    const { data: host } = await supabase
        .from('users')
        .select('id, widget_domains, widget_enabled')
        .eq('widget_key', key)
        .single()
    if (!host || !host.widget_enabled) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    if (!originMatchesDomains(origin, host.widget_domains)) {
        return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers: cors(origin) })
    }

    const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
            user_id: host.id,
            title: `Widget lead: ${name}`,
            status: 'pending',
            scheduled_at: scheduledAt || null,
            source: 'widget',
        })
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors(origin) })

    await supabase.from('waiting_guests').insert({
        meeting_id: meeting.id,
        guest_name: name,
        guest_email: email || null,
        guest_phone: phone || null,
        custom_fields: Array.isArray(customFields) ? customFields : [],
        status: 'waiting',
    })

    if (sessionId) {
        await supabase
            .from('widget_visitors')
            .upsert(
                {
                    host_id: host.id,
                    session_id: sessionId,
                    visitor_name: name,
                    visitor_email: email || null,
                    visitor_phone: phone || null,
                    status: 'engaged',
                    last_heartbeat_at: new Date().toISOString(),
                },
                { onConflict: 'host_id,session_id' }
            )
    }

    return NextResponse.json({ ok: true, meetingId: meeting.id }, { headers: cors(origin) })
}
