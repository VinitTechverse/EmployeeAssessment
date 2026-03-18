import { useState, useEffect } from 'react'

const THEME_KEY = 'rt_theme'

/**
 * Shared theme hook — reads/writes localStorage, keeps <html data-theme> in sync.
 * Use in any component that needs theme state.
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}

/**
 * Reusable theme toggle button.
 * Pass className for positioning overrides.
 */
export function ThemeToggle({ theme, onToggle, className = '' }) {
  return (
    <button
      className={`theme-toggle-btn ${className}`}
      onClick={onToggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle colour theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
