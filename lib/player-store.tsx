'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createStore, useStore } from 'zustand'
import { recordPlay } from './storage'

export interface Track {
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

export type RepeatMode = 'off' | 'one' | 'all'

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  isPlaying: boolean
  isLoading: boolean
  playbackError: string | null
  volume: number
  progress: number
  duration: number
  repeat: RepeatMode
  isShuffled: boolean
  videoMode: boolean
  visualizerType: 'bars' | 'wave' | 'circle' | 'fire' | 'aurora' | 'plasma' | 'rings'

  setCurrentTrack: (track: Track) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setLoading: (v: boolean) => void
  setPlaybackError: (message: string | null) => void
  setVolume: (v: number) => void
  setProgress: (p: number) => void
  setDuration: (d: number) => void
  next: () => void
  prev: () => void
  addToQueue: (track: Track) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  toggleRepeat: () => void
  toggleShuffle: () => void
  toggleVideoMode: () => void
  cycleVisualizer: () => void
}

/** Call this whenever a track starts playing to record in history */
function trackStarted(track: Track | null) {
  if (track && typeof window !== 'undefined') {
    try { recordPlay(track) } catch {}
  }
}

export function createPlayerStore() {
  return createStore<PlayerState>((set, get) => ({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isLoading: false,
    playbackError: null,
    volume: 0.7,
    progress: 0,
    duration: 0,
    repeat: 'off',
    isShuffled: false,
    videoMode: false,
    visualizerType: 'bars',

    setCurrentTrack: (track) => {
      trackStarted(track)
      set({ currentTrack: track, queueIndex: 0, playbackError: null })
    },

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
    setLoading: (v) => set({ isLoading: v }),
    setPlaybackError: (message) => set({ playbackError: message }),

    setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
    setProgress: (p) => set({ progress: p }),
    setDuration: (d) => set({ duration: d }),

    next: () => {
      const { queue, queueIndex, repeat, isShuffled } = get()
      if (queue.length === 0) return

      let nextIndex: number
      if (repeat === 'one') {
        nextIndex = queueIndex
      } else if (isShuffled) {
        nextIndex = Math.floor(Math.random() * queue.length)
      } else {
        nextIndex = queueIndex + 1
        if (nextIndex >= queue.length) {
          if (repeat === 'all') nextIndex = 0
          else { set({ isPlaying: false }); return }
        }
      }

      set({ queueIndex: nextIndex, currentTrack: queue[nextIndex], progress: 0, isPlaying: true, playbackError: null })
      trackStarted(queue[nextIndex])
    },

    prev: () => {
      const { queue, queueIndex, progress } = get()
      if (queue.length === 0) return

      if (progress > 3) {
        set({ progress: 0 })
        return
      }

      const prevIndex = queueIndex - 1 >= 0 ? queueIndex - 1 : queue.length - 1
      set({ queueIndex: prevIndex, currentTrack: queue[prevIndex], progress: 0, isPlaying: true, playbackError: null })
      trackStarted(queue[prevIndex])
    },

    addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

    removeFromQueue: (id) => set((s) => ({
      queue: s.queue.filter((t) => t.id !== id),
      queueIndex: s.queueIndex >= s.queue.length - 1 ? s.queue.length - 2 : s.queueIndex,
    })),

    clearQueue: () => set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false }),

    setQueue: (tracks, startIndex = 0) => {
      const track = tracks[startIndex] || null
      trackStarted(track)
      set({
        queue: tracks,
        queueIndex: startIndex,
        currentTrack: track,
        progress: 0,
        isPlaying: true,
        playbackError: null,
      })
    },

    toggleRepeat: () => set((s) => {
      const modes: RepeatMode[] = ['off', 'all', 'one']
      const idx = modes.indexOf(s.repeat)
      return { repeat: modes[(idx + 1) % modes.length] }
    }),

    toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),

    toggleVideoMode: () => set((s) => ({ videoMode: !s.videoMode })),

    cycleVisualizer: () => set((s) => {
      const types: Array<'bars' | 'wave' | 'circle' | 'fire' | 'aurora' | 'plasma' | 'rings'> = ['bars', 'wave', 'circle', 'fire', 'aurora', 'plasma', 'rings']
      const idx = types.indexOf(s.visualizerType)
      return { visualizerType: types[(idx + 1) % types.length] }
    }),
  }))
}

const PlayerContext = createContext<ReturnType<typeof createPlayerStore> | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createPlayerStore> | null>(null)
  if (!storeRef.current) storeRef.current = createPlayerStore()
  return <PlayerContext.Provider value={storeRef.current}>{children}</PlayerContext.Provider>
}

export function usePlayerStore<T>(selector: (state: PlayerState) => T): T {
  const store = useContext(PlayerContext)
  if (!store) throw new Error('Missing PlayerProvider')
  return useStore(store, selector)
}

export { useStore }
