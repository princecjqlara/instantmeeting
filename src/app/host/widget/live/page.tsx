'use client'

import WidgetVisitorsPanel from '@/components/WidgetVisitorsPanel'

export default function LiveEngagePage() {
    return (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px', color: '#e8e8ee', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>👁 Live Visitors</h1>
            <p style={{ color: '#888', fontSize: 13, marginTop: 0 }}>
                Visitors active on your website right now (refreshes every 5s).
            </p>

            <WidgetVisitorsPanel variant="page" />
        </div>
    )
}
