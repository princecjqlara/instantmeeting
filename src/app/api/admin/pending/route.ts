import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { sendInstantMeetingMetaCapiEvent } from '@/lib/instantmeeting-payment-capi-server'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function requireOrganizer() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', session.user.email)
        .single()

    if (!user || user.role !== 'organizer') return null
    return user
}

// GET /api/admin/pending?status=pending|verified|rejected (default pending)
export async function GET(req: NextRequest) {
    const organizer = await requireOrganizer()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
        .from('pending_signups')
        .select('id, email, name, phone, receipt_url, amount, plan, status, admin_note, created_at, reviewed_at')
        .eq('status', status)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
}

// PATCH /api/admin/pending — { id, action: 'verify' | 'reject', note? }
export async function PATCH(req: NextRequest) {
    const organizer = await requireOrganizer()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { id?: unknown; action?: unknown; note?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'verify' || body.action === 'reject' ? body.action : null
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null

    if (!id || !action) {
        return NextResponse.json({ error: 'id and action required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data: pending, error: fetchErr } = await supabase
        .from('pending_signups')
        .select('id, email, name, phone, password_hash, status')
        .eq('id', id)
        .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (pending.status !== 'pending') {
        return NextResponse.json(
            { error: `Already ${pending.status}` },
            { status: 409 }
        )
    }

    if (action === 'reject') {
        const { error: updateErr } = await supabase
            .from('pending_signups')
            .update({
                status: 'rejected',
                admin_note: note,
                reviewed_at: new Date().toISOString(),
        })
            .eq('id', id)
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

        void sendInstantMeetingMetaCapiEvent(supabase, {
            organizerId: organizer.id,
            trigger: 'admin_reject',
            eventSourceUrl: `${req.nextUrl.origin}/admin`,
            email: pending.email,
            phone: pending.phone,
            name: pending.name,
            clientIpAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            clientUserAgent: req.headers.get('user-agent'),
        })

        return NextResponse.json({ success: true, action: 'reject' })
    }

    // action === 'verify'
    const { data: alreadyUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', pending.email)
        .maybeSingle()

    if (alreadyUser) {
        // A user with this email already exists (e.g. they were created manually).
        // Mark pending as verified without overwriting the password.
        const { error: updateErr } = await supabase
            .from('pending_signups')
            .update({
                status: 'verified',
                admin_note: note,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

        void sendInstantMeetingMetaCapiEvent(supabase, {
            organizerId: organizer.id,
            trigger: 'admin_verify',
            eventSourceUrl: `${req.nextUrl.origin}/admin`,
            email: pending.email,
            phone: pending.phone,
            name: pending.name,
            clientIpAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            clientUserAgent: req.headers.get('user-agent'),
        })

        return NextResponse.json({ success: true, action: 'verify', existing: true })
    }

    const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
            email: pending.email,
            name: pending.name,
            password_hash: pending.password_hash,
            role: 'tenant',
        })
        .select('id, email')
        .single()

    if (userErr) {
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }

    const { error: updateErr } = await supabase
        .from('pending_signups')
        .update({
            status: 'verified',
            admin_note: note,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    void sendInstantMeetingMetaCapiEvent(supabase, {
        organizerId: organizer.id,
        trigger: 'admin_verify',
        eventSourceUrl: `${req.nextUrl.origin}/admin`,
        email: pending.email,
        phone: pending.phone,
        name: pending.name,
        clientIpAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        clientUserAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true, action: 'verify', user: newUser })
}
