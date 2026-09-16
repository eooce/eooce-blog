import { defineStore } from 'pinia'
import { publicApi } from '@/api'
import type { SiteInfo } from '@/types'

const CACHE_KEY = 'blog_site_cache'

// 默认值为空：站点信息未加载完成前不显示任何占位文字，避免刷新时闪烁错误标题
const DEFAULT_SITE: SiteInfo = {
  site_title: '',
  site_subtitle: '',
  about_content: '',
}

/** 读取上次成功获取的站点信息，刷新时首屏即可显示正确内容 */
function cachedSite(): SiteInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SiteInfo
    return parsed && typeof parsed.site_title === 'string' ? parsed : null
  } catch {
    return null
  }
}

export const useSiteStore = defineStore('site', {
  state: () => ({
    info: (cachedSite() ?? { ...DEFAULT_SITE }) as SiteInfo,
    loaded: false,
  }),
  actions: {
    async fetch(retries = 2): Promise<void> {
      if (this.loaded) return
      try {
        const info = await publicApi.site()
        this.info = { ...DEFAULT_SITE, ...info }
        this.loaded = true
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(this.info))
        } catch {
          /* 存储不可用时忽略 */
        }
      } catch {
        // 瞬态失败（如代理重连）时短暂等待后重试，避免长时间显示默认标题
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 800))
          return this.fetch(retries - 1)
        }
      }
    },
    /** 强制重新拉取（后台保存站点设置后调用） */
    async reload() {
      this.loaded = false
      await this.fetch()
    },
  },
})