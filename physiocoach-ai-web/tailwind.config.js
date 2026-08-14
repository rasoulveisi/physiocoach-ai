/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // ── Typography ──────────────────────────────────────────
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },

      // ── Colors ──────────────────────────────────────────────
      colors: {
        // ── Performance Volt — primary brand accent (electric green) ──
        // `brand` is kept as the alias so every existing `brand-*` class
        // adopts the new Volt system without touching component markup.
        brand: {
          50: '#eafff2',
          100: '#ccf9dc',
          200: '#99f2bc',
          300: '#5ee894',
          400: '#10e760', // Performance Volt (signature)
          500: '#22c55e', // deep green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },

        volt: {
          DEFAULT: '#10e760',
          bright: '#2bf27b',
          deep: '#22c55e',
          50: '#eafff2',
          100: '#ccf9dc',
          200: '#99f2bc',
          300: '#5ee894',
          400: '#10e760',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },

        // ── Obsidian — dark surface hierarchy (mobile-first shell) ──
        obsidian: {
          300: '#7a8aa5',
          400: '#55637d',
          500: '#3b4a63',
          600: '#2e3a4f',
          700: '#1f2937', // border
          800: '#181f2e', // raised surface
          900: '#121722', // surface-0
          950: '#090d15', // base background
        },

        // ── Physio Amber — secondary/highlight accent ──
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },

        // ── Ice Cyan — info/insight accent ──
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },

        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          900: '#064e3b',
          950: '#022c22',
        },
        warn: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          900: '#78350f',
          950: '#451a03',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        info: {
          50: '#ecfeff',
          100: '#cffafe',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          900: '#164e63',
          950: '#083344',
        },

        // ── Semantic CSS-var-backed tokens ────────────────────
        // These map Tailwind class names → CSS custom properties
        // so `bg-surface-0`, `text-primary`, `border-surface` etc. all work.
        surface: {
          bg: 'var(--color-surface-bg)',
          0: 'var(--color-surface-0)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
          border: 'var(--color-surface-border)',
          muted: 'var(--color-surface-muted)',
        },
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        inverse: 'var(--color-text-inverse)',

        // Semantic state surfaces (token-backed, dark-mode-aware)
        'success-surface': 'var(--color-success-bg)',
        'success-border': 'var(--color-success-border)',
        'success-text': 'var(--color-success-text)',
        'success-icon': 'var(--color-success-icon)',

        'warn-surface': 'var(--color-warn-bg)',
        'warn-border': 'var(--color-warn-border)',
        'warn-text': 'var(--color-warn-text)',

        'danger-surface': 'var(--color-danger-bg)',
        'danger-border': 'var(--color-danger-border)',
        'danger-text': 'var(--color-danger-text)',

        'info-surface': 'var(--color-info-bg)',
        'info-border': 'var(--color-info-border)',
        'info-text': 'var(--color-info-text)',
      },

      // ── Shadows ─────────────────────────────────────────────
      boxShadow: {
        xs: 'var(--shadow-xs)',
        card: 'var(--shadow-sm)',
        'card-md': 'var(--shadow-md)',
        'card-lg': 'var(--shadow-lg)',
        brand: '0 1px 3px 0 rgb(0 0 0 / 0.2)',
        'brand-lg': '0 4px 6px -1px rgb(0 0 0 / 0.3)',
        'brand-xl': '0 10px 15px -3px rgb(0 0 0 / 0.3)',
        glow: 'none',
        volt: '0 1px 3px 0 rgb(0 0 0 / 0.2)',
        'volt-lg': '0 4px 6px -1px rgb(0 0 0 / 0.3)',
      },

      // ── Border radius ───────────────────────────────────────
      borderRadius: {
        '4xl': '24px',
      },

      // ── Spacing / sizing extras ─────────────────────────────
      minWidth: {
        30: '7.5rem',
      },

      // ── Background size ──────────────────────────────────────
      backgroundSize: {
        '200%': '200% 200%',
      },

      // ── Keyframes & animations ───────────────────────────────
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-right': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px 0px rgb(16 231 96 / 0.3)' },
          '50%': { boxShadow: '0 0 40px 8px rgb(16 231 96 / 0.5)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'streak-bounce': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        skeleton: 'skeleton-pulse 1.5s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        'slide-right': 'slide-right 0.35s ease-out both',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'streak-bounce': 'streak-bounce 2s ease-in-out infinite',
        'fade-up-delayed': 'fade-up 0.5s 0.15s ease-out both',
      },
    },
  },
  plugins: [],
};
