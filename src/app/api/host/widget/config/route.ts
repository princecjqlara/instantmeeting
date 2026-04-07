import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'
import { generateWidgetKey } from '@/lib/widget-key'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function requireUser() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null
    const supabase = db()
    const { data } = await supabase
        .from('users')
        .select('id, email, name, widget_key, widget_domains, widget_enabled, widget_form_fields, widget_theme, widget_mirror_enabled')
        .eq('email', session.user.email)
        .single()
    return data
}

export async function GET() {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let widgetKey = user.widget_key
    if (!widgetKey) {
        widgetKey = generateWidgetKey()
        await db().from('users').update({ widget_key: widgetKey }).eq('id', user.id)
    }

    return NextResponse.json({
        widgetKey,
        domains: user.widget_domains || [],
        enabled: !!user.widget_enabled,
        formFields: user.widget_form_fields || [],
        theme: user.widget_theme || {},
        mirrorEnabled: !!user.widget_mirror_enabled,
    })
}

export async function PUT(req: NextRequest) {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (Array.isArray(body.domains)) update.widget_domains = body.domains
    if (typeof body.enabled === 'boolean') update.widget_enabled = body.enabled
    if (Array.isArray(body.formFields)) update.widget_form_fields = body.formFields
    if (body.theme && typeof body.theme === 'object') update.widget_theme = body.theme
    if (typeof body.mirrorEnabled === 'boolean') update.widget_mirror_enabled = body.mirrorEnabled

    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })
    const { error } = await db().from('users').update(update).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
