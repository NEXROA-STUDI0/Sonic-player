/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sonic: {
          base: '#08090c',
          surface1: 'rgba(20,22,28,0.85)',
          surface2: 'rgba(30,33,42,0.9)',
          surface3: 'rgba(40,44,56,0.95)',
          textPrimary: '#f5f3ef',
          textMuted: '#9a968e',
          border: 'rgba(255,255,255,0.06)',
          glow: 'rgba(232,197,71,0.15)',
          accentDefault: '#e8c547',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spring-in': 'springIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'spring-out': 'springOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 20s linear infinite',
        'wave': 'wave 1.5s ease-in-out infinite',
      },
      keyframes: {
        springIn: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        springOut: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-10px) scale(0.95)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        rotateSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '16px',
      },
      boxShadow: {
        'glow': '0 0 40px rgba(232,197,71,0.15)',
        'glow-lg': '0 0 80px rgba(232,197,71,0.2)',
        'inner-glow': 'inset 0 0 40px rgba(232,197,71,0.05)',
        'card': '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
        'card-hover': '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,197,71,0.15)',
      },
    },
  },
  plugins: [],
}