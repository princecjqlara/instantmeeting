import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

const TESTIMONIAL_FILES: Record<string, string> = {
    'testimonial-1': 'AQNbsvHJHeCcORgQ7mz2h-wa3Uc-24thULsMLnrm-4zG15kjDyx1g76fiTZp7I-Lg_CDGmXJ7bG8Ml_PFjtM6U-mMxxTglSwEnoEqvXMxg.mp4',
    'testimonial-2': 'AQO6vvCmZDTM0OakaFZrqU1GLu8uRQOgIt49Jgh98kbIQrWptL9oI3BT8ZUVvl2aegXz57xEzmJipg81K51VBjxWOt_MlhTiJhUY0pq5qg (2).mp4',
    'testimonial-3': 'AQPdvsBLo3fLEZuWpKMSA4NRZ34M7r0DNDh1B7yF2r6FCXuW7g3xpf4A2jTXpBCcojnkFW3rej3TSO9aAhCRUC5e20SH2qXb7dKop6ANew (1).mp4',
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const fileName = TESTIMONIAL_FILES[slug]

    if (!fileName) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
        const filePath = join(process.cwd(), 'testimonials', fileName)
        const file = await readFile(filePath)

        return new NextResponse(file, {
            headers: {
                'Content-Type': 'video/mp4',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
}
