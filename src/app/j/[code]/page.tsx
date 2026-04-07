import { redirect } from 'next/navigation'
import { consumeJoinToken } from '@/lib/join-tokens'
import InAppBrowserGate from '@/components/InAppBrowserGate'

interface Props {
    params: Promise<{ code: string }>
}

export default async function JoinByCodePage({ params }: Props) {
    const { code } = await params
    const token = await consumeJoinToken(code)

    if (!token) {
        return (
            <InAppBrowserGate>
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
                    <div style={{ textAlign: 'center', maxWidth: 400 }}>
                        <h1 style={{ fontSize: 22 }}>This invite has expired</h1>
                        <p style={{ color: '#888' }}>Ask the host for a new link.</p>
                    </div>
                </div>
            </InAppBrowserGate>
        )
    }

    redirect(`/room/${token.meeting_id}?from=widget`)
}
