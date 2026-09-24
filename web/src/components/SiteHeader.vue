<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '@/api'
import type { Category, NavMenuType, PublicNavItem, Tag } from '@/types'
import { useThemeStore } from '@/stores/theme'
import { useSiteStore } from '@/stores/site'
import { useNavStore } from '@/stores/nav'
import MusicPlayer from '@/components/MusicPlayer.vue'

const theme = useThemeStore()
const site = useSiteStore()
const navStore = useNavStore()
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const expandedMobile = ref<number | null>(null)
const scrolled = ref(false)
const keyword = ref('')

const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])

interface RenderItem {
  id: number
  label: string
  type: NavMenuType
  to: string
  url: string
  openNewTab: boolean
  children: RenderItem[]
}

function toRender(item: PublicNavItem): RenderItem {
  return {
    id: item.id,
    label: item.label,
    type: item.type,
    to: item.to,
    url: item.url,
    openNewTab: item.open_new_tab,
    children: item.children.map(toRender),
  }
}

/** 数据库导航 + 内置页面的动态二级（分类/标签） */
const items = computed<RenderItem[]>(() =>
  navStore.tree.map((item) => {
    const node = toRender(item)
    if (item.type === 'system' && item.to === '/categories') {
      node.children = categories.value.map((c) => ({
        id: c.id,
        label: c.name,
        type: 'system' as NavMenuType,
        to: `/category/${c.slug}`,
        url: '',
        openNewTab: false,
        children: [],
      }))
    }
    if (item.type === 'system' && item.to === '/tags') {
      node.children = [...tags.value]
        .sort((a, b) => (b.post_count ?? 0) - (a.post_count ?? 0))
        .slice(0, 8)
        .map((t) => ({
          id: t.id,
          label: t.name,
          type: 'system' as NavMenuType,
          to: `/tag/${t.slug}`,
          url: '',
          openNewTab: false,
          children: [],
        }))
    }
    return node
  }),
)

const PATH_PREFIXES: Record<string, string[]> = {
  '/categories': ['/categories', '/category'],
  '/tags': ['/tags', '/tag'],
}

function pathMatches(to: string): boolean {
  const list = PATH_PREFIXES[to] ?? [to]
  return list.some((m) => (m === '/' ? route.path === '/' : route.path === m || route.path.startsWith(m + '/')))
}

function isActive(item: RenderItem): boolean {
  if (item.type === 'link') return false
  if (item.type === 'group') return item.children.some((c) => pathMatches(c.to))
  return pathMatches(item.to)
}

function toggleMobile(item: RenderItem) {
  expandedMobile.value = expandedMobile.value === item.id ? null : item.id
}

function onScroll() {
  scrolled.value = window.scrollY > 12
}

function toggleTheme(e: MouseEvent) {
  theme.toggle({ x: e.clientX, y: e.clientY })
}

