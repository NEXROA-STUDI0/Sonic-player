'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'logo' | 'brand' | 'tagline' | 'done'>('logo')

  useEffect(() => {
    // Phase sequence
    const t1 = setTimeout(() => setPhase('brand'), 500)
    const t2 = setTimeout(() => setPhase('tagline'), 1300)
    const t3 = setTimeout(() => {
      setPhase('done')
      // Store in session so it only shows once per session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sonic_splash_seen', 'true')
      }
      // Small delay for exit animation, then finish
      setTimeout(onFinish, 800)
    }, 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-sonic-base transition-all duration-700 ${
        phase === 'done' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#e8c547]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.15 + Math.random() * 0.15,
              animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Rotating ring / orbit */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Outer glow ring */}
          <div
            className={`absolute inset-0 rounded-full border border-[#e8c547]/10 transition-all duration-1000 ${
              phase !== 'done' ? 'animate-rotate-slow' : 'opacity-0'
            }`}
          />
          {/* Inner ring */}
          <div
            className={`absolute inset-2 rounded-full border border-[#e8c547]/20 transition-all duration-1000 ${
              phase !== 'done' ? 'animate-rotate-slow' : 'opacity-0'
            }`}
            style={{ animationDirection: 'reverse', animationDuration: '15s' }}
          />

          {/* Logo icon — Animated Music Note */}
          <div className={`relative z-10 transition-all duration-700 ${
            phase === 'logo' ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
          }`}>
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Outer pulse ring */}
              <div className="absolute inset-0 rounded-full border-2 border-[#e8c547]/20 animate-ping" style={{animationDuration: '2s'}} />
              <div className="absolute inset-1 rounded-full border border-[#e8c547]/10" />
              {/* Music note icon */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18V5l12-2v13" stroke="#e8c547" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="18" r="3" fill="#e8c547" fillOpacity="0.3" stroke="#e8c547" strokeWidth="1.2" />
                <circle cx="18" cy="16" r="3" fill="#e8c547" fillOpacity="0.3" stroke="#e8c547" strokeWidth="1.2" />
                {/* Sound waves from note */}
                <path d="M18 6a4 4 0 010 8" stroke="#e8c547" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
                <path d="M18 2a8 8 0 010 16" stroke="#e8c547" strokeWidth="1" strokeLinecap="round" opacity="0.25" />
              </svg>
            </div>
          </div>
        </div>

        {/* Brand name */}
        <div className={`text-center transition-all duration-700 ${
          phase === 'brand' || phase === 'tagline' || (phase === 'done')
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0'
        }`}>
          <h1 className="font-display text-2xl font-bold tracking-[0.15em] text-[#e8c547]">
            NEXORA
          </h1>
          <div className="h-px w-24 mx-auto mt-2 bg-gradient-to-r from-transparent via-[#e8c547]/40 to-transparent" />
          <p className="font-display text-[10px] tracking-[0.3em] text-[#e8c547]/40 mt-2 uppercase">
            Studio
          </p>
        </div>

        {/* Tagline — appears after brand */}
        <div className={`transition-all duration-500 ${
          phase === 'tagline' || phase === 'done'
            ? 'translate-y-0 opacity-100'
            : 'translate-y-2 opacity-0'
        }`}>
          <p className="font-sans text-xs text-[#9a968e]/50 tracking-[0.2em]">
            SONIC PLAYER
          </p>
        </div>

        {/* Loading bar at bottom */}
        <div className={`w-32 h-[2px] rounded-full bg-sonic-border overflow-hidden mt-4 transition-all duration-500 ${
          phase !== 'done' ? 'opacity-100' : 'opacity-0'
        }`}>
          <div
            className="h-full rounded-full bg-[#e8c547] transition-all duration-[2800ms] ease-linear"
            style={{ width: phase === 'logo' ? '10%' : phase === 'brand' ? '40%' : phase === 'tagline' ? '75%' : '100%' }}
          />
        </div>
      </div>

      {/* Copyright bottom */}
      <p className="absolute bottom-8 text-[10px] text-[#9a968e]/20 tracking-[0.15em] font-sans">
        © 2026 NEXORA
      </p>
    </div>
  )
}
