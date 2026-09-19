/**
 * Sonic Player — Audio Preloader
 *
 * Preloads the next track's audio URL while the current track plays,
 * so switching tracks is instant (no buffering delay).
 */

const BACKEND = 'http://localhost:8005'

// Cache of preloaded stream URLs: videoId → audio_url
const preloadCache = new Map<string, string>()

/**
 * Start preloading the next track(s) in the background.
 * Call this after a track begins playing.
 */
export function preloadNextTrack(tracks: { id: string; audio: string; source: string; videoId?: string }[], currentIndex: number) {
  const nextIndex = currentIndex + 1
  if (nextIndex >= tracks.length) return

  const nextTrack = tracks[nextIndex]
  if (!nextTrack) return

  // Already preloaded
  if (preloadCache.has(nextTrack.id)) return

  // Only preload YouTube tracks (Jamendo URLs are direct)
  if (nextTrack.source === 'YouTube' && nextTrack.videoId) {
    preloadCache.set(nextTrack.id, '__loading__')

    fetch(`${BACKEND}/stream/${nextTrack.videoId}`)
      .then(r => r.json())
      .then(data => {
        if (data.audio_url) {
          preloadCache.set(nextTrack.id, data.audio_url)
        }
      })
      .catch(() => {
        preloadCache.delete(nextTrack.id)
      })
  }
}

/**
 * Get a preloaded audio URL for a track.
 * Returns the URL if preloaded, or null if not preloaded yet.
 */
export function getPreloadedUrl(trackId: string): string | null {
  const url = preloadCache.get(trackId)
  if (!url || url === '__loading__') return null
  return url
}

/**
 * Remove a track from the preload cache (e.g., when track is removed from queue)
 */
export function clearPreloaded(trackId: string) {
  preloadCache.delete(trackId)
}

/**
 * Clear all preloaded URLs
 */
export function clearAllPreloaded() {
  preloadCache.clear()
}

/**
 * Preload stream URLs for all visible search results.
 * Uses batch endpoint — ONE request instead of 20!
 */
export function preloadSearchResults(tracks: { id: string; videoId?: string; source?: string }[]) {
  const videoIds = tracks
    .filter(t => t.videoId && t.source === 'YouTube' && !preloadCache.has(t.id))
    .map(t => t.videoId!)
  
  if (videoIds.length === 0) return

  // Mark all as loading
  for (const track of tracks) {
    if (track.videoId && track.source === 'YouTube' && !preloadCache.has(track.id)) {
      preloadCache.set(track.id, '__loading__')
    }
  }

  // Single batch request بدل N request
  fetch(`${BACKEND}/batch_stream?ids=${videoIds.join(',')}`)
    .then(r => r.json())
    .then(data => {
      if (data.urls) {
        for (const [videoId, url] of Object.entries(data.urls)) {
          if (url) {
            // Find track by videoId
            const track = tracks.find(t => t.videoId === videoId)
            if (track) {
              preloadCache.set(track.id, url as string)
            }
          }
        }
      }
    })
    .catch(() => {
      // Cleanup loading markers on failure
      for (const track of tracks) {
        if (track.videoId) preloadCache.delete(track.id)
      }
    })
}
