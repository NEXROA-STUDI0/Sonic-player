import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { PlayerProvider } from '@/lib/player-store'
import PlayerBar from '@/app/components/PlayerBar'
import ServiceWorkerRegister from '@/app/components/ServiceWorkerRegister'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sonic — Music Player',
  description: 'Personal music player with smart recommendations and offline playback',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#08090c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="ltr" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <ServiceWorkerRegister />
        <PlayerProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-sonic-base vinyl-noise">
            {children}
          </div>
        </PlayerProvider>
      </body>
    </html>
  )
}
