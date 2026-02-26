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

// POST: Upload avatar image
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    console.log('=== AVATAR UPLOAD === Starting upload process')
    console.log('Session email:', session?.user?.email)
    console.log('Cloudinary config:', {
        cloud_name: (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME) ? 'SET' : 'NOT SET',
        api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
        api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
    })

    if (!session?.user?.email) {
        console.log('ERROR: No session email')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        console.log('File received:', file?.name, 'Type:', file?.type, 'Size:', file?.size)

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
        }

        // Convert to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        console.log('Uploading to Cloudinary...')

        // Upload to Cloudinary
        const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: 'instant-meeting-avatars',
                    transformation: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error)
                        reject(error)
                    } else {
                        const uploadedUrl = result?.secure_url
                        if (!uploadedUrl) {
                            reject(new Error('Cloudinary upload did not return a secure URL'))
                            return
                        }

                        console.log('Cloudinary upload success:', uploadedUrl)
                        resolve({ secure_url: uploadedUrl })
                    }
                }
            ).end(buffer)
        })

        console.log('Updating database with avatar_url:', uploadResult.secure_url)

        // Update user's avatar_url in database
        const { error: updateError } = await supabase
            .from('users')
            .upsert({
                email: session.user.email,
                avatar_url: uploadResult.secure_url,
            }, { onConflict: 'email' })
            .select()

        if (updateError) {
            console.error('Database update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        console.log('Avatar upload complete!')
        return NextResponse.json({ avatar_url: uploadResult.secure_url })

    } catch (error) {
        console.error('Avatar upload error:', error)
        return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
    }
}
