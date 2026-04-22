'use client'

import { openUrlInExternalBrowser } from '@/lib/external-browser-handoff'

export default function GuestExternalBrowserAssist() {
    return (
        <button
            type="button"
            onClick={() => {
                if (typeof window === 'undefined') {
                    return
                }

                openUrlInExternalBrowser(
                    window.location.href,
                    window.location.pathname,
                    window.sessionStorage
                )
            }}
            style={{
                position: 'fixed',
                right: 16,
                bottom: 16,
                zIndex: 1300,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(15,18,32,0.84)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 14px 30px -16px rgba(0,0,0,0.8)',
            }}
        >
            Having trouble? Open in external browser
        </button>
    )
}
