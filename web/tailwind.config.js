/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'HarmonyOS Sans SC',
          'HarmonyOS Sans',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef5f4',
          100: '#d8e8e6',
          200: '#b3d1ce',
          300: '#88b5b2',
          400: '#5b9793',
          500: '#377c77',
          600: '#185a56',
          700: '#134c49',
          800: '#103d3b',
          900: '#0c2f2d',
          950: '#071f1e',
        },
        accent: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#fec9aa',
          300: '#fda575',
          400: '#fd8444',
          500: '#fd742d',
          600: '#ef5c15',
          700: '#c74710',
          800: '#9e3a12',
          900: '#7f3212',
        },
      },
      boxShadow: {
        soft: '0 2px 16px -4px rgb(15 23 42 / 0.08)',
        lift: '0 12px 32px -8px rgb(15 23 42 / 0.16)',
        glow: '0 0 24px -4px rgb(24 90 86 / 0.45)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(24px, -32px, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(-20px, 16px, 0) scale(0.94)' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(8px)', opacity: '0.5' },
        },
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        caret: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        eq: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '25%': { transform: 'scaleY(1)' },
          '45%': { transform: 'scaleY(0.5)' },
          '65%': { transform: 'scaleY(0.85)' },
          '85%': { transform: 'scaleY(0.4)' },
        },
      },
      animation: {
        float: 'float 14s ease-in-out infinite',
        'float-y': 'float-y 5s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        shimmer: 'shimmer 2.8s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 1.6s ease-in-out infinite',
        'ping-soft': 'ping-soft 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        caret: 'caret 1s steps(1) infinite',
        eq: 'eq 0.9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
