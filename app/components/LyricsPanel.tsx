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

function cleanQuery(title: string, artist: string): { title: string; firstSeg: string; artist: string } {
  const segs = title.split(/\s-\s/).map((s) => s.trim()).filter(Boolean)
  // Last segment: "Artist - Song" format; first segment: "Song - details" (common in Arabic titles)
  const lastSeg = segs.length > 1 ? segs[segs.length - 1] : title
  const firstSeg = segs.length > 1 ? segs[0] : title
  const strip = (s: string) =>
    s
      .replace(/[\(\[].*?(official|video|audio|lyric|mv|m\/v|clip|hd|4k|remaster|live|cover| slowed|reverb|توزيع|كلمات|الحان).*?[\)\]]/gi, '')
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  // Clean YouTube channel names from artist
  const a = artist.split('|')[0].split(' - ')[0].trim()
  const cleanLast = strip(lastSeg) || title
  const cleanFirst = strip(firstSeg) || title
  return { title: cleanLast, firstSeg: cleanFirst, artist: a }
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
  const [capLoading, setCapLoading] = useState(false)
  /** Manual sync correction in seconds, saved per video */
  const [offset, setOffset] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastUserScroll = useRef(0)
  const trackId = currentTrack?.id

  const offsetKey = currentTrack?.videoId ? `sonic_lyrics_offset_${currentTrack.videoId}` : null

  // Load saved sync correction for this track
  useEffect(() => {
    if (!offsetKey) {
      setOffset(0)
      return
    }
    try {
      const v = parseFloat(localStorage.getItem(offsetKey) || '0')
      setOffset(isNaN(v) ? 0 : v)
    } catch {
      setOffset(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId])

  const changeOffset = useCallback(
    (d: number) => {
      setOffset((prev) => {
        const next = Math.round((prev + d) * 10) / 10
        try {
          if (offsetKey) localStorage.setItem(offsetKey, String(next))
        } catch {}
        return next
      })
    },
    [offsetKey]
  )

  const resetOffset = useCallback(() => {
    setOffset(0)
    try {
      if (offsetKey) localStorage.removeItem(offsetKey)
    } catch {}
  }, [offsetKey])

  // Fetch lyrics when the track changes
  useEffect(() => {
    setLines([])
    setSynced(false)
    setCurrentLine(-1)
    setSearched(false)
    setCapLoading(false)
    if (!currentTrack || currentTrack.source === 'Demo') return

    const { title, artist, firstSeg } = cleanQuery(currentTrack.title, currentTrack.artist)
    const rawTitle = currentTrack.title
    setLoading(true)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    let cancelled = false

    // Try multiple search variations (deduplicated)
    const seen = new Set<string>()
    const searches: Array<{ title: string; artist: string }> = []
    for (const q of [
      { title, artist },
      { title: firstSeg, artist },
      { title, artist: '' },
      { title: rawTitle, artist: '' },
    ]) {
      const key = `${q.title}|||${q.artist}`.toLowerCase()
      if (q.title && !seen.has(key)) {
        seen.add(key)
        searches.push(q)
      }
    }

    const finishEmpty = () => {
      clearTimeout(timer)
      setLoading(false)
      setCapLoading(false)
      setSearched(true)
    }

    const finishFound = (parsed: { lines: LrcLine[]; synced: boolean }) => {
      setLines(parsed.lines)
      setSynced(parsed.synced)
      finishEmpty()
    }

    // Last resort: video subtitles (YouTube captions) converted to synced lyrics.
    // Works even for songs missing from every lyrics database.
    const tryCaptions = () => {
      const vid = currentTrack?.videoId
      if (!vid) {
        finishEmpty()
        return
      }
      clearTimeout(timer)
      setCapLoading(true)
      const capTimer = setTimeout(() => controller.abort(), 100000)
      fetch(`${BACKEND}/captions?videoId=${encodeURIComponent(vid)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          clearTimeout(capTimer)
          if (data.lrc) {
            const parsed = parseLrc(data.lrc)
            if (parsed.lines.length > 0) {
              finishFound(parsed)
              return
            }
          }
          finishEmpty()
        })
        .catch(() => {
          if (!cancelled) {
            clearTimeout(capTimer)
            finishEmpty()
          }
        })
    }

    const trySearch = (idx: number) => {
      if (cancelled) return
      if (idx >= searches.length) {
        tryCaptions()
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
              finishFound(parsed)
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

  // Find the active line from playback progress (+ manual sync correction)
  useEffect(() => {
    if (!synced || lines.length === 0) return
    const t = progress + offset
    let idx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (t >= lines[i].time) {
        idx = i
        break
      }
    }
    setCurrentLine((prev) => (prev === idx ? prev : idx))
  }, [progress, lines, synced, offset])

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
        {loading && !capLoading && <span className="text-[9px] text-sonic-textMuted/30 ml-auto">Loading...</span>}
        {capLoading && <span className="text-[9px] text-sonic-textMuted/30 ml-auto">Fetching video subtitles...</span>}
      </div>

      {/* Sync correction (per-track, saved) */}
      {synced && lines.length > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2 shrink-0">
          <button
            onClick={() => changeOffset(-0.5)}
            title="Lyrics earlier (-0.5s)"
            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-sonic-surface3/60 border border-sonic-border text-sonic-textMuted hover:text-sonic-textPrimary active:scale-95 transition-all"
          >
            −0.5s
          </button>
          <span
            title="Current sync correction for this song"
            className={`text-[10px] tabular-nums min-w-[44px] text-center ${offset !== 0 ? 'text-[#e8c547]' : 'text-sonic-textMuted/40'}`}
          >
            {offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`}
          </span>
          <button
            onClick={() => changeOffset(0.5)}
            title="Lyrics later (+0.5s)"
            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-sonic-surface3/60 border border-sonic-border text-sonic-textMuted hover:text-sonic-textPrimary active:scale-95 transition-all"
          >
            +0.5s
          </button>
          {offset !== 0 && (
            <button
              onClick={resetOffset}
              title="Reset sync correction"
              className="text-[10px] text-sonic-textMuted/40 hover:text-sonic-textMuted underline underline-offset-2"
            >
              reset
            </button>
          )}
        </div>
      )}

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
