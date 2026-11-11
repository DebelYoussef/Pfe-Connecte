import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const value = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', value)
    setDark(value)
  }, [])

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? <Sun className="theme-icon" size={18} /> : <Moon className="theme-icon" size={18} />}
    </button>
  )
}
