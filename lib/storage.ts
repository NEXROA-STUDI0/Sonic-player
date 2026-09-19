// Local storage for Sonic Player - Favorites, History, Playlists, Play Stats

import type { Track } from './player-store'

const KEYS = {
  likes: 'sonic_likes',
  history: 'sonic_history',
  playStats: 'sonic_playstats',
  playlists: 'sonic_playlists',
  downloads: 'sonic_downloads',
  searchCache: 'sonic_search_cache',
}

// ─── Favorites / Likes ───

export function getLikes(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEYS.likes) || '[]') } catch { return [] }
}

export function isLiked(trackId: string): boolean {
  return getLikes().includes(trackId)
}

export function getLikedTracks(allTracks: Track[]): Track[] {
  const ids = getLikes()
  const history = getHistory()
  const matched: Track[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const t = history.find(h => h.id === id)
    if (t && !seen.has(t.id)) { matched.push(t); seen.add(t.id) }
  }
  return matched
}

export function toggleLike(trackId: string): boolean {
  const likes = getLikes()
  const idx = likes.indexOf(trackId)
  if (idx >= 0) likes.splice(idx, 1)
  else likes.push(trackId)
  localStorage.setItem(KEYS.likes, JSON.stringify(likes))
  return idx < 0
}

// ─── Play Stats (Smart History) ───

export interface PlayRecord {
  track: Track
  count: number
  lastPlayed: number
  firstPlayed: number
}

export function getPlayStats(): PlayRecord[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEYS.playStats) || '[]') } catch { return [] }
}

export function recordPlay(track: Track) {
  const stats = getPlayStats()
  const existing = stats.find(s => s.track.id === track.id)
  if (existing) {
    existing.count++
    existing.lastPlayed = Date.now()
  } else {
    stats.unshift({
      track,
      count: 1,
      lastPlayed: Date.now(),
      firstPlayed: Date.now(),
    })
  }
  // Keep top 100
  const trimmed = stats.slice(0, 100)
  localStorage.setItem(KEYS.playStats, JSON.stringify(trimmed))
}

/** Last N unique played tracks (for "آخر ما سمعته") */
export function getRecentTracks(limit = 10): Track[] {
  return getPlayStats()
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, limit)
    .map(s => s.track)
}

/** Most played tracks (for "الأكثر استماعاً") */
export function getTopTracks(limit = 10): Track[] {
  return getPlayStats()
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(s => s.track)
}

/** Extract genre tags from play history for recommendations */
export function getFavoriteArtists(limit = 5): string[] {
  const stats = getPlayStats()
  const likedIds = new Set(getLikes())
  const artistScores = new Map<string, number>()
  for (const record of stats) {
    const artist = record.track.artist?.trim()
    if (!artist) continue
    const score = record.count * (likedIds.has(record.track.id) ? 4 : 1)
    artistScores.set(artist, (artistScores.get(artist) || 0) + score)
  }
  return [...artistScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist]) => artist)
}

export function getListeningGenres(): string[] {
  const stats = getPlayStats()
  const genreCount = new Map<string, number>()
  for (const s of stats) {
    // From Jamendo tags in track ID (jam_ prefix)
    const tags = s.track.id.split('_')
    // Try to extract genre from track source or album name
    const words = `${s.track.album} ${s.track.artist} ${s.track.title}`.toLowerCase()
    const knownGenres = ['pop', 'rock', 'jazz', 'electronic', 'hip hop', 'rap', 'classical',
      'rnb', 'soul', 'blues', 'country', 'folk', 'metal', 'punk', 'reggae',
      'dance', 'latin', 'ambient', 'lo fi', 'indie', 'alternative', 'acoustic',
      'edm', 'techno', 'house', 'trap', 'drill', 'afro', 'arabic', 'oriental',
      'trap', 'drill', 'grime', 'garage', 'synth', 'dubstep', 'dnb',
    ]
    for (const genre of knownGenres) {
      if (words.includes(genre)) {
        genreCount.set(genre, (genreCount.get(genre) || 0) + s.count)
      }
    }
    // Give bonus to sources
    if (s.track.source === 'Jamendo') {
      genreCount.set('jamendo', (genreCount.get('jamendo') || 0) + s.count)
    }
  }
  return [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0])
}

export function clearPlayStats() {
  localStorage.setItem(KEYS.playStats, '[]')
}

// ─── Recently Played (legacy) ───

