import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

type AssignmentSource = 'system' | 'manual' | 'preassigned' | 'none'

const MEETING_ASSIGNMENT_SOURCE_COLUMN = 'assignment_source'

interface ErrorLike {
    message?: string | null
}

export type TeamAvailabilityReason =
    | 'member_available'
    | 'no_team'
    | 'no_members'
    | 'no_clocked_in'
    | 'all_members_busy'
    | 'lookup_failed'

interface TeamRecord {
    id: string
    round_robin_index: number
}

interface TeamMemberRecord {
    id: string
    name: string
    avatar_url: string | null
    welcome_audio_url: string | null
}

interface TeamAvailabilityResult {
    reason: TeamAvailabilityReason
    team: TeamRecord | null
    nextMember: TeamMemberRecord | null
}

interface MeetingRecord {
    id: string
    user_id: string
    status: string
    google_meet_link: string | null
    assigned_member_id: string | null
    assignment_source?: AssignmentSource | null
}

interface AdmitGuestOptions {
    requireAvailableAssignee?: boolean
}

export class AdmitLogicError extends Error {
    code: 'NO_AVAILABLE_TEAM_MEMBER'
    availabilityReason: TeamAvailabilityReason

    constructor(message: string, availabilityReason: TeamAvailabilityReason) {
        super(message)
        this.name = 'AdmitLogicError'
        this.code = 'NO_AVAILABLE_TEAM_MEMBER'
        this.availabilityReason = availabilityReason
    }
}

export function isNoAvailableTeamMemberError(error: unknown): error is AdmitLogicError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'NO_AVAILABLE_TEAM_MEMBER'
    )
}

function getNoAssigneeMessage(reason: TeamAvailabilityReason) {
    if (reason === 'all_members_busy') {
        return 'All team members are currently in meetings'
    }

    if (reason === 'no_clocked_in') {
        return 'No team members are clocked in right now'
    }

    if (reason === 'no_members' || reason === 'no_team') {
        return 'No active team members are available'
    }

    return 'Unable to verify team availability'
}

