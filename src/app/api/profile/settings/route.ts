import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { normalizeProfileSettings, type ProfileSettingsRecord } from '@/lib/profile-settings'
import { isMissingUsersColumnError } from '@/lib/users-column-compat'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const AUTO_ADMIT_COLUMN = 'auto_admit'

const PROFILE_SETTINGS_COLUMNS = [
    'username',
    'name',
    'bio',
    'avatar_url',
    'availability_mode',
    AUTO_ADMIT_COLUMN,
    'available_from',
    'available_to',
    'timezone',
    'scroll_threshold',
    'meeting_duration',
    'followers',
    'following',
    'welcome_audio_url',
]

interface ProfileSettingsQueryResult {
    data: Partial<ProfileSettingsRecord> | null
    error: { message: string } | null
}

function profileSettingsSelect(includeAutoAdmit: boolean) {
    const columns = includeAutoAdmit
        ? PROFILE_SETTINGS_COLUMNS
        : PROFILE_SETTINGS_COLUMNS.filter(column => column !== AUTO_ADMIT_COLUMN)

    return columns.join(', ')
}

async function fetchProfileSettingsByEmail(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    includeAutoAdmit = true
): Promise<ProfileSettingsQueryResult> {
    const queryResult = await supabase
        .from('users')
        .select(profileSettingsSelect(includeAutoAdmit))
        .eq('email', email)
        .maybeSingle()

    if (
        includeAutoAdmit &&
        isMissingUsersColumnError(queryResult.error, AUTO_ADMIT_COLUMN)
    ) {
        return fetchProfileSettingsByEmail(supabase, email, false)
    }

    return {
        data: queryResult.data as Partial<ProfileSettingsRecord> | null,
        error: queryResult.error ? { message: queryResult.error.message } : null,
    }
}

async function insertProfileSettings(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    updateData: Record<string, unknown>
) {
    const payload = {
        email,
        ...updateData,
    }

    let result = await supabase
        .from('users')
        .insert(payload)

    if (
        result.error &&
        AUTO_ADMIT_COLUMN in payload &&
        isMissingUsersColumnError(result.error, AUTO_ADMIT_COLUMN)
    ) {
        const fallbackPayload = { ...payload }
        delete fallbackPayload[AUTO_ADMIT_COLUMN]

        result = await supabase
            .from('users')
            .insert(fallbackPayload)
    }

    return result
}

async function updateProfileSettings(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    updateData: Record<string, unknown>
) {
    const payload = { ...updateData }

    let result = await supabase
        .from('users')
        .update(payload)
        .eq('email', email)

    if (
        result.error &&
        AUTO_ADMIT_COLUMN in payload &&
        isMissingUsersColumnError(result.error, AUTO_ADMIT_COLUMN)
    ) {
        delete payload[AUTO_ADMIT_COLUMN]

        result = await supabase
            .from('users')
            .update(payload)
            .eq('email', email)
    }

    return result
}

// GET: Get current user's profile settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error } = await fetchProfileSettingsByEmail(
        supabase,
        session.user.email
    )

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
        normalizeProfileSettings(user, { fallbackName: session.user.name || '' }),
        { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
    )
}

// PATCH: Update profile settings
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { username, name, bio, followers, following, auto_admit } = body

    // Validate username only if it's a non-empty string
    if (username && username.length > 0) {
        // Check if username is already taken by another user
        const { data: existing, error: existingError } = await supabase
            .from('users')
            .select('email')
            .eq('username', username)
            .neq('email', session.user.email)
            .maybeSingle()

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 })
        }

        if (existing) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
        }

        // Validate username format
        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
            return NextResponse.json({
                error: 'Username must be 3-20 characters, lowercase letters, numbers and underscores only'
            }, { status: 400 })
        }
    }

    const updateData: Record<string, unknown> = {}
    if (username !== undefined) updateData.username = username || null
    if (name !== undefined) updateData.name = name || null
    if (bio !== undefined) updateData.bio = bio || null
    if (followers !== undefined) updateData.followers = followers
    if (following !== undefined) updateData.following = following
    if (auto_admit !== undefined) updateData.auto_admit = auto_admit

    // First check if user exists
    const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle()

    if (existingUserError) {
        return NextResponse.json({ error: existingUserError.message }, { status: 500 })
    }

    if (!existingUser) {
        // Create user if doesn't exist
        const { error: createError } = await insertProfileSettings(
            supabase,
            session.user.email,
            updateData
        )

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }
    } else {
        const { error: updateError } = await updateProfileSettings(
            supabase,
            session.user.email,
            updateData
        )

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
    }

    const { data: user, error } = await fetchProfileSettingsByEmail(
        supabase,
        session.user.email
    )

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
        normalizeProfileSettings(user, { fallbackName: session.user.name || '' })
    )
}
