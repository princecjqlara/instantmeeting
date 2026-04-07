import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidWidgetKey, originMatchesDomains } from '@/lib/widget-key'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function corsHeaders(origin: string | null) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get('origin')
    const key = req.nextUrl.searchParams.get('key')
    if (!isValidWidgetKey(key)) {
        return NextResponse.json({ error: 'invalid key' }, { status: 400, headers: corsHeaders(origin) })
    }

    const { data: user } = await db()
        .from('users')
        .select('id, name, avatar_url, widget_enabled, widget_domains, widget_form_fields, widget_theme, widget_mirror_enabled')
        .eq('widget_key', key!)
        .single()

    if (!user || !user.widget_enabled) {
        return NextResponse.json({ error: 'not found' }, { status: 404, headers: corsHeaders(origin) })
    }
    if (!originMatchesDomains(origin, user.widget_domains)) {
        return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers: corsHeaders(origin) })
    }

    return NextResponse.json({
        hostId: user.id,
        hostName: user.name,
        hostAvatar: user.avatar_url,
        formFields: user.widget_form_fields || [],
        theme: user.widget_theme || {},
        mirrorEnabled: !!user.widget_mirror_enabled,
        channelId: `widget-${user.id}`,
    }, { headers: corsHeaders(origin) })
}
