'use client'

import { useRef, useEffect, useState } from 'react'
import { usePlayerStore } from '@/lib/player-store'

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null

function ensureAnalyser(audioEl: HTMLAudioElement | null) {
  if (!audioEl || audioEl.readyState < 2) return null
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    if (!analyser) {
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
    }
    if (!source) {
      source = audioCtx.createMediaElementSource(audioEl)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)
    }
    return analyser
  } catch {
    return null
  }
}

export default function Visualizer({ height = 400 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const type = usePlayerStore((s) => s.visualizerType)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const animRef = useRef<number>(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches || (navigator.hardwareConcurrency || 8) <= 4)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 2)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const bars = isMobile ? 48 : 96
    const data = new Float32Array(bars).fill(0)
    const freqData = new Uint8Array(bars)
    let phase = 0
    let lastFrame = 0
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []
    const particleCount = isMobile ? 24 : 160

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * 600,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 2 - 1.5,
        r: Math.random() * 5 + 2,
        a: Math.random() * 0.7 + 0.1,
      })
    }

    const renderType = isMobile && (type === 'plasma' || type === 'aurora' || type === 'fire') ? 'bars' : type

    const draw = (timestamp = 0) => {
      if (isMobile && timestamp - lastFrame < 33) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = timestamp
      const w = canvas!.clientWidth
      const h = canvas!.clientHeight
      ctx!.clearRect(0, 0, w, h)

      // Try real audio data
      let hasRealData = false
      const audioEl = document.querySelector('audio')
      if (audioEl && audioEl.readyState >= 2) {
        const an = ensureAnalyser(audioEl)
        if (an) {
          an.getByteFrequencyData(freqData)
          for (let i = 0; i < bars; i++) {
            const val = freqData[i] / 255
            data[i] += (val - data[i]) * 0.25
          }
          hasRealData = true
        }
      }

      if (!hasRealData) {
        phase += 0.03
        if (isPlaying) {
          for (let i = 0; i < bars; i++) {
            const target = Math.sin(phase + i * 0.12) * 0.35 + Math.random() * (0.3 + volume * 0.35) + 0.05
            data[i] += (Math.max(0, target) - data[i]) * 0.15
          }
        } else {
          for (let i = 0; i < bars; i++) data[i] *= 0.97
        }
      }

      // ── BARS MODE (مكبر × 2) ──
      if (renderType === 'bars') {
        const gap = 1
        const barW = (w - gap * (bars - 1)) / bars
        const centerH = h * 0.45

        // خلفية زرقا خفيفة تحت الـ bars
        ctx!.fillStyle = 'rgba(232, 197, 71, 0.015)'
        ctx!.fillRect(0, h / 2 - 2, w, 4)

        for (let i = 0; i < bars; i++) {
          const val = data[i]
          const barH = Math.max(2, val * centerH * 1.3)

          // Top bar (mirrored)
          const xt = i * (barW + gap)
          const yt = h / 2 - barH
          const gradT = ctx!.createLinearGradient(0, yt, 0, h / 2)
          gradT.addColorStop(0, `rgba(232, 197, 71, ${0.4 + val * 0.6})`)
          gradT.addColorStop(0.6, `rgba(232, 197, 71, ${0.15 + val * 0.25})`)
          gradT.addColorStop(1, 'rgba(232, 197, 71, 0.01)')
          ctx!.fillStyle = gradT
          ctx!.fillRect(xt, yt, barW, barH)

          // Bottom bar
          const yb = h / 2
          const gradB = ctx!.createLinearGradient(0, yb, 0, yb + barH)
          gradB.addColorStop(0, 'rgba(232, 197, 71, 0.01)')
          gradB.addColorStop(0.4, `rgba(232, 197, 71, ${0.15 + val * 0.25})`)
          gradB.addColorStop(1, `rgba(232, 197, 71, ${0.4 + val * 0.6})`)
          ctx!.fillStyle = gradB
          ctx!.fillRect(xt, yb + 1, barW, barH - 1)

          // Top edge glow لكل bar
          if (val > 0.3) {
            ctx!.fillStyle = `rgba(255, 230, 150, ${val * 0.15})`
            ctx!.fillRect(xt, yt, barW, 1.5)
            ctx!.fillRect(xt, yb + barH - 1, barW, 1.5)
          }
        }

        // Center glow line — أوسع
        ctx!.beginPath()
        const glowGrad = ctx!.createLinearGradient(0, h / 2 - 3, 0, h / 2 + 4)
        glowGrad.addColorStop(0, 'rgba(232, 197, 71, 0)')
        glowGrad.addColorStop(0.3, `rgba(232, 197, 71, ${0.05 + (isPlaying ? 0.15 : 0)})`)
        glowGrad.addColorStop(0.5, `rgba(255, 230, 150, ${0.08 + (isPlaying ? 0.2 : 0)})`)
        glowGrad.addColorStop(0.7, `rgba(232, 197, 71, ${0.05 + (isPlaying ? 0.15 : 0)})`)
        glowGrad.addColorStop(1, 'rgba(232, 197, 71, 0)')
        ctx!.fillStyle = glowGrad
        ctx!.fillRect(0, h / 2 - 1.5, w, 3)

      // ── WAVE MODE (مكبر) ──
      } else if (renderType === 'wave') {
        // Wave 1 — main
        ctx!.beginPath()
        const centerY = h / 2
        ctx!.moveTo(0, h / 2)
        for (let i = 0; i <= bars; i++) {
          const x = (i / bars) * w
          const amp = data[Math.min(i, bars - 1)] * h * 0.55
          const y = centerY + Math.sin((i / bars) * Math.PI * 4 + phase) * amp
          ctx!.lineTo(x, y)
        }
        ctx!.strokeStyle = '#e8c547'
        ctx!.lineWidth = 3.5
        ctx!.shadowColor = 'rgba(232, 197, 71, 0.4)'
        ctx!.shadowBlur = 18
        ctx!.stroke()
        ctx!.shadowBlur = 0

        // Wave 2 — mirrored (فوق)
        ctx!.beginPath()
        ctx!.moveTo(0, h / 2)
        for (let i = 0; i <= bars; i++) {
          const x = (i / bars) * w
          const amp = data[Math.min(i, bars - 1)] * h * 0.45
          const y = centerY - Math.sin((i / bars) * Math.PI * 4 + phase + 1.5) * amp
          ctx!.lineTo(x, y)
        }
        ctx!.strokeStyle = 'rgba(232, 197, 71, 0.5)'
        ctx!.lineWidth = 2
        ctx!.shadowColor = 'rgba(232, 197, 71, 0.2)'
        ctx!.shadowBlur = 12
        ctx!.stroke()
        ctx!.shadowBlur = 0

        // Filled area تحت الموجة
        ctx!.lineTo(w, h)
        ctx!.lineTo(0, h)
        ctx!.closePath()
        const fillGrad = ctx!.createLinearGradient(0, centerY - 80, 0, h)
        fillGrad.addColorStop(0, 'rgba(232, 197, 71, 0.08)')
        fillGrad.addColorStop(0.5, 'rgba(232, 197, 71, 0.02)')
        fillGrad.addColorStop(1, 'rgba(232, 197, 71, 0)')
        ctx!.fillStyle = fillGrad
        ctx!.fill()

      // ── CIRCLE MODE (مكبر × 2) ──
      } else if (renderType === 'circle') {
        const cx = w / 2
        const cy = h / 2
        const radius = Math.min(w, h) * 0.35

        // Outer glow ring
        ctx!.beginPath()
        ctx!.arc(cx, cy, radius + 15, 0, Math.PI * 2)
        ctx!.strokeStyle = `rgba(232, 197, 71, ${0.04 + (isPlaying ? 0.06 : 0)})`
        ctx!.lineWidth = 4
        ctx!.shadowColor = 'rgba(232, 197, 71, 0.15)'
        ctx!.shadowBlur = 30
        ctx!.stroke()
        ctx!.shadowBlur = 0

        // Frequency spokes
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2
          const amp = data[i] * 55 + 5
          const x1 = cx + Math.cos(angle) * radius
          const y1 = cy + Math.sin(angle) * radius
          const x2 = cx + Math.cos(angle) * (radius + amp)
          const y2 = cy + Math.sin(angle) * (radius + amp)

          ctx!.beginPath()
          ctx!.moveTo(x1, y1)
          ctx!.lineTo(x2, y2)
          ctx!.strokeStyle = `rgba(232, 197, 71, ${0.2 + data[i] * 0.7})`
          ctx!.lineWidth = 3
          ctx!.shadowColor = `rgba(232, 197, 71, ${data[i] * 0.3})`
          ctx!.shadowBlur = 10
          ctx!.stroke()
          ctx!.shadowBlur = 0
        }

        // Center pulsing circle — أكبر
        const pulse = isPlaying ? Math.sin(phase * 2) * 0.2 + 0.8 : 0.5
        ctx!.beginPath()
        ctx!.arc(cx, cy, radius * 0.2 * pulse, 0, Math.PI * 2)
        const centerGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.2 * pulse)
        centerGrad.addColorStop(0, `rgba(232, 197, 71, ${0.15 * pulse})`)
        centerGrad.addColorStop(0.6, `rgba(232, 197, 71, ${0.05 * pulse})`)
        centerGrad.addColorStop(1, 'rgba(232, 197, 71, 0)')
        ctx!.fillStyle = centerGrad
        ctx!.fill()

      // ── FIRE MODE (مكبر) ──
      } else if (renderType === 'fire') {
        // Bottom-up fire bars — أوسع
        const barW = w / bars
        for (let i = 0; i < bars; i++) {
          const val = data[i]
          const barH = Math.max(3, val * h * 0.8)
          const x = i * barW
          const y = h - barH
          const grad = ctx!.createLinearGradient(0, y, 0, h)
          grad.addColorStop(0, `rgba(255, 200, 50, ${0.5 + val * 0.4})`)
          grad.addColorStop(0.3, `rgba(255, 100, 30, ${0.4 + val * 0.3})`)
          grad.addColorStop(0.7, `rgba(180, 40, 40, ${0.2 + val * 0.2})`)
          grad.addColorStop(1, `rgba(80, 0, 0, 0)`)
          ctx!.fillStyle = grad
          ctx!.fillRect(x, y, barW - 0.3, barH)
        }

        // Particles — أكتر وأكبر
        for (const p of particles) {
          if (isPlaying) {
            p.y += p.vy * (0.6 + data[Math.floor(Math.random() * bars)] * 3)
            p.x += p.vx * (Math.random() - 0.5) * 1.5
          } else {
            p.y *= 0.99
            p.x *= 0.999
          }
          if (p.y < -10) { p.y = h + 15; p.x = Math.random() * w }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2)
          const sparkAlpha = isPlaying ? Math.min(0.8, 0.3 + Math.random() * 0.5) : 0.05
          ctx!.fillStyle = `rgba(255, ${150 + Math.floor(Math.random() * 80)}, ${50 + Math.floor(Math.random() * 60)}, ${sparkAlpha})`
          ctx!.shadowColor = 'rgba(255, 150, 50, 0.3)'
          ctx!.shadowBlur = 6
          ctx!.fill()
          ctx!.shadowBlur = 0
        }

      // ── AURORA MODE (مكبرة) ──
      } else if (renderType === 'aurora') {
        // Aurora layers — 4 بدل 3، أوسع
        for (let layer = 0; layer < 4; layer++) {
          ctx!.beginPath()
          ctx!.moveTo(0, h)
          for (let i = 0; i <= bars; i++) {
            const x = (i / bars) * w
            const amp = data[Math.min(i, bars - 1)] * h * 0.35 * (0.3 + layer * 0.3)
            const y = h * (0.3 + layer * 0.18) + Math.sin((i / bars) * Math.PI * 4 + phase * (1 + layer * 0.6)) * amp
            ctx!.lineTo(x, y)
          }
          ctx!.lineTo(w, h)
          ctx!.closePath()
          const alpha = 0.05 + layer * 0.035
          const colors = [
            `rgba(232, 197, 71, ${alpha})`,
            `rgba(150, 220, 255, ${alpha * 1.2})`,
            `rgba(200, 100, 255, ${alpha * 1.1})`,
            `rgba(100, 255, 200, ${alpha * 0.8})`,
          ]
          ctx!.fillStyle = colors[layer]
          ctx!.fill()
        }

        // Sparkles — ضعف العدد
        for (let i = 0; i < 40; i++) {
          const sx = (Math.sin(phase * 0.5 + i * 1.3) + 1) * 0.5 * w
          const sy = (Math.cos(phase * 0.3 + i * 1.9) + 1) * 0.45 * h + h * 0.05
          const sr = Math.random() * 2.5 + 1
          ctx!.beginPath()
          ctx!.arc(sx, sy, sr, 0, Math.PI * 2)
          const sa = 0.1 + Math.abs(Math.sin(phase * 1.5 + i * 2)) * 0.3
          ctx!.fillStyle = `rgba(255, 255, 255, ${sa})`
          ctx!.shadowColor = `rgba(232, 197, 71, ${sa * 0.5})`
          ctx!.shadowBlur = 10
          ctx!.fill()
          ctx!.shadowBlur = 0
        }

        // Shooting stars إضافية
        if (isPlaying) {
          for (let i = 0; i < 3; i++) {
            const t = (phase + i * 2.1) % (Math.PI * 2)
            const ssx = ((t / (Math.PI * 2)) * w + phase * 10) % w
            const ssy = Math.sin(t * 3) * h * 0.15 + h * 0.15
            ctx!.beginPath()
            ctx!.arc(ssx, ssy, 2, 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.sin(t) * 0.15})`
            ctx!.fill()
          }
        }

      // ── PLASMA MODE ──
      } else if (renderType === 'plasma') {
        const imgData = ctx!.createImageData(w, h)
        const d = imgData.data
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            const val = Math.sin(x * 0.02 + phase) + Math.sin(y * 0.03 + phase * 1.3) + Math.sin((x + y) * 0.015 + phase * 0.7)
            const norm = (val / 3 + 0.5) * (0.4 + data[Math.floor(x / w * bars)] * 0.5)
            d[i] = 180 + Math.sin(norm * 8 + phase * 0.5) * 75      // R
            d[i+1] = 100 + Math.sin(norm * 7 + phase * 0.7 + 2) * 60 // G
            d[i+2] = 255 - Math.sin(norm * 6 + phase * 0.9 + 4) * 80 // B
            d[i+3] = 160 + Math.sin(x * 0.01 + y * 0.01 + phase * 0.3) * 60
          }
        }
        ctx!.putImageData(imgData, 0, 0)

      // ── RINGS MODE ──
      } else if (renderType === 'rings') {
        const cx = w / 2
        const cy = h / 2
        const maxR = Math.sqrt(w * w + h * h) / 2

        for (let ring = 0; ring < 6; ring++) {
          const baseR = (ring / 6) * maxR * 0.8 + 20
          const pulse = Math.sin(phase * 2 + ring * 1.2) * 20 + 20
          const r = baseR + pulse * data[Math.floor(ring * (bars / 6))]

          ctx!.beginPath()
          ctx!.arc(cx, cy, r, 0, Math.PI * 2)
          const ringAlpha = 0.08 + data[Math.floor(ring * (bars / 6))] * 0.4
          ctx!.strokeStyle = `rgba(232, 197, 71, ${ringAlpha})`
          ctx!.lineWidth = 2 + data[Math.floor(ring * (bars / 6))] * 6
          ctx!.shadowColor = `rgba(232, 197, 71, ${ringAlpha * 0.3})`
          ctx!.shadowBlur = 15
          ctx!.stroke()
          ctx!.shadowBlur = 0
        }

        // Center glow
        const centerPulse = isPlaying ? Math.sin(phase * 2) * 0.3 + 0.7 : 0.3
        const grd = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 60)
        grd.addColorStop(0, `rgba(232, 197, 71, ${0.08 * centerPulse})`)
        grd.addColorStop(0.5, `rgba(232, 197, 71, ${0.03 * centerPulse})`)
        grd.addColorStop(1, 'rgba(232, 197, 71, 0)')
        ctx!.fillStyle = grd
        ctx!.fillRect(cx - 60, cy - 60, 120, 120)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
      if (!isPlaying && audioCtx) {
        audioCtx.close()
        audioCtx = null
        analyser = null
        source = null
      }
    }
  }, [type, isPlaying, volume, currentTrack?.id, height])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-2xl"
      style={{ minHeight: `${height}px` }}
    />
  )
}
