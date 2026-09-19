export interface TrackResult {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  cover: string
  audio: string
  source: string
  videoId?: string
}

import { getSettings } from './settings'

export async function searchJamendo(query: string, clientId?: string): Promise<TrackResult[]> {
  const settings = getSettings()
  const key = clientId || settings.jamendoKey
  if (!key) return [] // No key = no Jamendo
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&limit=30&search=${encodeURIComponent(query)}&include=musicinfo`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`Jamendo API returned ${res.status} — check your client_id`)
      return []
    }
    const json = await res.json()
    if (!json.results || json.results.length === 0) return []
    return json.results.map((t: any) => ({
      id: `jam_${t.id}`,
      title: t.name,
      artist: t.artist_name,
      album: t.album_name || 'Single',
      duration: t.duration,
      cover: t.album_image || t.image || '/placeholder.svg',
      audio: t.audio,
      source: 'Jamendo',
    }))
  } catch (e) {
    console.warn('Jamendo search failed:', e)
    return []
  }
}

export async function getJamendoTracks(limit = 24, clientId?: string): Promise<TrackResult[]> {
  const settings = getSettings()
  const key = clientId || settings.jamendoKey
  if (!key) return []
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${key}&format=json&limit=${limit}&order=popularity_week&include=musicinfo`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    if (!json.results) return []
    return json.results.map((t: any) => ({
      id: `jam_${t.id}`,
      title: t.name,
      artist: t.artist_name,
      album: t.album_name || 'Single',
      duration: t.duration,
      cover: t.album_image || t.image || '/placeholder.svg',
      audio: t.audio,
      source: 'Jamendo',
    }))
  } catch {
    return []
  }
}

