'use client'

import { useState } from 'react'

interface VideoModalProps {
  videoId: string
  title: string
  onClose: () => void
}

export default function VideoModal({ videoId, title, onClose }: VideoModalProps) {
  const [loading, setLoading] = useState(true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[90vw] max-w-4xl rounded-2xl overflow-hidden bg-sonic-base border border-sonic-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-sonic-border">
          <p className="text-sm font-medium text-sonic-textPrimary truncate max-w-md">{title}</p>
          <button onClick={onClose} className="text-sonic-textMuted hover:text-sonic-textPrimary transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#e8c547]/30 border-t-[#e8c547] rounded-full animate-spin" />
            </div>
          )}
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
        </div>
        <div className="px-6 py-3 flex items-center justify-between">
          <a
            href={`http://localhost:8005/download_video/${videoId}`}
            download
            className="flex items-center gap-2 text-xs text-sonic-textMuted hover:text-[#e8c547] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Video (MP4)
          </a>
          <a
            href={`http://localhost:8005/download/${videoId}`}
            download
            className="flex items-center gap-2 text-xs text-sonic-textMuted hover:text-[#e8c547] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            Download Audio (M4A)
          </a>
        </div>
      </div>
    </div>
  )
}
