import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'

export const dynamic = 'force-dynamic'

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST: Upload welcome audio for a specific team member
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    // Verify user owns the team
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const memberId = formData.get('member_id') as string

        if (!file || !memberId) {
            return NextResponse.json({ error: 'File and member_id are required' }, { status: 400 })
        }

        // Verify the member belongs to this user's team
        const { data: team } = await supabase
            .from('teams')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (!team) {
            return NextResponse.json({ error: 'No team found' }, { status: 404 })
        }

        const { data: member } = await supabase
            .from('team_members')
            .select('id')
            .eq('id', memberId)
            .eq('team_id', team.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'Member not found in your team' }, { status: 404 })
        }

        // Validate file type
        if (!file.type.startsWith('audio/') && file.type !== 'video/webm') {
            return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 })
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: 'instant-meeting-member-audio',
                    resource_type: 'video',
                },
                (error, result) => {
                    if (error) reject(error)
                    else resolve(result as unknown as { secure_url: string })
                }
            ).end(buffer)
        })

        await supabase
            .from('team_members')
            .update({ welcome_audio_url: uploadResult.secure_url })
            .eq('id', memberId)

        return NextResponse.json({ welcome_audio_url: uploadResult.secure_url })
    } catch (error) {
        console.error('Member audio upload error:', error)
        return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
    }
}

// DELETE: Remove welcome audio from a team member
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { member_id } = body

    const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!team) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    await supabase
        .from('team_members')
        .update({ welcome_audio_url: null })
        .eq('id', member_id)
        .eq('team_id', team.id)

    return NextResponse.json({ success: true })
}
