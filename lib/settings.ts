'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'sonic-settings'

interface SonicSettings {
  jamendoKey: string
  soundcloudKey: string
  fmaEnabled: boolean
}

const DEFAULTS: SonicSettings = {
  jamendoKey: '',
  soundcloudKey: '',
  fmaEnabled: false,
}

let listeners: Array<(s: SonicSettings) => void> = []

function loadSettings(): SonicSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULTS
}

function saveSettings(s: SonicSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  listeners.forEach((fn) => fn(s))
}

let cached = loadSettings()

export function getSettings(): SonicSettings {
  return cached
}

export function updateSettings(partial: Partial<SonicSettings>) {
  cached = { ...cached, ...partial }
  saveSettings(cached)
}

export function useSettings() {
  const [settings, setSettings] = useState<SonicSettings>(cached)

  useEffect(() => {
    const handler = (s: SonicSettings) => setSettings({ ...s })
    listeners.push(handler)
    return () => {
      listeners = listeners.filter((l) => l !== handler)
    }
  }, [])

  const update = useCallback((partial: Partial<SonicSettings>) => {
    updateSettings(partial)
  }, [])

  return { settings, update }
}