export async function searchFMA(query: string): Promise<TrackResult[]> {
  const url = `https://freemusicarchive.org/api/v1/tracks?format=json&limit=30&q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    if (!json?.dataset) return []
    return json.dataset.map((t: any) => ({
      id: `fma_${t.track_id}`,
      title: t.track_title,
      artist: t.artist_name || 'Unknown',
      album: t.album_title || 'Single',
      duration: parseInt(t.track_duration) || 0,
      cover: '/placeholder.svg',
      audio: t.track_url,
      source: 'FMA',
    }))
  } catch {
    return []
  }
}

export async function searchAll(query: string, offset = 0, limit = 20): Promise<TrackResult[]> {
  const [jamendo, youtube] = await Promise.all([
    searchJamendo(query),
    searchYouTube(query, limit, offset).catch(() => [] as TrackResult[]),
  ])
  return [...jamendo, ...youtube]
}

const BACKEND_URL = 'http://localhost:8005'

export async function searchYouTube(query: string, limit = 20, offset = 0): Promise<TrackResult[]> {
  const url = `${BACKEND_URL}/search?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 200)}&offset=${offset}`
  try {
    const res = await fetch(url)
    const json = await res.json()
    if (json.error) {
      console.warn('Backend error:', json.error)
      return []  // Still return empty, but at least log it
    }
    if (!json.results) return []
    return json.results.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration || 0,
      cover: t.cover || '/placeholder.svg',
      audio: `${BACKEND_URL}/stream/${t.videoId}`,
      source: 'YouTube',
      videoId: t.videoId,
    }))
  } catch {
    return []
  }
}

const MOCK_TRACKS: TrackResult[] = [
  { id: 'demo_1', title: 'Neon Lights', artist: 'Stellar Drift', album: 'Cosmic Waves', duration: 247, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_2', title: 'Desert Rose', artist: 'Sahara Collective', album: 'Sand & Silk', duration: 324, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_3', title: 'Velvet Night', artist: 'Zara Elie', album: 'Noir', duration: 198, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_4', title: 'Digital Dreams', artist: 'Pixel Wave', album: '010101', duration: 281, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_5', title: 'Midnight Run', artist: 'City Lights', album: 'Urban Stories', duration: 215, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_6', title: 'Ocean Breeze', artist: 'Sol Luna', album: 'Tides', duration: 302, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_7', title: 'Golden Hour', artist: 'Warmth', album: 'Sunset Sessions', duration: 256, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_8', title: 'Eclipse', artist: 'Shadow Realm', album: 'Dark Matter', duration: 344, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_9', title: 'Silk Road', artist: 'Nomad', album: 'Wanderer', duration: 278, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_10', title: 'Aurora', artist: 'Northern Lights', album: 'Polaris', duration: 315, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_11', title: 'Cairo Nights', artist: 'Orient Express', album: 'Eastern Tales', duration: 240, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_12', title: 'Crystal Clear', artist: 'Ice Formations', album: 'Frozen', duration: 199, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_13', title: 'Fire Dance', artist: 'Ember', album: 'Burning Bright', duration: 267, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_14', title: 'Starfall', artist: 'Meteor Shower', album: 'Celestial', duration: 290, cover: '/placeholder.svg', audio: '', source: 'Demo' },
  { id: 'demo_15', title: 'Ripple Effect', artist: 'Waterforms', album: 'Liquid', duration: 223, cover: '/placeholder.svg', audio: '', source: 'Demo' },
]

export function getDemoTracks(): TrackResult[] {
  return MOCK_TRACKS
}

// ─── Smart Recommendations ───

const RECOMMEND_GENRES: Record<string, string> = {
  'pop': 'tag:pop',
  'rock': 'tag:rock',
  'jazz': 'tag:jazz',
  'electronic': 'tag:electronic',
  'hip hop': 'tag:hiphop',
  'rap': 'tag:hiphop',
  'classical': 'tag:classical',
  'rnb': 'tag:rnb',
  'soul': 'tag:soul',
  'blues': 'tag:blues',
  'country': 'tag:country',
  'folk': 'tag:folk',
  'metal': 'tag:metal',
  'punk': 'tag:metal',
  'reggae': 'tag:world',
  'dance': 'tag:dance',
  'latin': 'tag:latin',
  'ambient': 'tag:ambient',
  'lo fi': 'tag:ambient',
  'indie': 'tag:rock',
  'alternative': 'tag:rock',
  'acoustic': 'tag:folk',
  'edm': 'tag:dance',
  'techno': 'tag:electronic',
  'house': 'tag:dance',
  'trap': 'tag:hiphop',
  'afro': 'tag:world',
  'arabic': 'tag:world',
  'oriental': 'tag:world',
  'synth': 'tag:electronic',
  'dubstep': 'tag:electronic',
  'dnb': 'tag:electronic',
  'jamendo': '',  // general popular
}

/**
 * Get smart recommendations based on listening history genres
 * Falls back to popular tracks if no genre data
 */
export async function getRecommendations(genres: string[], limit = 20): Promise<TrackResult[]> {
  // Map genres to Jamendo tags
  const tags = genres
    .map(g => RECOMMEND_GENRES[g] || '')
    .filter(Boolean)

  if (tags.length > 0) {
    // Use the top genre tag for search
    const tag = tags[0].replace('tag:', '')
    const results = await searchJamendo(tag)
    if (results.length > 0) {
      // Shuffle and return
      return results.sort(() => Math.random() - 0.5).slice(0, limit)
    }
  }

  // Fallback: popular tracks
  return getJamendoTracks(limit)
}

/**
 * Personalized recommendations based on the artists the user actually plays.
 * This runs with normal search APIs, so it does not send listening history to a third party.
 */
export async function getArtistRecommendations(
  artists: string[],
  excludeIds: Set<string> = new Set(),
  limit = 20,
): Promise<TrackResult[]> {
  const preferredArtists = artists.filter(Boolean).slice(0, 3)
  if (preferredArtists.length === 0) return []

  const batches = await Promise.all(
    preferredArtists.map((artist) => searchAll(`${artist} music`, 0, 8).catch(() => [] as TrackResult[]))
  )
  const seen = new Set(excludeIds)
  const personalized: TrackResult[] = []

  for (const batch of batches) {
    for (const track of batch) {
      if (seen.has(track.id)) continue
      seen.add(track.id)
      personalized.push(track)
      if (personalized.length >= limit) return personalized
    }
  }
  return personalized
}

/**
 * Get more like this — similar tracks to one the user liked
 */
export async function getMoreLikeThis(track: TrackResult, limit = 12): Promise<TrackResult[]> {
  // Use artist name as search query
  const artistResults = await searchJamendo(track.artist)
  if (artistResults.length > 0) {
    return artistResults
      .filter(t => t.id !== track.id)
      .slice(0, limit)
  }
  // Fallback: use album name
  const albumResults = await searchJamendo(track.album)
  return albumResults.filter(t => t.id !== track.id).slice(0, limit)
}

// ─── YouTube Playlists ───

const BACKEND = 'http://localhost:8005'

export interface YouTubePlaylist {
  uploader: string
  thumbnail: string
  tracks: { id: string; title: string; duration: number; cover: string; videoId: string }[]
}

export async function searchYouTubePlaylists(query: string, limit = 10): Promise<YouTubePlaylist[]> {
  try {
    const res = await fetch(`${BACKEND}/search_playlists?q=${encodeURIComponent(query)}&limit=${limit}`)
    const data = await res.json()
    return data.playlists || []
  } catch {
    return []
  }
}

export async function getUploaderTracks(uploader: string, limit = 20): Promise<TrackResult[]> {
  try {
    const res = await fetch(`${BACKEND}/uploader_tracks?uploader=${encodeURIComponent(uploader)}&limit=${limit}`)
    const data = await res.json()
    return data.results || []
  } catch {
    return []
  }
}
