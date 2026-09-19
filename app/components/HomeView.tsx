'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { getDemoTracks, getRecommendations, getArtistRecommendations, searchYouTube } from '@/lib/api'
import { getRecentTracks, getTopTracks, getListeningGenres, getFavoriteArtists, getDownloads } from '@/lib/storage'
import type { TrackResult } from '@/lib/api'

const BACKEND = 'http://localhost:8005'

export default function HomeView() {
  const setQueue = usePlayerStore((s) => s.setQueue)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  // History-based state
  const [recentTracks, setRecentTracks] = useState<TrackResult[]>([])
  const [topTracks, setTopTracks] = useState<TrackResult[]>([])
  const [recommendations, setRecommendations] = useState<TrackResult[]>([])
  const [recommendLabel, setRecommendLabel] = useState('Recommended for You')
  const [preferredArtists, setPreferredArtists] = useState<string[]>([])
  const [offlineDownloads, setOfflineDownloads] = useState<TrackResult[]>([])
  const [hasHistory, setHasHistory] = useState(false)
  
  // Country + Trending
  const [country, setCountry] = useState('')
  const [trending, setTrending] = useState<TrackResult[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)

  // Fallback state
  const [tracks, setTracks] = useState<TrackResult[]>([])
  const [albums, setAlbums] = useState<{title: string; artist: string; count: number}[]>([])
  const [featured] = useState([
    { title: 'Chill Vibes', color: 'from-emerald-500/20 to-teal-900/20', icon: 'M9 18V5l12-2v13' },
    { title: 'Late Night', color: 'from-violet-500/20 to-purple-900/20', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
    { title: 'Energy Boost', color: 'from-orange-500/20 to-red-900/20', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { title: 'Arabic Classics', color: 'from-amber-500/20 to-yellow-900/20', icon: 'M9 18V5l12-2v13' },
  ])

  useEffect(() => {
    // Load play stats
    const recent = getRecentTracks(8)
    const top = getTopTracks(8)
    const genres = getListeningGenres()
    const artists = getFavoriteArtists(3)
    setOfflineDownloads(getDownloads())

      if (recent.length > 0) {
      setHasHistory(true)
      setRecentTracks(recent)
      setTopTracks(top)

      setPreferredArtists(artists)
      const playedIds = new Set(recent.map(t => t.id))

      // Prefer artists the user actually listens to, then fall back to genres.
      getArtistRecommendations(artists, playedIds, 20).then(personalized => {
        if (personalized.length > 0) {
          setRecommendLabel(`More from ${artists[0]}`)
          setRecommendations(personalized)
          return
        }
        const label = genres.length > 0
          ? `More ${genres[0].charAt(0).toUpperCase() + genres[0].slice(1)}`
          : 'Discover New Sounds'
        setRecommendLabel(label)
        return getRecommendations(genres, 20).then(res => {
          const fresh = res.filter(t => !playedIds.has(t.id))
          setRecommendations(fresh.length > 0 ? fresh : res)
        })
      }).catch(() => {})
    } else {
      // No history — show fallback
      setTracks(getDemoTracks())
      // Try to fetch real tracks for albums section
      import('@/lib/api').then(mod => {
        mod.searchJamendo('popular').then(res => {
          const albumMap = new Map<string, {title: string; artist: string; count: number}>()
          for (const t of res) {
            const key = t.album
            if (!albumMap.has(key)) albumMap.set(key, {title: t.album, artist: t.artist, count: 1})
            else albumMap.get(key)!.count++
          }
          setAlbums(Array.from(albumMap.values()).slice(0, 6))
        }).catch(() => {})
      })
    }
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  /** Render a small track card with album art */
  const TrackRow = ({ track, index, tracks, label }: { track: TrackResult; index: number; tracks: TrackResult[]; label?: string }) => (
    <button
      onClick={() => setQueue(tracks, index)}
      className={`glass-card w-full flex items-center gap-3 p-2.5 group cursor-pointer ${
        currentTrack?.id === track.id ? 'border-[#e8c547]/30' : ''
      }`}
    >
      {/* Album art or number */}
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-sonic-surface3">
        {track.source === 'Demo' ? (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        ) : track.cover && track.cover !== '/placeholder.svg' ? (
          <img src={track.cover} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium truncate ${currentTrack?.id === track.id ? 'text-[#e8c547]' : 'text-sonic-textPrimary'}`}>
          {track.title}
        </p>
        <p className="text-xs text-sonic-textMuted truncate">{track.artist}{label ? ` · ${label}` : ''}</p>
      </div>

      {/* Duration + play */}
      <span className="text-xs text-sonic-textMuted/60 shrink-0">{formatTime(track.duration)}</span>
      <svg className="w-3.5 h-3.5 text-sonic-textMuted/20 group-hover:text-[#e8c547] transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </button>
  )

  /** Section wrapper */
  const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-sonic-textPrimary">{title}</h2>
          {subtitle && <p className="text-[11px] text-sonic-textMuted/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32">
        {/* Hero */}
        <div className="pt-6 md:pt-10 pb-6 md:pb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-sonic-textPrimary">
            {hasHistory ? 'Welcome back 🎧' : 'Good to hear you'}
          </h1>
          <p className="text-sonic-textMuted mt-2 text-sm">
            {hasHistory
              ? 'Pick up where you left off'
              : 'Discover new sounds'}
          </p>
          {hasHistory && preferredArtists.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-[10px] text-sonic-textMuted/50">Your taste:</span>
              {preferredArtists.map((artist) => (
                <span key={artist} className="px-2.5 py-1 rounded-full bg-[#e8c547]/10 border border-[#e8c547]/20 text-[10px] text-[#e8c547]/80">
                  {artist}
                </span>
              ))}
            </div>
          )}
        </div>

        {offlineDownloads.length > 0 && (
          <Section title="Available Offline" subtitle="Saved on this device">
            {offlineDownloads.slice(0, 8).map((track, i) => (
              <TrackRow key={`offline_${track.id}`} track={track} index={i} tracks={offlineDownloads} label="Offline" />
            ))}
          </Section>
        )}

        {hasHistory ? (
          <>
            {/* ─── Recently Played ─── */}
            {recentTracks.length > 0 && (
              <Section title="Recently Played" subtitle="Your latest listens">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  {recentTracks.slice(0, 4).map((track, i) => (
                    <button
                      key={`recent_${track.id}`}
                      onClick={() => setQueue(recentTracks, recentTracks.findIndex(t => t.id === track.id))}
                      className="glass-card flex items-center gap-3 p-2.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-sonic-surface3">
                        {track.cover && track.cover !== '/placeholder.svg' ? (
                          <img src={track.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-medium text-sonic-textPrimary truncate">{track.title}</p>
                        <p className="text-[11px] text-sonic-textMuted truncate">{track.artist}</p>
                      </div>
                      <svg className="w-3.5 h-3.5 text-sonic-textMuted/20 group-hover:text-[#e8c547] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </button>
                  ))}
                </div>
                {recentTracks.slice(4).map((track, i) => (
                  <TrackRow key={`recent_${track.id}`} track={track} index={recentTracks.findIndex(t => t.id === track.id)} tracks={recentTracks} />
                ))}
              </Section>
            )}

            {/* ─── Top Played ─── */}
            {topTracks.length > 0 && (
              <Section title="Most Played" subtitle="Your favorites">
                {topTracks.map((track, i) => (
                  <TrackRow key={`top_${track.id}`} track={track} index={topTracks.findIndex(t => t.id === track.id)} tracks={topTracks} />
                ))}
              </Section>
            )}

            {/* ─── Recommendations ─── */}
            {recommendations.length > 0 && (
              <Section title={recommendLabel} subtitle="Based on your listening">
                {recommendations.map((track, i) => (
                  <TrackRow key={`rec_${track.id}_${i}`} track={track} index={i} tracks={recommendations} />
                ))}
              </Section>
            )}
          </>
        ) : (
          <>
            {/* ─── Quick Picks ─── */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-sonic-textPrimary mb-4">Quick Picks</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {featured.map((f, i) => (
                  <button
                    key={i}
                    className={`relative h-28 rounded-xl bg-gradient-to-br ${f.color} border border-sonic-border overflow-hidden group cursor-pointer hover:border-[#e8c547]/20 transition-all duration-300`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute right-3 top-3 opacity-20 group-hover:opacity-40 transition-opacity">
                      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                        <path d={f.icon} />
                      </svg>
                    </div>
                    <div className="absolute bottom-3 left-4">
                      <p className="font-display text-sm font-semibold text-sonic-textPrimary">{f.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Albums ─── */}
            {albums.length > 0 && (
              <div className="mb-10">
                <h2 className="text-sm font-semibold text-sonic-textPrimary mb-4">Albums</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {albums.map((album, i) => (
                    <div key={i} className="glass-card p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e8c547]/20 to-[#b8962e]/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-[#e8c547]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-sonic-textPrimary truncate">{album.title}</p>
                        <p className="text-xs text-sonic-textMuted truncate">{album.artist} · {album.count} tracks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Popular Tracks ─── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-sonic-textPrimary">Popular Tracks</h2>
                <button
                  onClick={() => setQueue(tracks, 0)}
                  className="text-xs text-[#e8c547]/70 hover:text-[#e8c547] transition-colors"
                >
                  Play All
                </button>
              </div>
              <div className="space-y-1">
                {tracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} tracks={tracks} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
