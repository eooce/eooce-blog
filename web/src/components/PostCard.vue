<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { PostItem } from '@/types'
import CoverPlaceholder from './CoverPlaceholder.vue'

const props = defineProps<{ post: PostItem }>()
const formatDate = (d: string | null) => (d ? dayjs(d).format('YYYY-MM-DD') : '')

// 封面图加载失败时回退为渐变占位图
const coverBroken = ref(false)
const coverSrc = computed(() => (props.post.cover_image && !coverBroken.value ? props.post.cover_image : ''))
</script>

<template>
  <article class="card group flex h-full flex-col overflow-hidden hover:-translate-y-1.5 hover:shadow-lift">
    <router-link :to="`/post/${post.slug}`" class="relative block aspect-[21/9] overflow-hidden">
      <img
        v-if="coverSrc"
        :src="coverSrc"
        :alt="post.title"
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        @error="coverBroken = true"
      />
      <CoverPlaceholder v-else :slug="post.slug" :text="post.title" class="transition-transform duration-700 group-hover:scale-110" />
      <!-- 光泽扫过 -->
      <span
        class="pointer-events-none absolute inset-y-0 w-1/2 -translate-x-[120%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[320%]"
        aria-hidden="true"
      />
    </router-link>
    <div class="flex flex-1 flex-col gap-3 p-5">
      <div class="flex items-center gap-2 text-xs">
        <router-link
          v-if="post.category_name"
          :to="`/category/${post.category_slug}`"
          class="badge bg-brand-50 text-brand-600 transition-all duration-300 hover:bg-brand-100 hover:shadow-soft dark:bg-brand-500/10 dark:text-brand-400"
        >
          {{ post.category_name }}
        </router-link>
        <span v-if="post.pinned" class="badge bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">置顶</span>
        <span class="ml-auto text-slate-400 dark:text-slate-500">{{ formatDate(post.published_at) }}</span>
      </div>

      <router-link :to="`/post/${post.slug}`">
        <h2
          class="flex items-start gap-1.5 text-lg font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400"
        >
          {{ post.title }}
          <svg
            class="mt-1.5 h-4 w-4 shrink-0 -translate-x-1.5 text-brand-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </h2>
      </router-link>

      <p class="line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{{ post.summary }}</p>

      <div class="mt-auto flex items-center justify-between pt-2 text-xs text-slate-400 dark:text-slate-500">
        <div class="flex flex-wrap gap-1.5">
          <router-link
            v-for="tag in post.tags.slice(0, 3)"
            :key="tag.slug"
            :to="`/tag/${tag.slug}`"
            class="rounded-md bg-slate-100 px-2 py-0.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
          >
            # {{ tag.name }}
          </router-link>
        </div>
        <span class="shrink-0">{{ post.reading_minutes }} 分钟 · {{ post.views }} 阅读</span>
      </div>
    </div>
  </article>
</template>
