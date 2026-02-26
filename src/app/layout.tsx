import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Instant Meeting - Waiting Room with Content',
  description: 'Create meetings with engaging waiting rooms. Guests can browse your content while waiting to be admitted.',
  keywords: ['meeting', 'waiting room', 'video', 'video chat', 'webrtc', 'content'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
