import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // State
  const isDark = ref(false)
  const colorScheme = ref('auto') // 'light', 'dark', 'auto'
  const accentColor = ref('blue') // 'blue', 'green', 'purple', 'orange'

  // Getters
  const currentTheme = computed(() => {
    if (colorScheme.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return colorScheme.value
  })

  const themeClasses = computed(() => {
    return {
      dark: currentTheme.value === 'dark',
      [`accent-${accentColor.value}`]: true
    }
  })

  // Actions
  const setColorScheme = (scheme) => {
    colorScheme.value = scheme
    localStorage.setItem('theme-color-scheme', scheme)
    applyTheme()
  }

  const setAccentColor = (color) => {
    accentColor.value = color
    localStorage.setItem('theme-accent-color', color)
    applyTheme()
  }

  const toggleDark = () => {
    console.log('[Theme] Toggle dark mode clicked')
    console.log('[Theme] Current theme:', currentTheme.value)
    const newScheme = currentTheme.value === 'dark' ? 'light' : 'dark'
    console.log('[Theme] New scheme:', newScheme)
    setColorScheme(newScheme)
  }

  // Alias for backwards compatibility
  const toggleTheme = toggleDark

  const applyTheme = () => {
    const root = document.documentElement
    const theme = currentTheme.value

    console.log('[Theme] Applying theme:', theme)
    console.log('[Theme] Root element classes before:', root.className)

    // Apply dark/light theme
    if (theme === 'dark') {
      root.classList.add('dark')
      isDark.value = true
    } else {
      root.classList.remove('dark')
      isDark.value = false
    }

    console.log('[Theme] Root element classes after:', root.className)
    console.log('[Theme] isDark state:', isDark.value)

    // Apply accent color
    root.classList.remove('accent-blue', 'accent-green', 'accent-purple', 'accent-orange')
    root.classList.add(`accent-${accentColor.value}`)

    // Set meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff')
    } else {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = theme === 'dark' ? '#0f172a' : '#ffffff'
      document.head.appendChild(meta)
    }
  }

  const initializeTheme = () => {
    // Load saved preferences
    const savedColorScheme = localStorage.getItem('theme-color-scheme')
    const savedAccentColor = localStorage.getItem('theme-accent-color')

    if (savedColorScheme) {
      colorScheme.value = savedColorScheme
    }

    if (savedAccentColor) {
      accentColor.value = savedAccentColor
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (colorScheme.value === 'auto') {
        applyTheme()
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    // Apply initial theme
    applyTheme()

    // Watch for changes
    watch(colorScheme, applyTheme)
    watch(accentColor, applyTheme)
  }

  const getSystemPreference = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const exportTheme = () => {
    return {
      colorScheme: colorScheme.value,
      accentColor: accentColor.value
    }
  }

  const importTheme = (theme) => {
    if (theme.colorScheme) {
      setColorScheme(theme.colorScheme)
    }
    if (theme.accentColor) {
      setAccentColor(theme.accentColor)
    }
  }

  return {
    // State
    isDark,
    colorScheme,
    accentColor,

    // Getters
    currentTheme,
    themeClasses,

    // Actions
    setColorScheme,
    setAccentColor,
    toggleDark,
    toggleTheme, // Alias for toggleDark
    applyTheme,
    initializeTheme,
    getSystemPreference,
    exportTheme,
    importTheme
  }
})