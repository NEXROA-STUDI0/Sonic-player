'use client'

import { useRef, useEffect } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { addToHistory, getOfflineAudioUrl } from '@/lib/storage'
import { preloadNextTrack } from '@/lib/preloader'

const BACKEND = 'http://localhost:8005'

export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const nextAudioRef = useRef<HTMLAudioElement | null>(null) // Pre-buffer audio
  const offlineObjectUrlRef = useRef<string | null>(null)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const next = usePlayerStore((s) => s.next)
  const pause = usePlayerStore((s) => s.pause)
  const setLoading = usePlayerStore((s) => s.setLoading)
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const setPlaybackError = usePlayerStore((s) => s.setPlaybackError)

  // Init both audio elements
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio()
      a.preload = 'auto'
      audioRef.current = a
    }
    if (!nextAudioRef.current) {
      const na = new Audio()
      na.preload = 'auto'
      nextAudioRef.current = na
    }
    const audio = audioRef.current
    audio.volume = volume
    nextAudioRef.current.volume = volume
  }, [volume])

  // Load & play current track
  useEffect(() => {
    const audio = audioRef.current
    const nextAudio = nextAudioRef.current
    if (!audio || !currentTrack) return

    const loadAudio = async () => {
      setLoading(true)
      setPlaybackError(null)
      if (offlineObjectUrlRef.current) {
        URL.revokeObjectURL(offlineObjectUrlRef.current)
        offlineObjectUrlRef.current = null
      }

      // Detach old listeners on nextAudio
      if (nextAudio) {
        nextAudio.pause()
        nextAudio.src = ''
        nextAudio.load()
      }

      if (currentTrack.source === 'YouTube') {
        try {
          audio.removeAttribute('crossOrigin')
          audio.src = `${BACKEND}/play/${currentTrack.videoId}`
        } catch (error) {
          audio.pause()
          pause()
          audio.removeAttribute('src')
          audio.load()
          setPlaybackError(error instanceof Error ? error.message : 'YouTube audio is unavailable')
          setLoading(false)
          return
        }
      } else if (currentTrack.source === 'Jamendo' || currentTrack.source === 'Local') {
        try {
          if (currentTrack.audio.startsWith('offline://')) {
            const offlineId = decodeURIComponent(currentTrack.audio.slice('offline://'.length))
            const offlineUrl = await getOfflineAudioUrl(offlineId)
            if (!offlineUrl) throw new Error('This download is not available on this device')
            offlineObjectUrlRef.current = offlineUrl
            audio.removeAttribute('crossOrigin')
            audio.src = offlineUrl
          } else {
            audio.crossOrigin = 'anonymous'
            audio.src = currentTrack.audio
          }
        } catch (error) {
          audio.pause()
          pause()
          audio.removeAttribute('src')
          audio.load()
          setPlaybackError(error instanceof Error ? error.message : 'Offline audio is unavailable')
          setLoading(false)
          return
        }
      } else {
        audio.src = ''
      }

      audio.load()
      try {
        if (isPlaying) await audio.play()
      } catch {}

      // Start preloading next track — use a hidden audio element for real pre-buffering
      const nextIdx = queueIndex + 1
      if (nextIdx < queue.length) {
        const nextTrack = queue[nextIdx]
        if (nextTrack) {
          preloadNextTrack(queue, queueIndex)
          // Actually pre-buffer audio data
          prebufferTrack(nextTrack, nextAudio!)
        }
      }
    }

    loadAudio()
  }, [currentTrack?.id])

  // Helper: pre-buffer a track's audio in the background
  const prebufferTrack = async (track: any, audioEl: HTMLAudioElement) => {
    try {
      let src = ''
      if (track.source === 'YouTube' && track.videoId) {
        src = `${BACKEND}/play/${track.videoId}`
      } else if (track.source === 'Jamendo' || track.source === 'Local') {
        if (track.audio.startsWith('offline://')) {
          const offlineId = decodeURIComponent(track.audio.slice('offline://'.length))
          src = await getOfflineAudioUrl(offlineId) || ''
        } else {
          src = track.audio
        }
      }
      if (src) {
        if (src.startsWith('blob:')) {
          audioEl.removeAttribute('crossOrigin')
        } else {
          audioEl.crossOrigin = 'anonymous'
        }
        audioEl.src = src
        audioEl.load()
        // Start buffering but don't play
        audioEl.play().then(() => {
          audioEl.pause() // Buffer then pause
        }).catch(() => {})
      }
    } catch {}
  }

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setProgress(audio.currentTime)
    const onLoadedMeta = () => {
      setDuration(audio.duration || 0)
      setLoading(false)
      if (currentTrack) addToHistory(currentTrack)
    }
    const onEnded = () => {
      next()
    }
    const onError = () => {
      setLoading(false)
      if (currentTrack?.source === 'YouTube') {
        pause()
        setPlaybackError('Unable to play this YouTube stream. Configure yt-dlp authentication or try another track.')
      }
      if (currentTrack?.source === 'Demo') {
        setTimeout(() => next(), 1000)
      }
    }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => setLoading(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
    }
  }, [currentTrack?.id])

  return null
}