export function getHistory(): Track[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEYS.history) || '[]') } catch { return [] }
}

export function addToHistory(track: Track) {
  const history = getHistory()
  const filtered = history.filter(t => t.id !== track.id)
  filtered.unshift(track)
  const trimmed = filtered.slice(0, 50)
  localStorage.setItem(KEYS.history, JSON.stringify(trimmed))
}

export function clearHistory() {
  localStorage.setItem(KEYS.history, '[]')
}

// ─── Downloads ───

const BACKEND = 'http://localhost:8005'
const OFFLINE_DB = 'sonic-offline'
const OFFLINE_STORE = 'audio'

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(OFFLINE_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OFFLINE_STORE)) {
        request.result.createObjectStore(OFFLINE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open offline storage'))
  })
}

export async function saveOfflineAudio(trackId: string, blob: Blob): Promise<void> {
  const db = await openOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(OFFLINE_STORE, 'readwrite').objectStore(OFFLINE_STORE).put(blob, trackId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Could not save offline audio'))
  })
  db.close()
}

export async function getOfflineAudioUrl(trackId: string): Promise<string | null> {
  try {
    const db = await openOfflineDb()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction(OFFLINE_STORE, 'readonly').objectStore(OFFLINE_STORE).get(trackId)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

export function trackDownload(track: Track) {
  const downloads = getDownloads()
  const idx = downloads.findIndex(t => t.id === track.id)
  if (idx >= 0) downloads[idx] = { ...downloads[idx], ...track }
  else downloads.unshift(track)
  localStorage.setItem(KEYS.downloads, JSON.stringify(downloads.slice(0, 50)))
}

/** Download audio into browser storage so it can play with no network connection. */
export async function downloadToFolder(track: Track): Promise<boolean> {
  if (!track.videoId || typeof window === 'undefined') return false
  try {
    const res = await fetch(`${BACKEND}/download/${track.videoId}`)
    if (!res.ok) return false
    const blob = await res.blob()
    if (!blob.size) return false
    await saveOfflineAudio(track.id, blob)
    trackDownload({ ...track, audio: `offline://${encodeURIComponent(track.id)}`, source: 'Local' })
    return true
  } catch {
    return false
  }
}

export function getDownloads(): Track[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEYS.downloads) || '[]') } catch { return [] }
}

// ─── Search Cache (keep last query) ───

export function saveSearchQuery(query: string, results: any[]) {
  try {
    localStorage.setItem(KEYS.searchCache, JSON.stringify({ query, results, time: Date.now() }))
  } catch {}
}

export function getSearchCache(): { query: string; results: any[] } | null {
  try {
    const raw = localStorage.getItem(KEYS.searchCache)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.time > 3600000) return null // 1 hour expiry
    return data
  } catch { return null }
}

// ─── Playlists ───

export interface Playlist {
  id: string
  name: string
  description: string
  tracks: Track[]
  created: number
  updated: number
}

export function getPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEYS.playlists) || '[]') } catch { return [] }
}

export function createPlaylist(name: string, description = ''): Playlist {
  const playlists = getPlaylists()
  const pl: Playlist = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    description,
    tracks: [],
    created: Date.now(),
    updated: Date.now(),
  }
  playlists.push(pl)
  localStorage.setItem(KEYS.playlists, JSON.stringify(playlists))
  return pl
}

export function deletePlaylist(id: string) {
  const playlists = getPlaylists().filter(p => p.id !== id)
  localStorage.setItem(KEYS.playlists, JSON.stringify(playlists))
}

export function addToPlaylist(playlistId: string, track: Track) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === playlistId)
  if (!pl) return
  if (pl.tracks.find(t => t.id === track.id)) return // no dupes
  pl.tracks.push(track)
  pl.updated = Date.now()
  localStorage.setItem(KEYS.playlists, JSON.stringify(playlists))
}

export function removeFromPlaylist(playlistId: string, trackId: string) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === playlistId)
  if (!pl) return
  pl.tracks = pl.tracks.filter(t => t.id !== trackId)
  pl.updated = Date.now()
  localStorage.setItem(KEYS.playlists, JSON.stringify(playlists))
}

export function renamePlaylist(id: string, name: string) {
  const playlists = getPlaylists()
  const pl = playlists.find(p => p.id === id)
  if (!pl) return
  pl.name = name
  pl.updated = Date.now()
  localStorage.setItem(KEYS.playlists, JSON.stringify(playlists))
}
