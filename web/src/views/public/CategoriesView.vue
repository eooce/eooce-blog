<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { publicApi } from '@/api'
import type { Category } from '@/types'
import CoverPlaceholder from '@/components/CoverPlaceholder.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'

const categories = ref<Category[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    categories.value = await publicApi.categories()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-page py-10">
    <PageHeader title="文章分类" eyebrow="Categories" description="按主题领域浏览全部内容" />

    <div v-if="loading" class="grid gap-6 sm:grid-cols-2">
      <div v-for="i in 4" :key="i" class="card h-32 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <div v-else-if="categories.length" class="grid gap-6 sm:grid-cols-2">
      <router-link
        v-for="(cat, i) in categories"
        :key="cat.id"
        v-reveal="Math.min(i * 80, 400)"
        :to="`/category/${cat.slug}`"
        class="card group relative flex items-center gap-5 overflow-hidden p-5 hover:-translate-y-1.5 hover:shadow-lift"
      >
        <span
          class="pointer-events-none absolute inset-y-0 w-1/2 -translate-x-[130%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-brand-100/60 to-transparent transition-transform duration-1000 group-hover:translate-x-[300%] dark:via-brand-500/10"
          aria-hidden="true"
        />
        <div class="h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-soft">
          <CoverPlaceholder :slug="cat.slug" :text="cat.name" class="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" />
        </div>
        <div class="min-w-0">
          <h2 class="flex items-center gap-1.5 text-lg font-bold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
            {{ cat.name }}
            <svg
              class="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </h2>
          <p class="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{{ cat.description || '暂无描述' }}</p>
          <p class="mt-2 text-xs font-medium text-brand-500">{{ cat.post_count ?? 0 }} 篇文章</p>
        </div>
      </router-link>
    </div>

    <EmptyState v-else title="暂无分类" />
  </div>
</template>
