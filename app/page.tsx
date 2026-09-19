'use client'

import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import HomeView from './components/HomeView'
import SearchView from './components/SearchView'
import LibraryView from './components/LibraryView'
import NowPlaying from './components/NowPlaying'
import PlayerBar from './components/PlayerBar'
import AudioEngine from './components/AudioEngine'
import SettingsPanel from './components/SettingsPanel'
import PlaylistPanel from './components/PlaylistPanel'
import NetworkStatus from './components/NetworkStatus'
import SplashScreen from './components/SplashScreen'

export default function Home() {
  const [showSplash, setShowSplash] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if we've shown splash this session
    if (typeof window !== 'undefined') {
      const seen = sessionStorage.getItem('sonic_splash_seen')
      if (seen) setShowSplash(false)
    }
  }, [])

  const [view, setView] = useState<'home' | 'search' | 'library'>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  // SSR guard — don't render anything splash-related until mounted
  if (!mounted) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-sonic-base" />
    )
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />
  }

  return (
    <>
      <NetworkStatus />
      <AudioEngine />
      <Sidebar
        onOpenSettings={() => setSettingsOpen(true)}
        onViewChange={(v) => setView(v)}
        onOpenLibrary={() => setLibraryOpen(true)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex overflow-hidden">
          <div id="main-view" className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0">
            {view === 'home' && <HomeView />}
            {view === 'search' && <SearchView />}
            {view === 'library' && <LibraryView />}
          </div>
          <div className="hidden md:flex w-[400px] border-l border-sonic-border flex-col">
            <NowPlaying />
          </div>
        </div>
        <PlayerBar />
      </main>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PlaylistPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </>
  )
}
