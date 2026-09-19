'use client'

import { useState, useEffect, useRef } from 'react'
import { usePlayerStore } from '@/lib/player-store'

const BACKEND = 'http://localhost:8005'

interface LrcLine {
  time: number
  text: string
}

function parseLrc(lrc: string): LrcLine[] {
  const lines = lrc.split('\n')
  const result: LrcLine[] = []
  const regex = /\[(\d+):(\d+\.\d+)\](.*)/
  
  for (const line of lines) {
    const match = line.match(regex)
    if (match) {
      const mins = parseInt(match[1])
      const secs = parseFloat(match[2])
      const time = mins * 60 + secs
      const text = match[3].trim()
      if (text) result.push({ time, text })
    }
  }
  
  return result.sort((a, b) => a.time - b.time)
}

export default function LyricsPanel() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const progress = usePlayerStore((s) => s.progress)
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([])
  const [currentLine, setCurrentLine] = useState(-1)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentTrack || currentTrack.source === 'Demo') {
      setLrcLines([])
      return
    }

    let title = currentTrack.title
    let artist = currentTrack.artist
    setLoading(true)
    setLrcLines([])

    // Clean up title: remove common prefixes like "Amr Diab - " 
    title = title.replace(/^.+\s-\s(.+)$/, '$1').trim()
    // Clean YouTube channel names from artist
    if (artist.includes('|') || artist.includes(' - ')) {
      artist = artist.split('|')[0].split(' - ')[0].trim()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)

    // Try multiple search variations
    const searches = [
      `${artist} ${title}`,
      title,
      currentTrack.title,
    ]

    let searchIdx = 0
    const trySearch = () => {
      if (searchIdx >= searches.length) {
        clearTimeout(timer)
        setLoading(false)
        return
      }
      const q = searches[searchIdx++]
      fetch(`${BACKEND}/lyrics?title=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (data.lrc) {
            const parsed = parseLrc(data.lrc)
            setLrcLines(parsed)
            clearTimeout(timer)
            setLoading(false)
          } else {
            trySearch()
          }
        })
        .catch(() => trySearch())
    }
    trySearch()

    return () => { clearTimeout(timer); controller.abort() }
  }, [currentTrack?.id])

  // Update current line based on progress
  useEffect(() => {
    if (lrcLines.length === 0) return
    let idx = -1
    for (let i = lrcLines.length - 1; i >= 0; i--) {
      if (progress >= lrcLines[i].time) {
        idx = i
        break
      }
    }
    setCurrentLine(idx)
  }, [progress, lrcLines])

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLine >= 0 && scrollRef.current) {
      const el = scrollRef.current.children[currentLine] as HTMLElement
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLine])

  if (!currentTrack) return null

  return (
    <div className="w-full px-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-sonic-textMuted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-[10px] font-medium tracking-wider uppercase text-sonic-textMuted/50">Lyrics</span>
        {loading && <span className="text-[9px] text-sonic-textMuted/30 ml-auto">Loading...</span>}
      </div>
      <div
        ref={scrollRef}
        className="h-[180px] overflow-y-auto no-scrollbar space-y-1.5 rounded-xl bg-sonic-surface3/50 p-3 border border-sonic-border"
      >
        {lrcLines.length === 0 && !loading && (
          <p className="text-xs text-sonic-textMuted/40 text-center py-8">No lyrics available</p>
        )}
        {lrcLines.map((line, i) => (
          <p
            key={i}
            className={`text-sm transition-all duration-300 leading-relaxed ${
              i === currentLine
                ? 'text-[#e8c547] font-medium scale-105 translate-x-1'
                : i < currentLine
                ? 'text-sonic-textMuted/30'
                : 'text-sonic-textMuted/70'
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  )
}