function submitSearch() {
  const q = keyword.value.trim()
  if (!q) return
  mobileOpen.value = false
  router.push({ path: '/search', query: { q } })
  keyword.value = ''
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  navStore.fetch()
  publicApi.categories().then((list) => (categories.value = list)).catch(() => {})
  publicApi.tags().then((list) => (tags.value = list)).catch(() => {})
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b bg-white/75 backdrop-blur-xl transition-all duration-300 dark:bg-slate-950/75"
    :class="scrolled ? 'border-slate-200/80 shadow-soft dark:border-slate-800 dark:shadow-black/20' : 'border-transparent'"
  >
    <div class="container-page flex h-16 items-center justify-between gap-4">
      <router-link to="/" class="group flex items-center gap-2.5">
        <img
          :src="site.info.site_logo || '/favicon.ico'"
          alt="logo"
          class="h-8 w-8 rounded-lg object-contain transition-all duration-500 group-hover:rotate-[20deg] group-hover:scale-110 group-active:scale-95"
        />
        <span class="text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
          {{ site.info.site_title }}
        </span>
      </router-link>

      <nav class="hidden items-center gap-2.5 md:flex">
        <div v-for="item in items" :key="item.id" class="group/nav relative">
          <!-- 外链：新标签打开 -->
          <a
            v-if="item.type === 'link'"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group/link relative flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
          >
            {{ item.label }}
            <svg class="h-3 w-3 opacity-60" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M14 4h6v6m0-6-9 9m-1 7H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="absolute inset-x-4 -bottom-px h-0.5 origin-left scale-x-0 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-transform duration-300 group-hover/link:scale-x-100" />
          </a>

          <!-- 无子级的分组：纯展示 -->
          <span
            v-else-if="item.type === 'group' && !item.children.length"
            class="cursor-default rounded-lg px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500"
          >
            {{ item.label }}
          </span>

          <!-- 内部路由（系统页/单页/含子菜单的分组） -->
          <router-link
            v-else
            :to="item.to"
            class="group/link relative flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            :class="isActive(item) ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400'"
          >
            {{ item.label }}
            <svg
              v-if="item.children.length"
              class="h-3 w-3 transition-transform duration-300 group-hover/nav:rotate-180"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span
              v-if="item.type !== 'group'"
              class="absolute inset-x-4 -bottom-px h-0.5 origin-left scale-x-0 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-transform duration-300 group-hover/link:scale-x-100"
              :class="{ 'scale-x-100': isActive(item) }"
            />
          </router-link>

          <!-- 二级菜单 -->
          <div
            v-if="item.children.length"
            class="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-hover/nav:visible group-hover/nav:opacity-100"
          >
            <div class="card min-w-44 overflow-hidden p-1.5 shadow-lift">
              <template v-for="child in item.children" :key="child.id">
                <a
                  v-if="child.type === 'link'"
                  :href="child.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  <span class="truncate">{{ child.label }}</span>
                  <svg class="h-3 w-3 shrink-0 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M14 4h6v6m0-6-9 9m-1 7H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
                <router-link
                  v-else
                  :to="child.to"
                  class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  <span class="truncate">{{ child.label }}</span>
                </router-link>
              </template>
            </div>
          </div>
        </div>
      </nav>

      <div class="flex items-center gap-1">
        <form class="relative hidden items-center lg:flex" @submit.prevent="submitSearch">
          <svg
            class="pointer-events-none absolute left-3 h-4 w-4 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" stroke-linecap="round" />
          </svg>
          <input
            v-model="keyword"
            type="search"
            placeholder="搜索文章..."
            aria-label="搜索文章"
            class="w-40 rounded-xl border border-transparent bg-slate-100 py-1.5 pl-9 pr-3 text-sm transition-all duration-300 placeholder-slate-400 focus:w-56 focus:border-brand-400 focus:bg-white focus:shadow-glow focus:outline-none dark:bg-slate-800 dark:focus:bg-slate-900"
          />
        </form>

        <MusicPlayer />

        <button
          class="btn-ghost h-9 w-9 rounded-xl p-0 transition-transform hover:rotate-12 active:scale-90"
          :title="theme.theme === 'dark' ? '切换到浅色' : '切换到深色'"
          @click="toggleTheme"
        >
          <transition
            enter-active-class="transition-all duration-300"
            enter-from-class="rotate-90 scale-0 opacity-0"
            enter-to-class="rotate-0 scale-100 opacity-100"
            leave-active-class="transition-all duration-150"
            leave-from-class="rotate-0 scale-100 opacity-100"
            leave-to-class="-rotate-90 scale-0 opacity-0"
            mode="out-in"
          >
            <svg v-if="theme.theme === 'dark'" key="sun" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" stroke-linecap="round" />
            </svg>
            <svg v-else key="moon" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </transition>
        </button>

        <button class="btn-ghost h-9 w-9 rounded-xl p-0 md:hidden" @click="mobileOpen = !mobileOpen">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path v-if="!mobileOpen" d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
            <path v-else d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="max-h-0 opacity-0"
      enter-to-class="max-h-[32rem] opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="max-h-[32rem] opacity-100"
      leave-to-class="max-h-0 opacity-0"
    >
      <div v-if="mobileOpen" class="overflow-hidden border-t border-slate-200/70 px-4 py-3 md:hidden dark:border-slate-800">
        <nav class="flex flex-col gap-1">
          <template v-for="item in items" :key="item.id">
            <!-- 外链 -->
            <a
              v-if="item.type === 'link'"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-400"
              @click="mobileOpen = false"
            >
              {{ item.label }}
              <svg class="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M14 4h6v6m0-6-9 9m-1 7H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>

            <!-- 分组（手风琴） -->
            <div v-else-if="item.children.length" class="rounded-lg">
              <div class="flex items-center">
                <router-link
                  :to="item.to"
                  class="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                  :class="isActive(item) ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-400'"
                  @click="mobileOpen = false"
                >
                  {{ item.label }}
                </router-link>
                <button
                  class="rounded-lg p-2.5 text-slate-400 transition-colors hover:text-brand-500"
                  :aria-expanded="expandedMobile === item.id"
                  @click="toggleMobile(item)"
                >
                  <svg
                    class="h-4 w-4 transition-transform duration-300"
                    :class="{ 'rotate-180': expandedMobile === item.id }"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
              <transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="max-h-0 opacity-0"
                enter-to-class="max-h-80 opacity-100"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="max-h-80 opacity-100"
                leave-to-class="max-h-0 opacity-0"
              >
                <div v-if="expandedMobile === item.id" class="overflow-hidden">
                  <template v-for="child in item.children" :key="child.id">
                    <a
                      v-if="child.type === 'link'"
                      :href="child.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center justify-between rounded-lg py-2 pl-8 pr-3 text-sm text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                      @click="mobileOpen = false"
                    >
                      <span class="truncate">{{ child.label }}</span>
                      <svg class="h-3 w-3 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M14 4h6v6m0-6-9 9m-1 7H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </a>
                    <router-link
                      v-else
                      :to="child.to"
                      class="block rounded-lg py-2 pl-8 pr-3 text-sm text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                      @click="mobileOpen = false"
                    >
                      {{ child.label }}
                    </router-link>
                  </template>
                </div>
              </transition>
            </div>

            <!-- 普通内部链接 -->
            <router-link
              v-else
              :to="item.to"
              class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:pl-4 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-400"
              @click="mobileOpen = false"
            >
              {{ item.label }}
            </router-link>
          </template>
          <form class="relative mt-2 flex gap-2" @submit.prevent="submitSearch">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" stroke-linecap="round" />
            </svg>
            <input v-model="keyword" type="search" placeholder="搜索文章..." aria-label="搜索文章" class="input flex-1 pl-9" />
            <button type="submit" class="btn-primary">搜索</button>
          </form>
        </nav>
      </div>
    </transition>
  </header>
</template>
