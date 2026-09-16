import { defineStore } from 'pinia'

type Theme = 'light' | 'dark'
const THEME_KEY = 'blog_theme'

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: initialTheme() as Theme,
  }),
  actions: {
    apply() {
      document.documentElement.classList.toggle('dark', this.theme === 'dark')
    },
    /** 普通切换（无过渡），供启动等场景使用 */
    set(theme: Theme) {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
      this.apply()
    },
    /** 带圆形扩散动画的切换（View Transitions API，不支持时优雅降级） */
    toggle(origin?: { x: number; y: number }) {
      const next: Theme = this.theme === 'dark' ? 'light' : 'dark'
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const startViewTransition = (document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> }
      }).startViewTransition

      if (!startViewTransition || reduced || !origin) {
        this.set(next)
        return
      }

      const transition = startViewTransition.call(document, () => this.set(next))
      transition.ready.then(() => {
        const radius = Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y),
        )
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`],
          },
          {
            duration: 550,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
    },
  },
})
