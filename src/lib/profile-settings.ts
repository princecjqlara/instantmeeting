import { DEFAULT_LEADS_PIPELINE_STAGES, normalizeLeadsPipelineStages } from './lead-pipeline.ts'

export type AvailabilityMode = 'always' | 'never' | 'scheduled'

export interface ProfileSettingsRecord {
    username: string | null
    name: string | null
    bio: string | null
    avatar_url: string | null
    availability_mode: AvailabilityMode | null
    auto_admit: boolean | null
    available_from: string | null
    available_to: string | null
    timezone: string | null
    scroll_threshold: number | null
    meeting_duration: number | null
    followers: number | null
    following: number | null
    welcome_audio_url: string | null
    onboarding_completed: boolean | null
    leads_pipeline_stages?: string[] | null
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
}

export interface ProfileSettingsResponse {
    username: string
    name: string
    bio: string
    avatar_url: string | null
    availability_mode: AvailabilityMode
    auto_admit: boolean
    available_from: string | null
    available_to: string | null
    timezone: string
    scroll_threshold: number
    meeting_duration: number
    followers: number
    following: number
    welcome_audio_url: string | null
    onboarding_completed: boolean
    leads_pipeline_stages: string[]
    meta_capi_access_token: string
    meta_capi_dataset_id: string
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettingsResponse = {
    username: '',
    name: '',
    bio: '',
    avatar_url: null,
    availability_mode: 'always',
    auto_admit: false,
    available_from: null,
    available_to: null,
    timezone: 'UTC',
    scroll_threshold: 3,
    meeting_duration: 30,
    followers: 0,
    following: 0,
    welcome_audio_url: null,
    onboarding_completed: false,
    leads_pipeline_stages: [...DEFAULT_LEADS_PIPELINE_STAGES],
    meta_capi_access_token: '',
    meta_capi_dataset_id: '',
}

interface NormalizeOptions {
    fallbackName?: string | null
    fallbackTimezone?: string | null
}

export function normalizeProfileSettings(
    user: Partial<ProfileSettingsRecord> | null | undefined,
    options: NormalizeOptions = {}
): ProfileSettingsResponse {
    const fallbackName = options.fallbackName?.trim() ?? DEFAULT_PROFILE_SETTINGS.name
    const fallbackTimezone = options.fallbackTimezone?.trim() ?? DEFAULT_PROFILE_SETTINGS.timezone

    if (!user) {
        return {
            ...DEFAULT_PROFILE_SETTINGS,
            name: fallbackName,
            timezone: fallbackTimezone,
        }
    }

    return {
        username: user.username ?? DEFAULT_PROFILE_SETTINGS.username,
        name: user.name ?? fallbackName,
        bio: user.bio ?? DEFAULT_PROFILE_SETTINGS.bio,
        avatar_url: user.avatar_url ?? DEFAULT_PROFILE_SETTINGS.avatar_url,
        availability_mode: user.availability_mode ?? DEFAULT_PROFILE_SETTINGS.availability_mode,
        auto_admit: user.auto_admit ?? DEFAULT_PROFILE_SETTINGS.auto_admit,
        available_from: user.available_from ?? DEFAULT_PROFILE_SETTINGS.available_from,
        available_to: user.available_to ?? DEFAULT_PROFILE_SETTINGS.available_to,
        timezone: user.timezone ?? fallbackTimezone,
        scroll_threshold: user.scroll_threshold ?? DEFAULT_PROFILE_SETTINGS.scroll_threshold,
        meeting_duration: user.meeting_duration ?? DEFAULT_PROFILE_SETTINGS.meeting_duration,
        followers: user.followers ?? DEFAULT_PROFILE_SETTINGS.followers,
        following: user.following ?? DEFAULT_PROFILE_SETTINGS.following,
        welcome_audio_url: user.welcome_audio_url ?? DEFAULT_PROFILE_SETTINGS.welcome_audio_url,
        onboarding_completed: user.onboarding_completed ?? DEFAULT_PROFILE_SETTINGS.onboarding_completed,
        leads_pipeline_stages: normalizeLeadsPipelineStages(user.leads_pipeline_stages),
        meta_capi_access_token:
            typeof user.meta_capi_access_token === 'string'
                ? user.meta_capi_access_token.trim()
                : DEFAULT_PROFILE_SETTINGS.meta_capi_access_token,
        meta_capi_dataset_id:
            typeof user.meta_capi_dataset_id === 'string'
                ? user.meta_capi_dataset_id.trim()
                : DEFAULT_PROFILE_SETTINGS.meta_capi_dataset_id,
    }
}
