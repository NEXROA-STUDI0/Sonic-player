'use client'

import { useState } from 'react'
import { useSettings } from '@/lib/settings'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsPanel({ open, onClose }: Props) {
  const { settings, update } = useSettings()
  const [jamendoKey, setJamendoKey] = useState(settings.jamendoKey)
  const [saved, setSaved] = useState(false)

  if (!open) return null

  const handleSave = () => {
    update({ jamendoKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[440px] max-h-[80vh] rounded-2xl bg-sonic-surface2 border border-sonic-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-sonic-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#e8c547]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <h2 className="font-display text-lg font-bold text-sonic-textPrimary">Settings</h2>
            </div>
            <button onClick={onClose} className="text-sonic-textMuted hover:text-sonic-textPrimary transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto max-h-[60vh] no-scrollbar">
          {/* API Keys Section */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-sonic-textMuted mb-4">API Keys</h3>

            <div className="space-y-4">
              {/* Jamendo */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm font-medium text-sonic-textPrimary">Jamendo</span>
                  </div>
                  <a
                    href="https://developer.jamendo.com/v3.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#e8c547]/60 hover:text-[#e8c547] transition-colors"
                  >
                    Get free key →
                  </a>
                </div>
                <input
                  value={jamendoKey}
                  onChange={(e) => setJamendoKey(e.target.value)}
                  placeholder="Enter your Jamendo Client ID"
                  className="w-full h-10 px-3 rounded-lg bg-sonic-base border border-sonic-border text-sm text-sonic-textPrimary placeholder:text-sonic-textMuted/50 outline-none focus:border-[#e8c547]/30 transition-colors font-mono"
                />
                <p className="text-[10px] text-sonic-textMuted/50 mt-2 leading-relaxed">
                  Optional. Get a free Client ID from Jamendo Developer. Without it, YouTube search still works fine.
                </p>
              </div>

              {/* SoundCloud */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm font-medium text-sonic-textPrimary">SoundCloud</span>
                  </div>
                  <a
                    href="https://developers.soundcloud.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#e8c547]/60 hover:text-[#e8c547] transition-colors"
                  >
                    Get free key →
                  </a>
                </div>
                <input
                  value={settings.soundcloudKey}
                  onChange={(e) => update({ soundcloudKey: e.target.value })}
                  placeholder="SoundCloud API Key (optional)"
                  className="w-full h-10 px-3 rounded-lg bg-sonic-base border border-sonic-border text-sm text-sonic-textPrimary placeholder:text-sonic-textMuted/50 outline-none focus:border-[#e8c547]/30 transition-colors font-mono"
                />
                <p className="text-[10px] text-sonic-textMuted/50 mt-2 leading-relaxed">
                  Optional. Enables SoundCloud search alongside Jamendo.
                </p>
              </div>

              {/* FMA Toggle */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-sm font-medium text-sonic-textPrimary">Free Music Archive</span>
                  </div>
                  <button
                    onClick={() => update({ fmaEnabled: !settings.fmaEnabled })}
                    className={`w-10 h-6 rounded-full transition-colors relative ${settings.fmaEnabled ? 'bg-[#e8c547]' : 'bg-sonic-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-sonic-base absolute top-1 transition-all ${settings.fmaEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-sonic-textMuted/50 mt-2 leading-relaxed">
                  Free Music Archive. No API key needed, library is smaller.
                </p>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="pt-2">
            <div className="glow-line mb-4" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-sonic-textMuted/50">Sonic Player v1.0</p>
                <p className="text-[10px] text-sonic-textMuted/30 mt-0.5">Built with ♥</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sonic-border flex items-center justify-between">
          <button
            onClick={() => {
              update({ jamendoKey: '', soundcloudKey: '', fmaEnabled: false })
              setJamendoKey('')
            }}
            className="text-xs text-sonic-textMuted/50 hover:text-sonic-textMuted transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#e8c547] text-sonic-base text-sm font-medium hover:brightness-110 active:scale-95 transition-all"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
