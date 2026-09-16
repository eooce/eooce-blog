import { defineStore } from 'pinia'
import { publicApi } from '@/api'
import type { PublicNavItem } from '@/types'

export const DEFAULT_NAV: PublicNavItem[] = [
  { id: -1, label: '首页', type: 'system', to: '/', url: '', open_new_tab: false, children: [] },
  { id: -2, label: '分类', type: 'system', to: '/categories', url: '', open_new_tab: false, children: [] },
  { id: -3, label: '标签', type: 'system', to: '/tags', url: '', open_new_tab: false, children: [] },
  { id: -4, label: '归档', type: 'system', to: '/archives', url: '', open_new_tab: false, children: [] },
  { id: -5, label: '关于', type: 'system', to: '/about', url: '', open_new_tab: false, children: [] },
]

export const useNavStore = defineStore('nav', {
  state: () => ({
    tree: DEFAULT_NAV.map((n) => ({ ...n })) as PublicNavItem[],
    loaded: false,
  }),
  actions: {
    async fetch(retries = 2): Promise<void> {
      if (this.loaded) return
      try {
        const tree = await publicApi.nav()
        if (Array.isArray(tree) && tree.length) {
          this.tree = tree
          this.loaded = true
        }
      } catch {
        // 瞬态失败时短暂等待后重试
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 800))
          return this.fetch(retries - 1)
        }
      }
    },
    /** 后台修改菜单后强制刷新 */
    async reload() {
      this.loaded = false
      await this.fetch()
    },
  },
})
