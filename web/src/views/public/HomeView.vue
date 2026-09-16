<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publicApi } from '@/api'
import type { PostItem, Tag } from '@/types'
import PostCard from '@/components/PostCard.vue'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'
import TypeWriter from '@/components/TypeWriter.vue'
import TagHoneycomb from '@/components/TagHoneycomb.vue'
import CoverPlaceholder from '@/components/CoverPlaceholder.vue'
import { useCountUp } from '@/composables/useCountUp'
import { useSiteStore } from '@/stores/site'

const site = useSiteStore()
const route = useRoute()
const posts = ref<PostItem[]>([])
const total = ref(0)
const categoryCount = ref(0)
const tagCount = ref(0)
const heroTags = ref<Tag[]>([])
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const loading = ref(true)

const featured = computed(() => posts.value[0])
const rest = computed(() => posts.value.slice(1))

// 特色文章封面加载失败时回退为渐变占位图（切换文章后重置）
const coverBroken = ref(false)
watch(featured, () => (coverBroken.value = false))

const statPosts = useCountUp(total)
const statCategories = useCountUp(categoryCount)
const statTags = useCountUp(tagCount)

async function load() {
  loading.value = true
  try {
    const data = await publicApi.posts({ page: page.value, pageSize: 10 })
    posts.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

watch(page, () => {
  load().then(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
})

onMounted(() => {
  site.fetch()
  load()
  publicApi.categories().then((list) => (categoryCount.value = list.length)).catch(() => {})
  publicApi.tags().then((list) => {
    tagCount.value = list.length
    heroTags.value = list
  }).catch(() => {})
})
</script>

<template>
  <div>
    <!-- ===================== Hero ===================== -->
    <section class="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800">
      <!-- 底色 -->
      <div class="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-accent-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
      <!-- 极光光斑（漂浮动画） -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="absolute -left-24 -top-24 h-96 w-96 animate-float rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
        <div
          class="absolute -right-16 top-10 h-80 w-80 animate-float rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-500/15"
          style="animation-delay: -4s; animation-duration: 17s"
        />
        <div
          class="absolute bottom-0 left-1/3 h-72 w-72 animate-float rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/15"
          style="animation-delay: -8s; animation-duration: 20s"
        />
      </div>
      <!-- 网格纹理 -->
      <div class="bg-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />

      <!-- 标签蜂窝（右侧空白区，xl 及以上显示；z-10 提升层级避免被内容容器拦截悬停） -->
      <div v-if="heroTags.length" class="absolute right-[6%] top-1/2 z-10 hidden -translate-y-1/2 xl:block">
        <TagHoneycomb :tags="heroTags" />
      </div>

      <div class="container-page relative pb-28 pt-20 sm:pb-36 sm:pt-28">
        <div v-reveal class="max-w-3xl">
          <p
            class="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/70 px-4 py-1.5 text-xs font-medium text-brand-600 shadow-soft backdrop-blur dark:border-brand-500/30 dark:bg-slate-900/60 dark:text-brand-400"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-brand-500" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            欢迎来到 老王Blog
          </p>

          <h1 class="text-4xl font-black leading-[1.3] tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.3] dark:text-white">
            记录
            <span class="gradient-text-animated">代码与文字的</span>
            <br class="hidden sm:block" />
            成长轨迹
          </h1>

          <p class="mt-6 flex flex-wrap items-baseline gap-x-1 text-base text-slate-500 sm:text-lg dark:text-slate-400">
            <span class="mr-2">在这里，我持续记录</span>
            <TypeWriter :words="['前端工程', '后端架构', '设计思考', '生活随想']" class="text-xl sm:text-2xl" />
          </p>

          <p class="mt-4 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base dark:text-slate-400">
            {{ site.info.site_subtitle }}
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <router-link to="/archives" class="btn-primary group">
              浏览全部文章
              <svg
                class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </router-link>
            <router-link to="/about" class="btn-outline">了解博主</router-link>
          </div>

          <!-- 数据统计（数字滚动） -->
          <dl class="mt-12 flex max-w-md items-stretch gap-8 sm:gap-12">
            <div v-for="stat in [
              { label: '文章', value: statPosts, to: '/archives' },
              { label: '分类', value: statCategories, to: '/categories' },
              { label: '标签', value: statTags, to: '/tags' },
            ]" :key="stat.label" class="group">
              <router-link :to="stat.to" class="block">
                <dt class="sr-only">{{ stat.label }}</dt>
                <dd class="text-3xl font-black tabular-nums text-slate-900 transition-colors group-hover:text-brand-600 sm:text-4xl dark:text-white dark:group-hover:text-brand-400">
                  {{ stat.value }}
                  <span class="text-lg font-bold text-brand-500">+</span>
                </dd>
                <dd class="mt-1 text-xs font-medium tracking-wider text-slate-400 transition-colors group-hover:text-brand-500">
                  {{ stat.label }}
                </dd>
              </router-link>
            </div>
          </dl>
        </div>
      </div>

      <!-- 滚动提示 -->
      <a
        href="#latest"
        class="absolute bottom-16 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-brand-500 sm:flex"
        aria-label="向下滚动查看文章"
      >
        <span class="text-[10px] font-medium uppercase tracking-[0.25em]">探索</span>
        <span class="flex h-8 w-5 items-start justify-center rounded-full border-2 border-current p-1">
          <span class="h-1.5 w-1 animate-bounce-soft rounded-full bg-current" />
        </span>
      </a>
    </section>

    <!-- ===================== 文章列表 ===================== -->
    <section id="latest" class="container-page py-12">
      <div v-reveal class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">最新文章</h2>
          <span class="mt-1.5 block h-1 w-10 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
        </div>
        <router-link
          to="/archives"
          class="group flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
        >
          共 {{ total }} 篇 · 查看归档
          <svg class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </router-link>
      </div>

      <div v-if="loading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="card h-72 animate-pulse bg-slate-100 dark:bg-slate-800" />
      </div>

      <template v-else-if="posts.length">
        <!-- 特色文章（首篇大卡片） -->
        <router-link
          v-if="featured && page === 1"
          v-reveal
          :to="`/post/${featured.slug}`"
          class="card group mb-6 grid overflow-hidden hover:-translate-y-1 hover:shadow-lift sm:grid-cols-5"
        >
          <div class="relative aspect-[21/9] overflow-hidden sm:aspect-auto sm:col-span-2">
            <div class="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
              <img
                v-if="featured.cover_image && !coverBroken"
                :src="featured.cover_image"
                :alt="featured.title"
                loading="lazy"
                class="h-full w-full object-cover"
                @error="coverBroken = true"
              />
              <CoverPlaceholder v-else :slug="featured.slug" :text="featured.title" />
            </div>
            <span class="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 shadow-soft backdrop-blur dark:bg-slate-900/80 dark:text-brand-400">
              最新
            </span>
          </div>
          <div class="relative flex flex-col justify-center gap-3 p-6 sm:col-span-3 sm:p-8">
            <div class="flex items-center gap-2 text-xs">
              <span v-if="featured.category_name" class="badge bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                {{ featured.category_name }}
              </span>
              <span class="text-slate-400">{{ featured.reading_minutes }} 分钟 · {{ featured.views }} 阅读</span>
            </div>
            <h3 class="text-xl font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-600 sm:text-2xl dark:text-white dark:group-hover:text-brand-400">
              {{ featured.title }}
            </h3>
            <p class="line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{{ featured.summary }}</p>
            <span class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
              阅读全文
              <svg class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
        </router-link>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(post, i) in (page === 1 ? rest : posts)"
            :key="post.id"
            v-reveal="Math.min(i * 70, 420)"
          >
            <PostCard :post="post" />
          </div>
        </div>
        <div v-reveal class="mt-10">
          <Pagination :page="page" :page-size="10" :total="total" @change="(p) => $router.push({ query: { page: p } })" />
        </div>
      </template>

      <EmptyState v-else title="还没有发布的文章" description="博主正在酝酿中，敬请期待" />
    </section>
  </div>
</template>
