/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './content/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#05060A',
        surface: '#0E1420',
        'surface-2': '#141C2C',
        edge: '#22304A',
        primary: '#22D3EE',
        secondary: '#7C3AED',
        cta: '#F43F5E',
        body: '#E8F0FF',
        muted: '#94A3B8',
        glow: '#FF00FF',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        shell: '80rem',
      },
      zIndex: {
        nav: '30',
        overlay: '40',
        modal: '50',
      },
      boxShadow: {
        'neon-primary': '0 0 0 1px rgba(34,211,238,0.5), 0 0 20px -4px rgba(34,211,238,0.6)',
        'neon-cta': '0 0 0 1px rgba(244,63,94,0.5), 0 0 24px -4px rgba(244,63,94,0.65)',
        'neon-secondary': '0 0 0 1px rgba(124,58,237,0.5), 0 0 20px -4px rgba(124,58,237,0.6)',
      },
      // Keyframes for the CRT/glitch effects live in app/globals.css, not here.
      // Tailwind only emits config keyframes when a matching `animate-*` class
      // appears in scanned markup, and those effects are driven from raw CSS
      // rules instead — so declaring them here would emit nothing.
      // Only Tailwind's built-in animate-spin and animate-pulse are used as
      // utilities (the form spinner and the loading skeleton).
    },
  },
  plugins: [],
};
