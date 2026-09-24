<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { publicApi } from '@/api'
import type { FriendLink } from '@/types'
import { useSiteStore } from '@/stores/site'
import { useNavStore } from '@/stores/nav'

const site = useSiteStore()
const navStore = useNavStore()
const year = new Date().getFullYear()

const links = ref<FriendLink[]>([])

/** 页脚导航：取数据库菜单的顶层页面项（分组类不展开，外链仅在顶部导航展示） */
const footerNavs = computed(() => {
  const out: Array<{ label: string; to: string; external: string }> = []
  for (const item of navStore.tree) {
    if (item.type === 'group') continue
    if (item.type === 'link' && item.url) {
      out.push({ label: item.label, to: '', external: item.url })
    } else if (item.to) {
      out.push({ label: item.label, to: item.to, external: '' })
    }
  }
  return out
})

/** 备案信息：文字为空或后台关闭显示则该条不出现（两条都为空的整体也不渲染） */
const beianItems = computed(() => {
  const info = site.info
  const items: Array<{ key: string; text: string; url: string; police: boolean }> = []
  if (info.icp_text && info.icp_visible !== '0') {
    items.push({ key: 'icp', text: info.icp_text, url: info.icp_url ?? '', police: false })
  }
  if (info.police_text && info.police_visible !== '0') {
    items.push({ key: 'police', text: info.police_text, url: info.police_url ?? '', police: true })
  }
  return items
})

onMounted(async () => {
  navStore.fetch()
  try {
    links.value = await publicApi.links()
  } catch {
    links.value = []
  }
})
</script>

<template>
  <footer class="relative mt-8">
    <div class="gradient-line" aria-hidden="true" />
    <div class="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden" aria-hidden="true">
      <div class="absolute -top-28 left-1/4 h-56 w-56 rounded-full bg-brand-300/15 blur-3xl dark:bg-brand-500/10" />
      <div class="absolute -top-24 right-1/4 h-48 w-48 rounded-full bg-accent-300/20 blur-3xl dark:bg-accent-500/10" />
    </div>

    <div class="container-page relative py-12">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <router-link to="/" class="group inline-flex items-center gap-2.5">
            <img
              :src="site.info.site_logo || '/favicon.ico'"
              alt="logo"
              class="h-9 w-9 rounded-lg object-contain transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110"
            />
            <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{{ site.info.site_title }}</span>
          </router-link>
          <p class="mt-3 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {{ site.info.site_subtitle }}
          </p>
          <p class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            记录不息 · 笔耕不辍
          </p>
        </div>

        <div>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">导航</h3>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-2">
            <li v-for="nav in footerNavs" :key="nav.label + nav.to + nav.external">
              <a
                v-if="nav.external"
                :href="nav.external"
                target="_blank"
                rel="noopener noreferrer"
                class="group inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                <span class="h-px w-0 bg-brand-500 transition-all duration-300 group-hover:w-3" aria-hidden="true" />
                {{ nav.label }}
              </a>
              <router-link
                v-else
                :to="nav.to"
                class="group inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                <span class="h-px w-0 bg-brand-500 transition-all duration-300 group-hover:w-3" aria-hidden="true" />
                {{ nav.label }}
              </router-link>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">订阅</h3>
          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            每一篇新文章都会同步更新在首页，欢迎常来逛逛。
          </p>
          <router-link to="/archives" class="btn-outline mt-4 !py-1.5 text-xs">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-5 4h5M5 9h5" stroke-linecap="round" />
              <path d="m3 7 9 6 9-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            浏览全部文章
          </router-link>
        </div>
      </div>

      <!-- 友情链接 -->
      <div v-if="links.length" class="mt-10 border-t border-slate-200/70 pt-6 dark:border-slate-800">
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          友情链接
        </h3>
        <ul class="flex flex-wrap gap-x-5 gap-y-2">
          <li v-for="link in links" :key="link.id">
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="link.description || link.name"
              class="group inline-flex items-center gap-1 text-sm text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
            >
              {{ link.name }}
            </a>
          </li>
        </ul>
      </div>

      <div class="mt-10 grid gap-3 border-t border-slate-200/70 pt-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center dark:border-slate-800">
        <p class="text-center text-xs text-slate-400 sm:text-left dark:text-slate-500">
          © {{ year }} {{ site.info.site_title }} · Powered by
          <a
            href="https://github.com/eooce/eooce-blog"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-brand-500 hover:decoration-brand-400 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-brand-400"
          >
            eooce
          </a>
        </p>

        <div
          class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
          :class="beianItems.length ? '' : 'hidden sm:flex'"
        >
          <a
            v-for="item in beianItems"
            :key="item.key"
            :href="item.url || undefined"
            :target="item.url ? '_blank' : undefined"
            :rel="item.url ? 'noopener noreferrer' : undefined"
            class="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors dark:text-slate-500"
            :class="item.url ? 'hover:text-brand-500 dark:hover:text-brand-400' : ''"
            :title="item.police ? '全国互联网安全管理服务平台' : '工业和信息化部政务服务平台'"
          >
            <svg v-if="item.police" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6l7-3Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ item.text }}
          </a>
        </div>

        <p class="text-center text-xs text-slate-400 sm:text-right dark:text-slate-500">
          用 <span class="text-rose-500">♥</span> 编写，与代码一同成长
        </p>
      </div>
    </div>
  </footer>
</template>