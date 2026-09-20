'use client'

import { useRef, useCallback } from 'react'
import { usePlayerStore } from '@/lib/player-store'

export default function PlayerBar() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const progress = usePlayerStore((s) => s.progress)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const requestSeek = usePlayerStore((s) => s.requestSeek)
  const repeat = usePlayerStore((s) => s.repeat)
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat)
  const isShuffled = usePlayerStore((s) => s.isShuffled)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)

  const progressRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const el = progressRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    requestSeek(Math.max(0, Math.min(duration, x * duration)))
  }, [duration, requestSeek])

  const handleVolumeClick = useCallback((e: React.MouseEvent) => {
    const el = volumeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    setVolume(Math.max(0, Math.min(1, x)))
  }, [setVolume])

  return (
    <div className="h-[64px] md:h-[72px] border-t border-sonic-border bg-sonic-surface1/95 backdrop-blur-xl shrink-0">
      <div className="flex items-center h-full px-2 md:px-4 gap-2 md:gap-4">
        {/* Track Info */}
        <div className="flex-1 min-w-0 md:flex-none md:w-[200px] flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 rounded-lg bg-sonic-surface3 overflow-hidden shrink-0">
            {currentTrack?.source === 'Demo' || !currentTrack ? (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            ) : (
              <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sonic-textPrimary truncate">
              {currentTrack?.title || 'No track'}
            </p>
            <p className="text-xs text-sonic-textMuted truncate">
              {currentTrack?.artist || 'Select something to play'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-none md:flex-1 min-w-0 flex flex-col items-center gap-1 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={toggleShuffle} className={`magnetic hidden md:block ${isShuffled ? 'text-[#e8c547]' : 'text-sonic-textMuted'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </button>
            <button onClick={prev} className="magnetic text-sonic-textMuted hover:text-sonic-textPrimary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[#e8c547] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-sonic-base"
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
            <button onClick={next} className="magnetic text-sonic-textMuted hover:text-sonic-textPrimary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 4l10 8-10 8V4zM17 5v14h2V5h-2z" />
              </svg>
            </button>
            <button onClick={toggleRepeat} className={`magnetic relative hidden md:block ${repeat !== 'off' ? 'text-[#e8c547]' : 'text-sonic-textMuted'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              {repeat === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 w-full">
            <span className="text-[11px] text-sonic-textMuted/60 w-8 text-right tabular-nums">
              {formatTime(progress)}
            </span>
            <div ref={progressRef} className="progress-bar flex-1" onClick={handleProgressClick}>
              <div className="progress-fill" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            </div>
            <span className="text-[11px] text-sonic-textMuted/60 w-8 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Queue */}
        <div className="hidden md:flex w-[200px] items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <button className="text-sonic-textMuted hover:text-sonic-textPrimary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {volume === 0 ? (
                  <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                ) : (
                  <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></>
                )}
              </svg>
            </button>
            <div ref={volumeRef} className="w-20 h-1 rounded-full bg-sonic-border cursor-pointer relative" onClick={handleVolumeClick}>
              <div className="h-full rounded-full bg-sonic-textMuted/50 transition-all" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
          {queue.length > 0 && (
            <button className="text-sonic-textMuted/50 hover:text-sonic-textMuted transition-colors text-xs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
