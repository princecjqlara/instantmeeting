import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get all leads (waiting guests) with meeting details for the host
export async function GET(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'

    // Build query to get all waiting guests for host's meetings
    let query = supabase
        .from('waiting_guests')
        .select(`
            *,
            meetings!inner(
                id,
                title,
                scheduled_at,
                status,
                user_id
            )
        `)
        .eq('meetings.user_id', user.id)
        .order('joined_at', { ascending: false })

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    const { data: leads, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(leads)
}

// DELETE: delete one or many leads owned by current host.
// Supports ?id=<uuid> OR ?ids=<uuid,uuid,...> OR a JSON body { ids: [...] }.
export async function DELETE(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const singleId = searchParams.get('id')
    const multiParam = searchParams.get('ids')
    let ids: string[] = []
    if (singleId) ids.push(singleId)
    if (multiParam) ids.push(...multiParam.split(',').map((s) => s.trim()).filter(Boolean))
    if (ids.length === 0) {
        try {
            const body = await req.json()
            if (Array.isArray(body?.ids)) {
                ids = body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
            }
        } catch {
            /* no body */
        }
    }
    ids = Array.from(new Set(ids))
    if (ids.length === 0) {
        return NextResponse.json({ error: 'Lead id(s) required' }, { status: 400 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only delete rows that belong to this host's meetings.
    const { data: owned, error: ownedErr } = await supabase
        .from('waiting_guests')
        .select('id, meetings!inner(user_id)')
        .in('id', ids)
        .eq('meetings.user_id', user.id)

    if (ownedErr) {
        return NextResponse.json({ error: ownedErr.message }, { status: 500 })
    }

    const deletableIds = (owned || []).map((r: { id: string }) => r.id)
    if (deletableIds.length === 0) {
        return NextResponse.json({ error: 'No matching leads' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
        .from('waiting_guests')
        .delete()
        .in('id', deletableIds)

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: deletableIds.length })
}

// PATCH: update tags on one or many leads.
// Body: { ids: string[], tags: string[], mode?: 'set' | 'add' | 'remove' }
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { ids?: unknown; tags?: unknown; mode?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const ids = Array.isArray(body.ids)
        ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
        : []
    const tags = Array.isArray(body.tags)
        ? body.tags
              .filter((x: unknown): x is string => typeof x === 'string')
              .map((t) => t.trim().slice(0, 40))
              .filter(Boolean)
        : []
    const mode = body.mode === 'add' || body.mode === 'remove' || body.mode === 'set' ? body.mode : 'set'

    if (ids.length === 0) {
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch current tags for owned rows only.
    const { data: owned, error: fetchErr } = await supabase
        .from('waiting_guests')
        .select('id, tags, meetings!inner(user_id)')
        .in('id', ids)
        .eq('meetings.user_id', user.id)

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!owned || owned.length === 0) {
        return NextResponse.json({ error: 'No matching leads' }, { status: 404 })
    }

    const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)))

    const updates = (owned as Array<{ id: string; tags?: string[] | null }>).map((row) => {
        const current = Array.isArray(row.tags) ? row.tags : []
        let next: string[]
        if (mode === 'set') next = uniq(tags)
        else if (mode === 'add') next = uniq([...current, ...tags])
        else next = current.filter((t) => !tags.includes(t))
        return { id: row.id, tags: next }
    })

    // Supabase doesn't have a single-shot per-row patch, so run in parallel.
    const results = await Promise.all(
        updates.map((u) =>
            supabase.from('waiting_guests').update({ tags: u.tags }).eq('id', u.id)
        )
    )
    const firstErr = results.find((r) => r.error)
    if (firstErr?.error) {
        return NextResponse.json({ error: firstErr.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: updates.length })
}
