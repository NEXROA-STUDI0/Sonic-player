'use client'

import { useState, useEffect } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { getLikes, toggleLike, getHistory, clearHistory, getDownloads, createPlaylist, deletePlaylist, getPlaylists, addToPlaylist, removeFromPlaylist } from '@/lib/storage'
import type { Playlist } from '@/lib/storage'
import type { Track } from '@/lib/player-store'

export default function LibraryView() {
  const setQueue = usePlayerStore((s) => s.setQueue)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const [tab, setTab] = useState<'liked' | 'downloads' | 'playlists' | 'history'>('liked')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [newPlName, setNewPlName] = useState('')
  const [expandedPl, setExpandedPl] = useState<string | null>(null)

  useEffect(() => { setPlaylists(getPlaylists()) }, [tab])

  const likes = getLikes()
  const history = getHistory()
  const downloads = getDownloads()
  const renderTrack = (track: Track, idx: number, onRemove?: () => void) => (
    <div
      key={track.id + idx}
      role="button"
      tabIndex={0}
      onClick={() => setQueue([track], 0)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setQueue([track], 0) }}
      className={`glass-card w-full flex items-center gap-3 p-3 group cursor-pointer ${currentTrack?.id === track.id ? 'border-[#e8c547]/30' : ''}`}
    >
      <div className="w-10 h-10 rounded-lg bg-sonic-surface3 overflow-hidden shrink-0 flex items-center justify-center">
        {track.cover && track.cover !== '/placeholder.svg' ? (
          <img src={track.cover} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' }}
          />
        ) : (
          <svg className="w-5 h-5 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium truncate ${currentTrack?.id === track.id ? 'text-[#e8c547]' : 'text-sonic-textPrimary'}`}>{track.title}</p>
        <p className="text-xs text-sonic-textMuted truncate">{track.artist}</p>
        {track.source === 'Local' && <span className="text-[9px] text-[#e8c547]/70">Available offline</span>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); toggleLike(track.id); onRemove?.() }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={getLikes().includes(track.id) ? '#e8c547' : 'none'} stroke={getLikes().includes(track.id) ? '#e8c547' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </button>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="pt-5 md:pt-8 pb-4 md:pb-6 px-4 md:px-8">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-[#e8c547]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h1 className="font-display text-xl font-bold text-sonic-textPrimary">My Library</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['liked', 'downloads', 'playlists', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab === t ? 'bg-[#e8c547] text-sonic-base' : 'bg-sonic-surface3 text-sonic-textMuted hover:text-sonic-textPrimary'}`}>
              {t === 'liked' ? `Liked (${likes.length})` : 
               t === 'downloads' ? `Downloads (${downloads.length})` :
               t === 'playlists' ? `Playlists (${playlists.length})` :
               `History (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {/* Liked Songs */}
        {tab === 'liked' && (
          <div className="space-y-2">
            {likes.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-16">Click the heart on any track to save it here</p>}
            {history.filter(t => likes.includes(t.id)).map((t, i) => renderTrack(t, i))}
          </div>
        )}

        {/* Downloads */}
        {tab === 'downloads' && (
          <div className="space-y-2">
            {downloads.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-16">Downloaded tracks appear here</p>}
            {downloads.map((t, i) => renderTrack(t, i))}
          </div>
        )}

        {/* Playlists */}
        {tab === 'playlists' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={newPlName} onChange={(e) => setNewPlName(e.target.value)} placeholder="New playlist..." className="flex-1 h-10 px-3 rounded-lg bg-sonic-base border border-sonic-border text-sm text-sonic-textPrimary placeholder:text-sonic-textMuted/50 outline-none focus:border-[#e8c547]/30 transition-colors" onKeyDown={(e) => { if (e.key === 'Enter' && newPlName.trim()) { createPlaylist(newPlName.trim()); setPlaylists(getPlaylists()); setNewPlName('') }}} />
              <button onClick={() => { if (newPlName.trim()) { createPlaylist(newPlName.trim()); setPlaylists(getPlaylists()); setNewPlName('') }}} className="px-4 rounded-lg bg-[#e8c547] text-sonic-base text-sm font-medium hover:brightness-110 active:scale-95 transition-all">+</button>
            </div>
            {playlists.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-8">No playlists yet</p>}
            {playlists.map((pl) => (
              <div key={pl.id} className="glass-card overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedPl(expandedPl === pl.id ? null : pl.id)}>
                  <div>
                    <p className="text-sm font-medium text-sonic-textPrimary">{pl.name}</p>
                    <p className="text-xs text-sonic-textMuted/60">{pl.tracks.length} tracks</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={(e) => { e.stopPropagation(); if (pl.tracks.length > 0) setQueue(pl.tracks, 0) }} className="px-3 py-1 rounded-lg bg-sonic-surface3 text-xs text-sonic-textMuted hover:text-[#e8c547] transition-colors" disabled={pl.tracks.length === 0}>Play</button>
                    <button onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); setPlaylists(getPlaylists()) }} className="px-3 py-1 rounded-lg bg-sonic-surface3 text-xs text-red-400/60 hover:text-red-400 transition-colors">Del</button>
                  </div>
                </div>
                {expandedPl === pl.id && (
                  <div className="px-4 pb-4 space-y-1.5 border-t border-sonic-border pt-3">
                    {pl.tracks.length === 0 && <p className="text-xs text-sonic-textMuted/50">Empty playlist — search for songs and add them</p>}
                    {pl.tracks.map((t, i) => (
                      <div key={t.id + i} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-sonic-surface3 transition-colors">
                        <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-sonic-surface3">
                          {t.cover && t.cover !== '/placeholder.svg' ? (
                            <img src={t.cover} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            </div>
                          )}
                        </div>
                        <button onClick={() => setQueue(pl.tracks, i)} className="flex-1 text-left text-sonic-textMuted hover:text-sonic-textPrimary truncate">{t.title}</button>
                        <button onClick={() => { removeFromPlaylist(pl.id, t.id); setPlaylists(getPlaylists()) }} className="text-red-400/40 hover:text-red-400 shrink-0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="space-y-2">
            <div className="flex justify-end mb-2">
              {history.length > 0 && <button onClick={() => { clearHistory(); window.location.reload() }} className="text-xs text-sonic-textMuted/50 hover:text-red-400 transition-colors">Clear all</button>}
            </div>
            {history.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-16">No recently played tracks</p>}
            {history.slice(0, 50).map((t, i) => renderTrack(t, i))}
          </div>
        )}
      </div>

      {/* Branding Footer */}
      <div className="px-4 md:px-8 py-4 border-t border-sonic-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#e8c547] to-[#b8962e] flex items-center justify-center text-[8px] font-bold text-sonic-base">S</div>
          <span className="text-[10px] text-sonic-textMuted/40">Sonic Player by</span>
          <span className="text-[10px] font-semibold text-[#e8c547]/70">NEXORA</span>
        </div>
        <span className="text-[10px] text-sonic-textMuted/30">v1.0</span>
      </div>
    </div>
  )
}
