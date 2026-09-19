'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { searchAll, searchYouTubePlaylists, getUploaderTracks } from '@/lib/api'
import type { YouTubePlaylist } from '@/lib/api'
import { toggleLike, isLiked, saveSearchQuery, getSearchCache, downloadToFolder, getPlaylists, addToPlaylist } from '@/lib/storage'
import type { Playlist } from '@/lib/storage'
import { preloadSearchResults } from '@/lib/preloader'
import VideoModal from './VideoModal'

export default function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const [videoModal, setVideoModal] = useState<{ videoId: string; title: string } | null>(null)
  const [likedState, setLikedState] = useState(0)
  // Playlist dropdown state
  const [plDropdown, setPlDropdown] = useState<{ track: any; open: boolean } | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [plAdded, setPlAdded] = useState('')
  // Playlist search mode
  const [searchMode, setSearchMode] = useState<'tracks' | 'playlists'>('tracks')
  const [playlistResults, setPlaylistResults] = useState<YouTubePlaylist[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null)
  // Search results count selector
  const RESULT_OPTIONS = [20, 50, 100, 200]
  const [resultLimit, setResultLimit] = useState(20)
  const [downloading, setDownloading] = useState<string | null>(null)

  const doSearch = useCallback(async (q: string, limit?: number) => {
    const searchLimit = limit ?? resultLimit
    if (!q.trim()) { setResults([]); setPlaylistResults([]); return }
    if (searchMode === 'playlists') {
      setLoadingPlaylists(true)
      const pls = await searchYouTubePlaylists(q, 10)
      setPlaylistResults(pls)
      setLoadingPlaylists(false)
      saveSearchQuery(q, [])
    } else {
      setLoading(true)
      try {
        const res = await searchAll(q, 0, searchLimit)
        setResults(res)
        saveSearchQuery(q, res)
        // Preload stream URLs for all visible results في الخلفية
        preloadSearchResults(res)
      } catch { setResults([]) }
      setLoading(false)
    }
  }, [searchMode, resultLimit])

  useEffect(() => {
    const cached = getSearchCache()
    if (cached && cached.results.length > 0) {
      setQuery(cached.query)
      setResults(cached.results)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Close playlist dropdown on outside click
  useEffect(() => {
    if (!plDropdown?.open) return
    const handleClick = () => setPlDropdown(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [plDropdown?.open])

  // Refresh playlists when dropdown opens
  useEffect(() => {
    if (plDropdown?.open) setPlaylists(getPlaylists())
  }, [plDropdown?.open])

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Group by album/artist
  const groups: { key: string; tracks: any[] }[] = []
  const seen = new Set<string>()
  for (const t of results) {
    const key = `${t.artist} ||| ${t.album}`
    if (!seen.has(key)) {
      seen.add(key)
      groups.push({ key, tracks: [t] })
    } else {
      const g = groups.find(g => g.key === key)
      if (g) g.tracks.push(t)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="pt-5 md:pt-8 pb-4 md:pb-6 px-4 md:px-8 sticky top-0 z-10 bg-sonic-base/95 backdrop-blur-xl">
        <div className="relative max-w-xl">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-sonic-textMuted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums..."
            dir="auto"
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-sonic-surface3 border border-sonic-border text-sonic-textPrimary placeholder:text-sonic-textMuted/50 font-sans text-sm outline-none focus:border-[#e8c547]/30 focus:shadow-[0_0_20px_rgba(232,197,71,0.08)] transition-all duration-300"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#e8c547]/30 border-t-[#e8c547] rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search mode toggle */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setSearchMode('tracks'); if (query.trim()) doSearch(query) }}
            className={`px-4 py-1 rounded-lg text-xs font-medium transition-all ${searchMode === 'tracks' ? 'bg-[#e8c547] text-sonic-base' : 'bg-sonic-surface3 text-sonic-textMuted hover:text-sonic-textPrimary'}`}
          >
            Tracks
          </button>
          <button
            onClick={() => { setSearchMode('playlists'); if (query.trim()) doSearch(query) }}
            className={`px-4 py-1 rounded-lg text-xs font-medium transition-all ${searchMode === 'playlists' ? 'bg-[#e8c547] text-sonic-base' : 'bg-sonic-surface3 text-sonic-textMuted hover:text-sonic-textPrimary'}`}
          >
            YouTube Playlists
          </button>

          {/* Results count selector — only for Tracks mode */}
          {searchMode === 'tracks' && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-sonic-textMuted/50">Results:</span>
              {RESULT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setResultLimit(n)
                    if (query.trim()) doSearch(query, n)
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    resultLimit === n
                      ? 'bg-[#e8c547]/20 text-[#e8c547] border border-[#e8c547]/30'
                      : 'bg-sonic-surface3 text-sonic-textMuted/60 hover:text-sonic-textMuted border border-transparent'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {!query && !loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-sonic-textMuted/30 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sonic-textMuted/60 text-sm">Type to search millions of tracks</p>
          </div>
        )}

        {/* No results + not loading + has query */}
        {query && !loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-12 h-12 text-sonic-textMuted/30 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sonic-textMuted/60 text-sm">No results for "{query}"</p>
            <p className="text-sonic-textMuted/30 text-xs mt-1">Make sure the backend is running (port 8005) and yt-dlp is installed</p>
          </div>
        )}

        {/* Grouped results */}
        {results.length > 0 && groups.map((group) => (
          <div key={group.key} className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#e8c547]" />
                <span className="text-xs font-semibold text-sonic-textPrimary">{group.tracks[0].artist}</span>
                <span className="text-[10px] text-sonic-textMuted/50">· {group.tracks[0].album}</span>
              </div>
              <span className="text-[10px] text-sonic-textMuted/40">{group.tracks.length} tracks</span>
            </div>
            <div className="space-y-1">
              {group.tracks.map((track, i) => (
                <div
                  key={track.id + i}
                  className={`glass-card flex items-center gap-3 p-2.5 group cursor-pointer ${currentTrack?.id === track.id ? 'border-[#e8c547]/30' : ''}`}
                  onClick={() => setQueue(group.tracks, i)}
                >
                  <div className="w-9 h-9 rounded-lg bg-sonic-surface3 overflow-hidden shrink-0 flex items-center justify-center">
                    {track.cover && track.cover !== '/placeholder.svg' ? (
                      <img src={track.cover} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-4 h-4 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' }}
                      />
                    ) : (
                      <svg className="w-4 h-4 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${currentTrack?.id === track.id ? 'text-[#e8c547]' : 'text-sonic-textPrimary'}`}>{track.title}</p>
                    <p className="text-xs text-sonic-textMuted truncate">{track.artist} · {track.duration > 0 ? formatTime(track.duration) : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Like */}
                    <button onClick={(e) => { e.stopPropagation(); toggleLike(track.id); setLikedState(s => s+1) }} className="magnetic p-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isLiked(track.id) ? '#e8c547' : 'none'} stroke={isLiked(track.id) ? '#e8c547' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transition-colors">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                    </button>

                    {/* Add to Playlist */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlDropdown(plDropdown?.open && plDropdown.track.id === track.id ? null : { track, open: true }) }}
                        className="magnetic p-1 text-sonic-textMuted/30 hover:text-[#e8c547] transition-colors"
                        title="Add to playlist"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      {plDropdown?.open && plDropdown.track.id === track.id && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 glass-card p-2 shadow-2xl z-20" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[10px] text-sonic-textMuted/50 px-2 py-1 uppercase tracking-wider font-semibold">Add to playlist</p>
                          {playlists.length === 0 && (
                            <p className="text-xs text-sonic-textMuted/40 px-2 py-2">No playlists yet — create one in Library</p>
                          )}
                          {playlists.map(pl => (
                            <button
                              key={pl.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                addToPlaylist(pl.id, track)
                                setPlAdded(pl.id)
                                setTimeout(() => { setPlAdded(''); setPlDropdown(null) }, 1200)
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-sonic-textMuted hover:text-sonic-textPrimary hover:bg-sonic-surface3 transition-colors flex items-center justify-between"
                            >
                              <span className="truncate">{pl.name}</span>
                              {plAdded === pl.id && <span className="text-[#e8c547] text-[10px] shrink-0">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Video toggle (YouTube only) */}
                    {track.videoId && (
                      <button onClick={(e) => { e.stopPropagation(); setVideoModal({ videoId: track.videoId, title: track.title }) }} className="magnetic p-1 text-sonic-textMuted/40 hover:text-[#e8c547] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </button>
                    )}

                    {/* Download */}
                    {track.videoId && (
                      <div className="flex gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDownloading(track.id)
                            downloadToFolder(track).then((ok) => {
                              setLikedState(s => s + 1)
                              if (!ok) alert('Download failed — make sure the backend is running')
                            }).finally(() => setDownloading(null))
                          }}
                          disabled={downloading === track.id}
                          className={`magnetic p-1 transition-colors ${downloading === track.id ? 'text-[#e8c547] animate-pulse' : 'text-sonic-textMuted/30 hover:text-sonic-textPrimary'}`}
                          title="Download to folder"
                        >
                          {downloading === track.id ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="40 60" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          )}
                        </button>
                      </div>
                    )}

                    <svg className="w-3.5 h-3.5 text-sonic-textMuted/20 group-hover:text-[#e8c547] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Loading skeleton */}
        {loading && results.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#e8c547]/20 border-t-[#e8c547] rounded-full animate-spin" />
          </div>
        )}

        {/* ─── YouTube Playlists Results ─── */}
        {searchMode === 'playlists' && query.trim() && (
          <div className="mt-4">
            {loadingPlaylists && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#e8c547]/20 border-t-[#e8c547] rounded-full animate-spin" />
              </div>
            )}
            {!loadingPlaylists && playlistResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-12 h-12 text-sonic-textMuted/30 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p className="text-sonic-textMuted/60 text-sm">No playlists found for "{query}"</p>
              </div>
            )}
            <div className="space-y-3">
              {playlistResults.map((pl) => (
                <div key={pl.uploader} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedPlaylist(expandedPlaylist === pl.uploader ? null : pl.uploader)}
                    className="w-full flex items-center gap-4 p-4 group cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-sonic-surface3">
                      <img src={pl.thumbnail} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-sonic-textPrimary truncate group-hover:text-[#e8c547] transition-colors">{pl.uploader}</p>
                      <p className="text-xs text-sonic-textMuted">{pl.tracks.length} tracks</p>
                    </div>
                    <svg className={`w-4 h-4 text-sonic-textMuted/40 transition-transform duration-300 ${expandedPlaylist === pl.uploader ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {expandedPlaylist === pl.uploader && (
                    <div className="px-4 pb-4 space-y-1 border-t border-sonic-border pt-3 max-h-64 overflow-y-auto">
                      {pl.tracks.map((t, i) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            getUploaderTracks(pl.uploader, 20).then(res => {
                              if (res.length > 0) {
                                const idx = res.findIndex(r => r.id === t.id)
                                setQueue(res, idx >= 0 ? idx : 0)
                              }
                            })
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sonic-surface3 transition-colors text-left group/track"
                        >
                          <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-sonic-surface3">
                            <img src={t.cover} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-sonic-textMuted truncate group-hover/track:text-sonic-textPrimary transition-colors">{t.title}</p>
                          </div>
                          <svg className="w-3 h-3 text-sonic-textMuted/20 group-hover/track:text-[#e8c547]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {videoModal && <VideoModal videoId={videoModal.videoId} title={videoModal.title} onClose={() => setVideoModal(null)} />}
    </div>
  )
}
