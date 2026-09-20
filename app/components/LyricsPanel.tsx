'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/lib/player-store'

const BACKEND = 'http://localhost:8005'

interface LrcLine {
  time: number
  text: string
}

const META_TAGS = ['ti:', 'ar:', 'al:', 'by:', 'offset:', 'length:', 'au:', 'la:']

/** Parse LRC text. Supports [mm:ss], [mm:ss.xx], [mm:ss:xx] and multiple tags per line. */
function parseLrc(lrc: string): { lines: LrcLine[]; synced: boolean } {
  const timed: LrcLine[] = []
  const plain: LrcLine[] = []
  const tagRe = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

  for (const raw of lrc.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const lower = line.toLowerCase()
    if (META_TAGS.some((t) => lower.startsWith(`[${t}`))) continue

    const times: number[] = []
    tagRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(line)) !== null) {
      const mins = parseInt(m[1], 10)
      const secs = parseInt(m[2], 10)
      let frac = 0
      if (m[3] !== undefined) {
        frac = parseInt(m[3], 10) / Math.pow(10, m[3].length)
      }
      if (!isNaN(mins) && !isNaN(secs)) times.push(mins * 60 + secs + frac)
    }

    const text = line.replace(/\[.*?\]/g, '').trim()
    if (!text) continue
    if (times.length > 0) {
      for (const t of times) timed.push({ time: t, text })
    } else {
      plain.push({ time: -1, text })
    }
  }

  if (timed.length > 0) {
    timed.sort((a, b) => a.time - b.time)
    return { lines: timed, synced: true }
  }
  return { lines: plain, synced: false }
}

function cleanQuery(title: string, artist: string): { title: string; artist: string } {
  // "Artist - Song (Official Video)" -> "Song"
  let t = title.replace(/^.+\s-\s(.+)$/, '$1')
  t = t
    .replace(/[\(\[].*?(official|video|audio|lyric|mv|m\/v|clip|hd|4k|remaster|live|cover| slowed|reverb).*?[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  let a = artist.split('|')[0].split(' - ')[0].trim()
  return { title: t || title, artist: a }
}

export default function LyricsPanel() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const progress = usePlayerStore((s) => s.progress)
  const requestSeek = usePlayerStore((s) => s.requestSeek)
  const setProgress = usePlayerStore((s) => s.setProgress)

  const [lines, setLines] = useState<LrcLine[]>([])
  const [synced, setSynced] = useState(false)
  const [currentLine, setCurrentLine] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastUserScroll = useRef(0)
  const trackId = currentTrack?.id

  // Fetch lyrics when the track changes
  useEffect(() => {
    setLines([])
    setSynced(false)
    setCurrentLine(-1)
    setSearched(false)
    if (!currentTrack || currentTrack.source === 'Demo') return

    const { title, artist } = cleanQuery(currentTrack.title, currentTrack.artist)
    const rawTitle = currentTrack.title
    setLoading(true)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    let cancelled = false

    const searches: Array<{ title: string; artist: string }> = [
      { title, artist },
      { title, artist: '' },
      { title: rawTitle, artist: '' },
    ]

    const trySearch = (idx: number) => {
      if (cancelled) return
      if (idx >= searches.length) {
        clearTimeout(timer)
        setLoading(false)
        setSearched(true)
        return
      }
      const q = searches[idx]
      const url =
        `${BACKEND}/lyrics?title=${encodeURIComponent(q.title)}` +
        (q.artist ? `&artist=${encodeURIComponent(q.artist)}` : '')
      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (data.lrc) {
            const parsed = parseLrc(data.lrc)
            if (parsed.lines.length > 0) {
              setLines(parsed.lines)
              setSynced(parsed.synced)
              clearTimeout(timer)
              setLoading(false)
              setSearched(true)
              return
            }
          }
          trySearch(idx + 1)
        })
        .catch(() => trySearch(idx + 1))
    }
    trySearch(0)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId])

  // Find the active line from playback progress
  useEffect(() => {
    if (!synced || lines.length === 0) return
    let idx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (progress >= lines[i].time) {
        idx = i
        break
      }
    }
    setCurrentLine((prev) => (prev === idx ? prev : idx))
  }, [progress, lines, synced])

  // Auto-scroll to the active line (paused briefly after manual scroll)
  useEffect(() => {
    const container = scrollRef.current
    if (!container || currentLine < 0) return
    if (Date.now() - lastUserScroll.current < 5000) return
    const el = container.children[currentLine] as HTMLElement | undefined
    if (!el) return
    container.scrollTop = Math.max(0, el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2)
  }, [currentLine])

  const markUserScroll = useCallback(() => {
    lastUserScroll.current = Date.now()
  }, [])

  const handleLineClick = useCallback(
    (time: number) => {
      requestSeek(time + 0.05)
      setProgress(time)
    },
    [requestSeek, setProgress]
  )

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 shrink-0">
        <svg className="w-3.5 h-3.5 text-sonic-textMuted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-[10px] font-medium tracking-wider uppercase text-sonic-textMuted/50">Lyrics</span>
        {synced && lines.length > 0 && (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#e8c547]/15 text-[#e8c547]">
            SYNCED
          </span>
        )}
        {loading && <span className="text-[9px] text-sonic-textMuted/30 ml-auto">Loading...</span>}
      </div>

      {/* Lines */}
      <div
        ref={scrollRef}
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar mx-4 mb-4 rounded-xl bg-sonic-surface3/50 p-3 border border-sonic-border"
      >
        {/* States */}
        {!currentTrack && (
          <p className="text-xs text-sonic-textMuted/40 text-center py-8">Play a track to see lyrics</p>
        )}
        {currentTrack?.source === 'Demo' && (
          <p className="text-xs text-sonic-textMuted/40 text-center py-8">No lyrics for demo tracks</p>
        )}
        {loading && lines.length === 0 && (
          <div className="space-y-2.5 py-2">
            {[90, 70, 85, 60, 80].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded bg-sonic-textMuted/10 animate-pulse"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}
        {searched && !loading && lines.length === 0 && currentTrack?.source !== 'Demo' && (
          <p className="text-xs text-sonic-textMuted/40 text-center py-8">No lyrics found for this track</p>
        )}

        {/* Synced karaoke lines (click to seek) */}
        {synced &&
          lines.map((line, i) => (
            <button
              key={i}
              onClick={() => handleLineClick(line.time)}
              title={`Jump to ${formatTime(line.time)}`}
              className={`w-full text-left transition-all duration-300 leading-relaxed py-1 px-2 rounded-lg cursor-pointer ${
                i === currentLine
                  ? 'text-[#e8c547] font-semibold text-[15px] bg-[#e8c547]/10 translate-x-1'
                  : i < currentLine
                    ? 'text-sonic-textMuted/30 text-sm hover:text-sonic-textMuted/60'
                    : 'text-sonic-textMuted/70 text-sm hover:text-sonic-textPrimary hover:bg-white/5'
              }`}
            >
              <span className="flex items-baseline gap-2">
                <span className="flex-1">{line.text}</span>
                {i === currentLine && (
                  <span className="text-[9px] tabular-nums text-[#e8c547]/60 shrink-0">
                    {formatTime(line.time)}
                  </span>
                )}
              </span>
            </button>
          ))}

        {/* Plain (non-synced) lyrics */}
        {!synced &&
          lines.map((line, i) => (
            <p key={i} className="text-sm text-sonic-textMuted/70 leading-relaxed py-0.5 px-2">
              {line.text || '\u00A0'}
            </p>
          ))}
      </div>
    </div>
  )
}
