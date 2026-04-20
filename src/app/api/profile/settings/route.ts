import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { normalizeProfileSettings, type ProfileSettingsRecord } from '@/lib/profile-settings'
import { normalizeLeadsPipelineStages } from '@/lib/lead-pipeline'
import { isMissingUsersColumnError } from '@/lib/users-column-compat'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const AUTO_ADMIT_COLUMN = 'auto_admit'
const ONBOARDING_COLUMN = 'onboarding_completed'
const LEADS_PIPELINE_STAGES_COLUMN = 'leads_pipeline_stages'
const META_CAPI_ACCESS_TOKEN_COLUMN = 'meta_capi_access_token'
const META_CAPI_DATASET_ID_COLUMN = 'meta_capi_dataset_id'

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
    'onboarding_completed',
    LEADS_PIPELINE_STAGES_COLUMN,
    META_CAPI_ACCESS_TOKEN_COLUMN,
    META_CAPI_DATASET_ID_COLUMN,
]

interface ProfileSettingsQueryResult {
    data: Partial<ProfileSettingsRecord> | null
    error: { message: string } | null
}

function profileSettingsSelect(skip: Set<string>) {
    const columns = PROFILE_SETTINGS_COLUMNS.filter((column) => !skip.has(column))
    return columns.join(', ')
}

async function fetchProfileSettingsByEmail(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    skip: Set<string> = new Set()
): Promise<ProfileSettingsQueryResult> {
    const queryResult = await supabase
        .from('users')
        .select(profileSettingsSelect(skip))
        .eq('email', email)
        .maybeSingle()

    if (queryResult.error) {
        for (const col of [
            AUTO_ADMIT_COLUMN,
            ONBOARDING_COLUMN,
            LEADS_PIPELINE_STAGES_COLUMN,
            META_CAPI_ACCESS_TOKEN_COLUMN,
            META_CAPI_DATASET_ID_COLUMN,
        ]) {
            if (!skip.has(col) && isMissingUsersColumnError(queryResult.error, col)) {
                const next = new Set(skip)
                next.add(col)
                return fetchProfileSettingsByEmail(supabase, email, next)
            }
        }
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

    let result = await supabase.from('users').insert(payload)

    for (const col of [
        AUTO_ADMIT_COLUMN,
        ONBOARDING_COLUMN,
        LEADS_PIPELINE_STAGES_COLUMN,
        META_CAPI_ACCESS_TOKEN_COLUMN,
        META_CAPI_DATASET_ID_COLUMN,
    ]) {
        if (
            result.error &&
            col in payload &&
            isMissingUsersColumnError(result.error, col)
        ) {
            delete (payload as Record<string, unknown>)[col]
            result = await supabase.from('users').insert(payload)
        }
    }

    return result
}

async function updateProfileSettings(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    updateData: Record<string, unknown>
) {
    const payload = { ...updateData }

    let result = await supabase.from('users').update(payload).eq('email', email)

    for (const col of [
        AUTO_ADMIT_COLUMN,
        ONBOARDING_COLUMN,
        LEADS_PIPELINE_STAGES_COLUMN,
        META_CAPI_ACCESS_TOKEN_COLUMN,
        META_CAPI_DATASET_ID_COLUMN,
    ]) {
        if (
            result.error &&
            col in payload &&
            isMissingUsersColumnError(result.error, col)
        ) {
            delete payload[col]
            result = await supabase.from('users').update(payload).eq('email', email)
        }
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
    const {
        username,
        name,
        bio,
        followers,
        following,
        auto_admit,
        onboarding_completed,
        leads_pipeline_stages,
        meta_capi_access_token,
        meta_capi_dataset_id,
    } = body

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
    if (onboarding_completed !== undefined) updateData.onboarding_completed = !!onboarding_completed
    if (leads_pipeline_stages !== undefined) {
        updateData.leads_pipeline_stages = normalizeLeadsPipelineStages(leads_pipeline_stages)
    }
    if (meta_capi_access_token !== undefined) updateData.meta_capi_access_token = meta_capi_access_token || null
    if (meta_capi_dataset_id !== undefined) updateData.meta_capi_dataset_id = meta_capi_dataset_id || null

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
