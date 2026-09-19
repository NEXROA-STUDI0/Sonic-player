'use client'

import { useEffect, useState } from 'react'

export default function NetworkStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-full border border-[#e8c547]/30 bg-sonic-surface2/95 px-3 py-1.5 text-[11px] text-[#e8c547] shadow-lg backdrop-blur-xl">
      Offline mode · downloaded tracks only
    </div>
  )
}
