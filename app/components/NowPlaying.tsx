'use client'

import { useState, useEffect, useRef } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import Visualizer from './Visualizer'
import LyricsPanel from './LyricsPanel'

export default function NowPlaying() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isLoading = usePlayerStore((s) => s.isLoading)
  const playbackError = usePlayerStore((s) => s.playbackError)
  const videoMode = usePlayerStore((s) => s.videoMode)
  const toggleVideoMode = usePlayerStore((s) => s.toggleVideoMode)
  const cycleVisualizer = usePlayerStore((s) => s.cycleVisualizer)
  const visualizerType = usePlayerStore((s) => s.visualizerType)
  const [videoLoading, setVideoLoading] = useState(false)
  const [tab, setTab] = useState<'player' | 'lyrics'>('player')

  // The iframe is the source of truth for video playback; no redundant yt-dlp request is needed.
  useEffect(() => {
    setVideoLoading(videoMode && !!currentTrack?.videoId)
  }, [videoMode, currentTrack?.id])

  // ── خلفية جزيئات مكبرة مع connection lines ──
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const PARTICLE_COUNT = 120
    const particles: {x: number; y: number; vx: number; vy: number; size: number; alpha: number; pulse: number}[] = []
    let anim: number

    const resize = () => {
      canvas.width = canvas.clientWidth * 2
      canvas.height = canvas.clientHeight * 2
    }
    resize()
    window.addEventListener('resize', resize)

    // Mouse tracking
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) * 2,
        y: (e.clientY - rect.top) * 2,
      }
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }
    canvas.addEventListener('mousemove', handleMouse)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // Init particles — أكبر بكتير
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 4 + 1.5,
        alpha: Math.random() * 0.6 + 0.15,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    const draw = () => {
      const w = canvas!.width
      const h = canvas!.height
      ctx!.clearRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Update + draw particles
      for (const p of particles) {
        // Mouse interaction — تهرب شوية من الماوس
        if (mx > 0 && my > 0) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200 && dist > 0) {
            const force = (200 - dist) / 200 * 2
            p.vx += (dx / dist) * force * 0.05
            p.vy += (dy / dist) * force * 0.05
          }
        }

        p.x += p.vx
        p.y += p.vy

        // Damping — حركة طبيعية أكتر
        if (isPlaying) {
          p.vx += (Math.random() - 0.5) * 0.08
          p.vy += (Math.random() - 0.5) * 0.08
          p.vx *= 0.98
          p.vy *= 0.98
        }

        // Bounce off walls
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        // Draw particle
        p.pulse += 0.02
        const pulseFactor = 0.7 + Math.sin(p.pulse) * 0.3
        const currentAlpha = isPlaying ? p.alpha * (0.5 + Math.sin(p.pulse) * 0.2) : p.alpha * 0.25
        const currentSize = p.size * pulseFactor * (isPlaying ? 1.2 : 0.8)

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, currentSize, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(232, 197, 71, ${currentAlpha})`
        ctx!.shadowColor = `rgba(232, 197, 71, ${currentAlpha * 0.3})`
        ctx!.shadowBlur = 8
        ctx!.fill()
        ctx!.shadowBlur = 0

        // Glow ring حول الجزيئات الكبيرة
        if (currentSize > 3) {
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, currentSize * 2.5, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(232, 197, 71, ${currentAlpha * 0.08})`
          ctx!.fill()
        }
      }

      // Connection lines — بين الجزيئات القريبة
      if (isPlaying) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j += 3) { // skip some for perf
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 200) {
              const alpha = (1 - dist / 200) * 0.12
              ctx!.beginPath()
              ctx!.moveTo(particles[i].x, particles[i].y)
              ctx!.lineTo(particles[j].x, particles[j].y)
              ctx!.strokeStyle = `rgba(232, 197, 71, ${alpha})`
              ctx!.lineWidth = 0.5
              ctx!.stroke()
            }
          }
        }
      }

      // Connection to mouse
      if (mx > 0 && my > 0) {
        for (const p of particles) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 250) {
            const alpha = (1 - dist / 250) * 0.2
            ctx!.beginPath()
            ctx!.moveTo(p.x, p.y)
            ctx!.lineTo(mx, my)
            ctx!.strokeStyle = `rgba(232, 197, 71, ${alpha})`
            ctx!.lineWidth = 0.8
            ctx!.stroke()
          }
        }
      }

      anim = requestAnimationFrame(draw)
    }
    anim = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouse)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(anim)
    }
  }, [isPlaying])

  return (
    <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Player / Lyrics tabs */}
      <div className="relative z-10 shrink-0 flex items-center justify-center gap-1 px-6 pt-4">
        <div className="flex items-center gap-1 p-1 rounded-full bg-sonic-surface3/60 border border-sonic-border">
          <button
            onClick={() => setTab('player')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              tab === 'player'
                ? 'bg-[#e8c547] text-sonic-base'
                : 'text-sonic-textMuted hover:text-sonic-textPrimary'
            }`}
          >
            Now Playing
          </button>
          <button
            onClick={() => setTab('lyrics')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              tab === 'lyrics'
                ? 'bg-[#e8c547] text-sonic-base'
                : 'text-sonic-textMuted hover:text-sonic-textPrimary'
            }`}
          >
            Lyrics
          </button>
        </div>
      </div>

      {tab === 'lyrics' ? (
        <div className="flex-1 min-h-0 relative z-10 flex flex-col">
          <LyricsPanel />
        </div>
      ) : (
      <div className="flex flex-col items-center flex-1 px-6 py-6 overflow-y-auto relative z-10 no-scrollbar">
        {currentTrack ? (
          <>
            {/* Album Art / Video Player — بقى أكبر */}
            <div className="w-[300px] h-[300px] rounded-2xl overflow-hidden mb-6 shadow-2xl relative shrink-0 group">
              {/* Animated border ring when playing */}
              {isPlaying && !videoMode && (
                <div className="absolute -inset-1.5 rounded-[20px] bg-gradient-to-r from-[#e8c547]/0 via-[#e8c547]/30 to-[#e8c547]/0 animate-rotate-slow z-0" />
              )}
              {videoMode && currentTrack.videoId ? (
                <div className="w-full h-full bg-black relative">
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-[#e8c547]/30 border-t-[#e8c547] rounded-full animate-spin" />
                    </div>
                  )}
                  <iframe
                    src={`https://www.youtube.com/embed/${currentTrack.videoId}?autoplay=1&controls=1&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
                    onLoad={() => setVideoLoading(false)}
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className={`w-full h-full bg-gradient-to-br from-sonic-surface3 to-sonic-base flex items-center justify-center relative ${isPlaying ? 'animate-float' : ''}`}>
                  {currentTrack.source === 'YouTube' && currentTrack.videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${currentTrack.videoId}/hqdefault.jpg`}
                      alt={currentTrack.title}
                      className={`w-full h-full object-cover ${isPlaying ? 'scale-110 duration-[8s]' : 'scale-100 duration-500'} transition-transform`}
                    />
                  ) : currentTrack.cover && currentTrack.cover !== '/placeholder.svg' ? (
                    <img src={currentTrack.cover} alt="" className={`w-full h-full object-cover ${isPlaying ? 'scale-110 duration-[8s]' : 'scale-100 duration-500'} transition-transform`} />
                  ) : (
                    <div className="flex flex-col items-center">
                      <svg className="w-24 h-24 text-[#e8c547]/40 animate-rotate-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {isPlaying && (
                        <div className="flex items-center gap-[3px] mt-4">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="w-[3px] bg-[#e8c547] rounded-full animate-wave" style={{height: `${14 + i * 8}px`, animationDelay: `${i * 0.15}s`}} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              )}
            </div>

            {/* Video Toggle Button */}
            {currentTrack.videoId && (
              <button
                onClick={toggleVideoMode}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4 transition-all ${
                  videoMode ? 'bg-[#e8c547] text-sonic-base' : 'bg-sonic-surface3 text-sonic-textMuted hover:text-sonic-textPrimary border border-sonic-border'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {videoMode ? (
                    <><polygon points="5 3 19 12 5 21 5 3" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>
                  ) : (
                    <polygon points="23 7 16 12 23 17 23 7" />
                  )}
                </svg>
                {videoMode ? '🎵 Audio Mode' : '🎬 Watch Video'}
              </button>
            )}

            {/* Title & Artist */}
            <div className="text-center mb-4 w-full max-w-sm">
              <h2 className="font-display text-xl font-bold text-sonic-textPrimary truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sonic-textMuted text-sm truncate mt-0.5">{currentTrack.artist}</p>
              {isLoading && !playbackError && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e8c547] animate-wave" style={{animationDelay: '0s'}} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e8c547] animate-wave" style={{animationDelay: '0.2s'}} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e8c547] animate-wave" style={{animationDelay: '0.4s'}} />
                  <span className="text-[10px] text-sonic-textMuted/50 ml-1.5">Loading stream...</span>
                </div>
              )}
              {playbackError && (
                <p className="text-[10px] text-red-300/80 mt-2 max-w-xs" role="status">
                  {playbackError}
                </p>
              )}
            </div>

            {/* Visualizer — مكبرة أوي */}
            {!videoMode && (
              <div className="w-full max-w-lg flex-1 mb-0 px-2" style={{ minHeight: '340px' }}>
                <div className="relative w-full h-full rounded-xl overflow-hidden border border-sonic-border/20 shadow-2xl flex flex-col">
                  <div className="flex-1 min-h-0 relative">
                    <Visualizer height={500} />
                  </div>
                  {/* الختم الأسود */}
                  <div className="relative h-[42px] bg-black shrink-0 border-t-2 border-[#e8c547]/10 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 11px)`
                    }} />
                    <div className="absolute inset-x-[8px] top-[4px] bottom-[4px] border border-dashed border-[#e8c547]/15 rounded-[2px]" />
                    <div className="relative flex items-center gap-2">
                      <svg className="w-3 h-3 text-[#e8c547]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M20 21a8 8 0 10-16 0" />
                      </svg>
                      <span className="text-[10px] tracking-[0.2em] uppercase font-display text-[#e8c547]/40 font-bold select-none">
                        NEXORA
                      </span>
                      <svg className="w-3 h-3 text-[#e8c547]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <button
                      onClick={cycleVisualizer}
                      className="absolute bottom-1 right-2 flex items-center gap-1"
                    >
                      <div className="flex gap-0.5">
                        {(['bars', 'wave', 'circle', 'fire', 'aurora', 'plasma', 'rings'] as const).map(t => (
                          <div
                            key={t}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${visualizerType === t ? 'bg-[#e8c547] scale-125' : 'bg-[#e8c547]/20'}`}
                            title={t}
                          />
                        ))}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-20 h-20 text-sonic-textMuted/15 mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
            <p className="text-sonic-textMuted/30 text-sm font-display">Select a track to play</p>
            <p className="text-sonic-textMuted/15 text-[10px] mt-1">Search or browse your library</p>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
