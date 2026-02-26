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

// POST: Upload welcome audio
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file type (audio or webm recording)
        if (!file.type.startsWith('audio/') && file.type !== 'video/webm') {
            return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 })
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
        }

        // Convert to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload to Cloudinary as video resource type (handles audio)
        const uploadResult = await new Promise<{ secure_url: string; duration: number }>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: 'instant-meeting-welcome-audio',
                    resource_type: 'video', // Cloudinary uses 'video' for audio files
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error)
                        reject(error)
                    } else {
                        resolve(result as unknown as { secure_url: string; duration: number })
                    }
                }
            ).end(buffer)
        })

        // Update user's welcome_audio_url in database
        const { error: updateError } = await supabase
            .from('users')
            .update({ welcome_audio_url: uploadResult.secure_url })
            .eq('email', session.user.email)

        if (updateError) {
            console.error('Database update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({
            welcome_audio_url: uploadResult.secure_url,
            duration: uploadResult.duration
        })
    } catch (error) {
        console.error('Welcome audio upload error:', error)
        return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
    }
}

// DELETE: Remove welcome audio
export async function DELETE() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
        .from('users')
        .update({ welcome_audio_url: null })
        .eq('email', session.user.email)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
