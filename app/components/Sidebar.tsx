'use client'

import { useState } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { getDemoTracks } from '@/lib/api'

export default function Sidebar({ onOpenSettings, onViewChange, onOpenLibrary }: { 
  onOpenSettings: () => void, 
  onViewChange: (view: 'home' | 'search' | 'library') => void, 
  onOpenLibrary: () => void 
}) {
  const [active, setActive] = useState('home')
  const [showSources, setShowSources] = useState(false)
  const setQueue = usePlayerStore((s) => s.setQueue)

  const nav = (id: string, view: 'home' | 'search' | 'library') => {
    setActive(id)
    onViewChange(view)
    const main = document.getElementById('main-view')
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const items = [
    { id: 'home', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'library', label: 'Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  ]

  return (
    <aside className="fixed md:static bottom-0 left-0 right-0 z-40 w-full md:w-[240px] h-16 md:h-full flex items-center md:items-stretch flex-col border-t md:border-t-0 md:border-r border-sonic-border bg-sonic-base/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none shrink-0">
      {/* Logo */}
      <div className="hidden md:block px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e8c547] to-[#b8962e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#08090c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#f5f3ef]">Sonic</span>
        </div>
      </div>

      <nav className="flex-1 w-full flex md:block items-center justify-around md:space-y-1 px-1 md:px-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => nav(item.id, item.id as any)}
            className={`sidebar-item flex-1 md:flex-none justify-center md:justify-start w-full ${active === item.id ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </button>
        ))}

        {/* Library Section */}
        <div className="hidden md:block pt-4 pb-2">
          <div className="glow-line" />
        </div>

        <div className="hidden md:block px-4 py-2 text-xs font-medium tracking-wider uppercase text-sonic-textMuted">
          <span>My Collection</span>
        </div>

        <button onClick={() => nav('library', 'library')} className="hidden md:flex sidebar-item w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span>Liked Songs</span>
        </button>

        <button onClick={() => nav('library', 'library')} className="hidden md:flex sidebar-item w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Albums</span>
        </button>

        {/* Sources */}
        <div className="hidden md:block pt-4 pb-2">
          <div className="glow-line" />
        </div>

        <button onClick={() => setShowSources(!showSources)} className="hidden md:flex sidebar-item w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <span>Sources</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`ml-auto transition-transform duration-300 ${showSources ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showSources && (
          <div className="hidden md:block ml-4 space-y-1 animate-spring-in">
            <div className="sidebar-item text-xs"><span className="w-2 h-2 rounded-full bg-emerald-400" />Jamendo (CC)</div>
            <div className="sidebar-item text-xs"><span className="w-2 h-2 rounded-full bg-amber-400" />YouTube</div>
            <div className="sidebar-item text-xs"><span className="w-2 h-2 rounded-full bg-sky-400" />Local Files</div>
          </div>
        )}
      </nav>

      <div className="hidden md:block px-3 pb-6 space-y-1">
        <div className="glow-line mb-4" />
        <button onClick={() => { const tracks = getDemoTracks(); setQueue(tracks, 0) }} className="sidebar-item w-full text-xs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          <span>Play Demos</span>
        </button>
        <button onClick={onOpenSettings} className="sidebar-item w-full text-xs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
        <div className="pt-2 pb-1 px-4">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-[#e8c547] to-[#b8962e] flex items-center justify-center text-[5px] font-bold text-sonic-base">S</div>
            <span className="text-[9px] text-sonic-textMuted/30">by NEXORA</span>
          </div>
          {/* Social Links */}
          <div className="flex items-center gap-2 px-0.5">
            <a href="https://www.youtube.com/@nexora-studio-tm" target="_blank" rel="noopener noreferrer" className="text-sonic-textMuted/30 hover:text-red-400 transition-colors" title="YouTube">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
            <a href="https://www.instagram.com/nexorahq6" target="_blank" rel="noopener noreferrer" className="text-sonic-textMuted/30 hover:text-pink-400 transition-colors" title="Instagram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61594167431660" target="_blank" rel="noopener noreferrer" className="text-sonic-textMuted/30 hover:text-blue-400 transition-colors" title="Facebook">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@nexora6693" target="_blank" rel="noopener noreferrer" className="text-sonic-textMuted/30 hover:text-white transition-colors" title="TikTok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
