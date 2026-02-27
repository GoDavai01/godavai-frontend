/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green:  '#0C5A3E',
          mid:    '#0E7A4F',
          accent: '#00D97E',
          glow:   '#00FFB2',
          deep:   '#064E3B',
          cyan:   '#00E5FF',
          purple: '#A855F7',
        },
        surface: {
          DEFAULT: '#F2F7F4',
          card:    'rgba(255,255,255,0.88)',
          glass:   'rgba(255,255,255,0.72)',
          dark:    '#041F15',
        },
      },
      fontFamily: {
        sora:    ['Sora', 'system-ui', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '22px',
        '4xl': '28px',
        '5xl': '36px',
      },
      boxShadow: {
        'glow':      '0 0 30px rgba(0,217,126,0.25), 0 0 60px rgba(0,217,126,0.10)',
        'glow-sm':   '0 0 16px rgba(0,217,126,0.20)',
        'glow-neon': '0 0 20px rgba(0,255,178,0.3), 0 0 40px rgba(0,255,178,0.15)',
        'float':     '0 12px 40px rgba(12,90,62,0.15), 0 4px 12px rgba(0,0,0,0.05)',
        'card':      '0 4px 24px rgba(12,90,62,0.06), 0 1px 4px rgba(0,0,0,0.03)',
        'deep':      '0 20px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)',
        'inner':     'inset 0 2px 6px rgba(0,0,0,0.04)',
        'color':     '0 8px 32px rgba(12,90,62,0.18)',
      },
      backdropBlur: {
        'xs':  '4px',
        'glass': '20px',
        'heavy': '40px',
      },
      animation: {
        'float':       'float 6s ease-in-out infinite',
        'float-slow':  'float 10s ease-in-out infinite',
        'glow-pulse':  'glowPulse 2.5s ease-in-out infinite',
        'mesh':        'meshShift 20s ease infinite',
        'shimmer':     'shimmer 1.5s ease-in-out infinite',
        'slide-up':    'slideUp 0.4s cubic-bezier(0.22,1,0.36,1)',
        'slide-down':  'slideDown 0.4s cubic-bezier(0.22,1,0.36,1)',
        'fade-in':     'fadeIn 0.3s ease-out',
        'scale-in':    'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'spin-slow':   'spin 3s linear infinite',
        'orb-float':   'orbFloat 8s ease-in-out infinite',
        'border-glow': 'borderRotate 4s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,217,126,0.2), 0 0 40px rgba(0,217,126,0.08)' },
          '50%':      { boxShadow: '0 0 30px rgba(0,217,126,0.35), 0 0 60px rgba(0,217,126,0.15)' },
        },
        meshShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '25%':      { backgroundPosition: '100% 50%' },
          '50%':      { backgroundPosition: '50% 100%' },
          '75%':      { backgroundPosition: '50% 0%' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        orbFloat: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':      { transform: 'translate(10px, -15px) scale(1.05)' },
          '66%':      { transform: 'translate(-8px, 10px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};
