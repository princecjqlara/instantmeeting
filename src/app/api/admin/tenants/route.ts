import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Verify the current user is an organizer.
 */
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

/**
 * GET /api/admin/tenants — List all tenants (organizer only)
 */
export async function GET() {
    const organizer = await requireOrganizer()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data: tenants, error } = await supabase
        .from('users')
        .select('id, email, name, role, created_at')
        .eq('role', 'tenant')
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tenants)
}

/**
 * POST /api/admin/tenants — Create a new tenant (organizer only)
 * Body: { email, name, password }
 */
export async function POST(req: NextRequest) {
    const organizer = await requireOrganizer()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email, name, password } = body

    if (!email || !password) {
        return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
        )
    }

    const supabase = getSupabaseClient()

    // Check if email already exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single()

    if (existing) {
        return NextResponse.json(
            { error: 'A user with this email already exists' },
            { status: 409 }
        )
    }

    // Hash password and create tenant
    const password_hash = await bcrypt.hash(password, 12)

    const { data: tenant, error } = await supabase
        .from('users')
        .insert({
            email: email.toLowerCase().trim(),
            name: name || null,
            password_hash,
            role: 'tenant',
        })
        .select('id, email, name, role, created_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tenant, { status: 201 })
}

/**
 * DELETE /api/admin/tenants — Delete a tenant (organizer only)
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
    const organizer = await requireOrganizer()
    if (!organizer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id } = body

    if (!id) {
        return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Verify this is actually a tenant, not the organizer
    const { data: user } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', id)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role === 'organizer') {
        return NextResponse.json({ error: 'Cannot delete organizer account' }, { status: 403 })
    }

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tenant deleted' })
}
