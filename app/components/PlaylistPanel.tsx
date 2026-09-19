'use client'

import { useState, useEffect } from 'react'
import { getPlaylists, createPlaylist, deletePlaylist, getHistory, clearHistory, getDownloads, downloadToFolder } from '@/lib/storage'
import { usePlayerStore } from '@/lib/player-store'
import type { Playlist } from '@/lib/storage'
import type { Track } from '@/lib/player-store'


export default function PlaylistPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [newName, setNewName] = useState('')
  const [tab, setTab] = useState<'playlists' | 'history' | 'downloads'>('playlists')
  const [expandedPl, setExpandedPl] = useState<string | null>(null)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const history = getHistory()
  const downloads = getDownloads()
  const [dlStatus, setDlStatus] = useState<string | null>(null)

  useEffect(() => {
    if (open) setPlaylists(getPlaylists())
  }, [open])

  if (!open) return null

  const handleCreate = () => {
    if (!newName.trim()) return
    createPlaylist(newName.trim())
    setPlaylists(getPlaylists())
    setNewName('')
  }

  /** Download all tracks in a playlist */
  const downloadAll = async (pl: Playlist) => {
    const ytTracks = pl.tracks.filter(t => t.videoId)
    if (ytTracks.length === 0) { setDlStatus('No YouTube tracks to download'); return }
    setDlStatus(`Downloading ${ytTracks.length} tracks...`)
    let done = 0
    for (const t of ytTracks) {
      const ok = await downloadToFolder(t)
      if (ok) {
        done++
        setDlStatus(`Downloaded ${done}/${ytTracks.length}`)
      }
    }
    setDlStatus(`Saved ${done}/${ytTracks.length} tracks on this device`)
    setTimeout(() => setDlStatus(null), 3000)
  }

  /** Render a track row with album art */
  const TrackRow = ({ track, onPlay }: { track: Track; onPlay: () => void }) => (
    <button onClick={onPlay} className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-sonic-surface3 transition-colors text-left group/track">
      <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-sonic-surface3">
        {track.cover && track.cover !== '/placeholder.svg' ? (
          <img src={track.cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-4 h-4 text-sonic-textMuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-sonic-textPrimary truncate group-hover/track:text-[#e8c547] transition-colors">{track.title}</p>
        <p className="text-[10px] text-sonic-textMuted truncate">{track.artist}</p>
      </div>
      <svg className="w-3 h-3 text-sonic-textMuted/20 group-hover/track:text-[#e8c547] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[520px] max-h-[85vh] rounded-2xl bg-sonic-surface2 border border-sonic-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-sonic-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#e8c547]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <h2 className="font-display text-lg font-bold text-sonic-textPrimary">My Library</h2>
            </div>
            <button onClick={onClose} className="text-sonic-textMuted hover:text-sonic-textPrimary transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            {(['playlists', 'history', 'downloads'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab === t ? 'bg-[#e8c547] text-sonic-base' : 'bg-sonic-surface3 text-sonic-textMuted hover:text-sonic-textPrimary'}`}>
                {t === 'playlists' ? `Playlists (${playlists.length})` : t === 'history' ? `History (${history.length})` : `Downloads (${downloads.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] no-scrollbar">
          {/* ─── PLAYLISTS ─── */}
          {tab === 'playlists' && (
            <div className="space-y-3">
              {/* Create new */}
              <div className="flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="New playlist name..."
                  className="flex-1 h-10 px-3 rounded-lg bg-sonic-base border border-sonic-border text-sm text-sonic-textPrimary placeholder:text-sonic-textMuted/50 outline-none focus:border-[#e8c547]/30 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                <button onClick={handleCreate} className="px-4 rounded-lg bg-[#e8c547] text-sonic-base text-sm font-medium hover:brightness-110 active:scale-95 transition-all">+ Create</button>
              </div>

              {playlists.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-8">No playlists yet</p>}

              {playlists.map(pl => (
                <div key={pl.id} className="glass-card overflow-hidden">
                  {/* Playlist header */}
                  <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedPl(expandedPl === pl.id ? null : pl.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e8c547]/20 to-[#b8962e]/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#e8c547]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-sonic-textPrimary">{pl.name}</p>
                        <p className="text-xs text-sonic-textMuted/60">{pl.tracks.length} tracks</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                      {pl.tracks.length > 0 && (
                        <button onClick={() => downloadAll(pl)}
                          className="px-2.5 py-1 rounded-lg bg-sonic-surface3 text-[10px] text-sonic-textMuted hover:text-[#e8c547] transition-colors flex items-center gap-1"
                          title="Download all">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          DL
                        </button>
                      )}
                      {pl.tracks.length > 0 && (
                        <button onClick={() => setQueue(pl.tracks, 0)}
                          className="px-3 py-1 rounded-lg bg-sonic-surface3 text-xs text-sonic-textMuted hover:text-[#e8c547] transition-colors">Play</button>
                      )}
                      <button onClick={() => { deletePlaylist(pl.id); setPlaylists(getPlaylists()) }}
                        className="px-3 py-1 rounded-lg bg-sonic-surface3 text-xs text-red-400/60 hover:text-red-400 transition-colors">Del</button>
                    </div>
                  </div>

                  {/* Expanded tracks */}
                  {expandedPl === pl.id && (
                    <div className="px-4 pb-4 space-y-0.5 border-t border-sonic-border pt-3">
                      {pl.tracks.length === 0 && <p className="text-xs text-sonic-textMuted/50 py-2">Empty</p>}
                      {pl.tracks.map((t, i) => (
                        <TrackRow key={t.id + i} track={t} onPlay={() => setQueue(pl.tracks, i)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── HISTORY ─── */}
          {tab === 'history' && (
            <div className="space-y-1.5">
              <div className="flex justify-end mb-2">
                {history.length > 0 &&
                  <button onClick={() => { clearHistory(); window.location.reload() }}
                    className="text-xs text-sonic-textMuted/50 hover:text-red-400 transition-colors">Clear</button>}
              </div>
              {history.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-8">No history</p>}
              {history.slice(0, 50).map((t) => (
                <TrackRow key={t.id} track={t} onPlay={() => setQueue([t], 0)} />
              ))}
            </div>
          )}

          {/* ─── DOWNLOADS ─── */}
          {tab === 'downloads' && (
            <div className="space-y-1.5">
              {downloads.length === 0 && <p className="text-sonic-textMuted/50 text-sm text-center py-8">No downloaded tracks</p>}
              {downloads.map((t) => (
                <TrackRow key={t.id} track={t} onPlay={() => setQueue([t], 0)} />
              ))}
            </div>
          )}

          {/* Download status toast */}
          {dlStatus && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-sonic-surface3 border border-[#e8c547]/20 text-xs text-sonic-textMuted text-center">
              {dlStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
