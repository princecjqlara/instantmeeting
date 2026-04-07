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
    const { key, sessionId, page, title, scrollDepth, event } = body
    if (!isValidWidgetKey(key) || !sessionId) {
        return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(origin) })
    }
    const supabase = db()
    const { data: host } = await supabase.from('users').select('id, widget_domains, widget_enabled').eq('widget_key', key).single()
    if (!host || !host.widget_enabled) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    if (!originMatchesDomains(origin, host.widget_domains)) {
        return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers: cors(origin) })
    }

    if (event === 'leave') {
        await supabase
            .from('widget_visitors')
            .update({ status: 'left', last_heartbeat_at: new Date().toISOString() })
            .eq('host_id', host.id)
            .eq('session_id', sessionId)
        return NextResponse.json({ ok: true }, { headers: cors(origin) })
    }

    // Note: do NOT include `metadata` here — it's used by the invite flow to stash
    // pending_invite_code, and overwriting on every heartbeat would wipe it.
    // Status is also left alone so 'engaged'/'invited' aren't reverted to 'browsing'.
    await supabase.from('widget_visitors').upsert(
        {
            host_id: host.id,
            session_id: sessionId,
            current_page_url: page || null,
            current_page_title: title || null,
            scroll_depth: typeof scrollDepth === 'number' ? scrollDepth : 0,
            last_heartbeat_at: new Date().toISOString(),
        },
        { onConflict: 'host_id,session_id' }
    )

    return NextResponse.json({ ok: true }, { headers: cors(origin) })
}
