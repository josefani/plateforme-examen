import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glass: '0 20px 60px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        examen: {
          primary: '#0f172a',
          secondary: '#0369a1',
          accent: '#d97706',
          neutral: '#0f172a',
          'base-100': '#ffffff',
          'base-200': '#f8fafc',
          'base-300': '#e2e8f0',
          info: '#0284c7',
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
        },
      },
      'light',
    ],
  },
}
