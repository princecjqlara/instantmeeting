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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const { key, sessionId, name, text } = body
    if (!isValidWidgetKey(key) || !sessionId || !text) {
        return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(origin) })
    }
    const supabase = db()
    const { data: host } = await supabase.from('users').select('id, widget_domains, widget_enabled').eq('widget_key', key).single()
    if (!host || !host.widget_enabled) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    if (!originMatchesDomains(origin, host.widget_domains)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: cors(origin) })
    }
    await supabase.from('widget_chat_messages').insert({
        host_id: host.id,
        visitor_session_id: sessionId,
        sender: 'guest',
        sender_name: name || null,
        text: String(text).slice(0, 2000),
    })
    return NextResponse.json({ ok: true }, { headers: cors(origin) })
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get('origin')
    const key = req.nextUrl.searchParams.get('key')
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!isValidWidgetKey(key) || !sessionId) {
        return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(origin) })
    }
    const supabase = db()
    const { data: host } = await supabase.from('users').select('id, widget_domains').eq('widget_key', key!).single()
    if (!host) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    if (!originMatchesDomains(origin, host.widget_domains)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: cors(origin) })
    }
    const { data } = await supabase
        .from('widget_chat_messages')
        .select('sender, sender_name, text, created_at')
        .eq('host_id', host.id)
        .eq('visitor_session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(100)
    return NextResponse.json({ messages: data || [] }, { headers: cors(origin) })
}
