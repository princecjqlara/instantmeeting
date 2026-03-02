import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { planTenantProvisioning } from '@/lib/tenant-provisioning'

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
    const rawEmail = typeof body.email === 'string' ? body.email : ''
    const rawName = typeof body.name === 'string' ? body.name : ''
    const rawPassword = typeof body.password === 'string' ? body.password : ''

    const email = rawEmail.toLowerCase().trim()
    const name = rawName.trim() || null
    const password = rawPassword.trim()

    if (!email || !password) {
        return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
        )
    }

    if (password.length < 6) {
        return NextResponse.json(
            { error: 'Password must be at least 6 characters' },
            { status: 400 }
        )
    }

    const supabase = getSupabaseClient()

    const { data: existing, error: existingError } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', email)
        .maybeSingle()

    if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const plan = planTenantProvisioning({
        existingUser: existing,
        email,
        name,
    })

    if (plan.mode === 'reject') {
        return NextResponse.json(
            { error: 'Cannot overwrite organizer account' },
            { status: 409 }
        )
    }

    // Hash password and create or update tenant
    const password_hash = await bcrypt.hash(password, 12)

    const upsertData = {
        ...plan.data,
        password_hash,
    }

    const tenantQuery = plan.mode === 'create'
        ? supabase
            .from('users')
            .insert(upsertData)
            .select('id, email, name, role, created_at')
            .single()
        : supabase
            .from('users')
            .update(upsertData)
            .eq('id', plan.id)
            .select('id, email, name, role, created_at')
            .single()

    const { data: tenant, error } = await tenantQuery

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
        {
            ...tenant,
            action: plan.mode,
        },
        { status: plan.mode === 'create' ? 201 : 200 }
    )
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
