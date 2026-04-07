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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Vary': 'Origin',
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) })
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get('origin')
    const key = req.nextUrl.searchParams.get('key')
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!isValidWidgetKey(key) || !sessionId) {
        return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(origin) })
    }
    const supabase = db()
    const { data: host } = await supabase.from('users').select('id, widget_domains, widget_enabled').eq('widget_key', key).single()
    if (!host || !host.widget_enabled) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    if (!originMatchesDomains(origin, host.widget_domains)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: cors(origin) })
    }

    const { data: visitor } = await supabase
        .from('widget_visitors')
        .select('metadata')
        .eq('host_id', host.id)
        .eq('session_id', sessionId)
        .single()

    const meta = (visitor?.metadata || {}) as { pending_invite_code?: string; host_name?: string }
    if (!meta.pending_invite_code) return NextResponse.json({}, { headers: cors(origin) })
    return NextResponse.json({ code: meta.pending_invite_code, hostName: meta.host_name || null }, { headers: cors(origin) })
}