function isMissingMeetingsAssignmentSourceColumnError(error: ErrorLike | null | undefined): boolean {
    if (!error?.message) {
        return false
    }

    const message = error.message.toLowerCase()

    const postgresMissingColumn =
        message.includes('does not exist') &&
        (
            message.includes(`meetings.${MEETING_ASSIGNMENT_SOURCE_COLUMN}`) ||
            message.includes(`meetings."${MEETING_ASSIGNMENT_SOURCE_COLUMN}"`)
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes(`'${MEETING_ASSIGNMENT_SOURCE_COLUMN}'`) &&
        message.includes("column of 'meetings'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}

function meetingSelect(includeAssignmentSource: boolean) {
    const baseColumns = 'id, user_id, status, google_meet_link, assigned_member_id'

    if (!includeAssignmentSource) {
        return baseColumns
    }

    return `${baseColumns}, ${MEETING_ASSIGNMENT_SOURCE_COLUMN}`
}

async function fetchMeetingById(
    supabase: ReturnType<typeof getSupabaseClient>,
    meetingId: string,
    includeAssignmentSource = true
): Promise<{ data: MeetingRecord | null; error: ErrorLike | null }> {
    const queryResult = await supabase
        .from('meetings')
        .select(meetingSelect(includeAssignmentSource))
        .eq('id', meetingId)
        .single()

    if (
        includeAssignmentSource &&
        isMissingMeetingsAssignmentSourceColumnError(queryResult.error)
    ) {
        return fetchMeetingById(supabase, meetingId, false)
    }

    return {
        data: queryResult.data as MeetingRecord | null,
        error: queryResult.error ? { message: queryResult.error.message } : null,
    }
}

async function updateMeetingAssignment(
    supabase: ReturnType<typeof getSupabaseClient>,
    meetingId: string,
    assignedMemberId: string,
    assignmentSource: AssignmentSource
) {
    let result = await supabase
        .from('meetings')
        .update({
            assigned_member_id: assignedMemberId,
            assignment_source: assignmentSource,
        })
        .eq('id', meetingId)

    if (isMissingMeetingsAssignmentSourceColumnError(result.error)) {
        result = await supabase
            .from('meetings')
            .update({
                assigned_member_id: assignedMemberId,
            })
            .eq('id', meetingId)
    }

    if (result.error) {
        console.error('Meeting assignment update error:', result.error)
    }
}

async function getTeamAvailability(
    supabase: ReturnType<typeof getSupabaseClient>,
    hostUserId: string,
    excludeMeetingId?: string
): Promise<TeamAvailabilityResult> {
    const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, round_robin_index')
        .eq('owner_id', hostUserId)
        .maybeSingle()

    if (teamError) {
        console.error('Team lookup error:', teamError)
        return { reason: 'lookup_failed', team: null, nextMember: null }
    }

    if (!team) {
        return { reason: 'no_team', team: null, nextMember: null }
    }

    const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, name, avatar_url, welcome_audio_url')
        .eq('team_id', team.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

    if (membersError) {
        console.error('Team member lookup error:', membersError)
        return { reason: 'lookup_failed', team, nextMember: null }
    }

    if (!members || members.length === 0) {
        return { reason: 'no_members', team, nextMember: null }
    }

    const memberIds = members.map(member => member.id)
    const { data: clockSessions, error: clockError } = await supabase
        .from('clock_sessions')
        .select('member_id')
        .in('member_id', memberIds)
        .is('clocked_out_at', null)

    if (clockError) {
        console.error('Clock session lookup error:', clockError)
        return { reason: 'lookup_failed', team, nextMember: null }
    }

    const clockedInIds = new Set((clockSessions || []).map(session => session.member_id))
    const clockedInMembers = members.filter(member => clockedInIds.has(member.id))

    if (clockedInMembers.length === 0) {
        return { reason: 'no_clocked_in', team, nextMember: null }
    }

    let busyMeetingsQuery = supabase
        .from('meetings')
        .select('assigned_member_id')
        .eq('user_id', hostUserId)
        .in('status', ['pending', 'active'])
        .not('assigned_member_id', 'is', null)

    if (excludeMeetingId) {
        busyMeetingsQuery = busyMeetingsQuery.neq('id', excludeMeetingId)
    }

    const { data: busyMeetings, error: busyError } = await busyMeetingsQuery

    if (busyError) {
        console.error('Busy meeting lookup error:', busyError)
        return { reason: 'lookup_failed', team, nextMember: null }
    }

    const busyMemberIds = new Set(
        (busyMeetings || [])
            .map(meeting => meeting.assigned_member_id as string | null)
            .filter((memberId): memberId is string => Boolean(memberId))
    )

    const availableMembers = clockedInMembers.filter(member => !busyMemberIds.has(member.id))

    if (availableMembers.length === 0) {
        return { reason: 'all_members_busy', team, nextMember: null }
    }

    const index = team.round_robin_index % availableMembers.length

    return {
        reason: 'member_available',
        team,
        nextMember: availableMembers[index],
    }
}

export async function getAutoAssignableMember(hostUserId: string, excludeMeetingId?: string) {
    const supabase = getSupabaseClient()
    return getTeamAvailability(supabase, hostUserId, excludeMeetingId)
}

async function getAssignedMemberById(
    supabase: ReturnType<typeof getSupabaseClient>,
    memberId: string
) {
    const { data: member, error } = await supabase
        .from('team_members')
        .select('id, name, avatar_url, welcome_audio_url')
        .eq('id', memberId)
        .maybeSingle()

    if (error) {
        console.error('Assigned member lookup error:', error)
        return null
    }

    return member
}

export async function admitGuestLogic(
    meetingId: string,
    guestId: string,
    options: AdmitGuestOptions = {}
) {
    const supabase = getSupabaseClient()

    const { data: meeting, error: meetingError } = await fetchMeetingById(
        supabase,
        meetingId
    )

    if (meetingError || !meeting) {
        throw new Error('Meeting not found')
    }

    if (meeting.status === 'completed') {
        throw new Error('Meeting has ended')
    }

    const roomLink = `/room/${meetingId}`

    if (meeting.status === 'pending') {
        await supabase
            .from('meetings')
            .update({
                status: 'active',
                google_meet_link: roomLink,
            })
            .eq('id', meetingId)
    } else if (!meeting.google_meet_link) {
        await supabase
            .from('meetings')
            .update({ google_meet_link: roomLink })
            .eq('id', meetingId)
    }

    const { data: guest, error: guestError } = await supabase
        .from('waiting_guests')
        .select('*')
        .eq('id', guestId)
        .eq('meeting_id', meetingId)
        .maybeSingle()

    if (guestError || !guest) {
        throw new Error('Guest not found')
    }

    let assignedMember: TeamMemberRecord | null = null
    let assignmentSource: AssignmentSource = 'none'
    let selectedTeam: TeamRecord | null = null

    if (meeting.assigned_member_id) {
        assignedMember = await getAssignedMemberById(supabase, meeting.assigned_member_id)
        if (assignedMember) {
            assignmentSource = meeting.assignment_source || 'preassigned'
        }
    }

    if (!assignedMember) {
        const availability = await getTeamAvailability(supabase, meeting.user_id, meetingId)

        if (availability.nextMember) {
            assignedMember = availability.nextMember
            assignmentSource = 'system'
            selectedTeam = availability.team
        } else if (options.requireAvailableAssignee) {
            // Solo hosts (no team / no members) should still auto-admit.
            // Only block admission when a team exists but no one is available.
            const blockingReasons: TeamAvailabilityReason[] = [
                'no_clocked_in',
                'all_members_busy',
                'lookup_failed',
            ]
            if (blockingReasons.includes(availability.reason)) {
                throw new AdmitLogicError(
                    getNoAssigneeMessage(availability.reason),
                    availability.reason
                )
            }
            // 'no_team' / 'no_members' — host works solo, proceed without assignee
        }
    }

    if (guest.status === 'admitted') {
        return {
            guest,
            meet_link: roomLink,
            join_token: guest.join_token || null,
            assigned_member: assignedMember,
            assignment_source: assignmentSource,
        }
    }

    const joinToken = randomUUID()
    const { data: admittedGuest, error: updateError } = await supabase
        .from('waiting_guests')
        .update({
            status: 'admitted',
            admitted_at: new Date().toISOString(),
            join_token: joinToken,
        })
        .eq('id', guestId)
        .select()
        .single()

    if (updateError) {
        throw new Error(updateError.message)
    }

    if (assignedMember && meeting.assigned_member_id !== assignedMember.id) {
        await updateMeetingAssignment(
            supabase,
            meetingId,
            assignedMember.id,
            assignmentSource
        )
    }

    if (assignmentSource === 'system' && selectedTeam) {
        await supabase
            .from('teams')
            .update({ round_robin_index: selectedTeam.round_robin_index + 1 })
            .eq('id', selectedTeam.id)
    }

    return {
        guest: admittedGuest,
        meet_link: roomLink,
        join_token: joinToken,
        assigned_member: assignedMember,
        assignment_source: assignmentSource,
    }
}
