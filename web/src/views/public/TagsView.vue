<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { publicApi } from '@/api'
import type { Tag } from '@/types'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'

const tags = ref<Tag[]>([])
const loading = ref(true)

function fontSize(count: number | undefined): string {
  const c = count ?? 0
  return `${Math.min(2.2, Math.max(0.9, 0.9 + c * 0.25))}rem`
}

onMounted(async () => {
  try {
    tags.value = await publicApi.tags()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-page py-10">
    <PageHeader title="全部标签" eyebrow="Tags" description="标签字号随文章数量变化，点击标签查看相关文章" />

    <div v-if="loading" class="flex flex-wrap gap-3">
      <div v-for="i in 10" :key="i" class="h-9 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
    </div>

    <div v-else-if="tags.length" class="flex flex-wrap items-baseline gap-x-5 gap-y-4">
      <router-link
        v-for="(tag, i) in tags"
        :key="tag.id"
        v-reveal="Math.min(i * 40, 500)"
        :to="`/tag/${tag.slug}`"
        class="group rounded-lg px-1 font-bold text-slate-600 transition-all duration-300 hover:-translate-y-1 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
        :style="{ fontSize: fontSize(tag.post_count) }"
      >
        <span class="text-brand-400/70 transition-colors group-hover:text-brand-500">#</span>
        {{ tag.name }}
        <sup
          class="ml-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors group-hover:bg-brand-50 group-hover:text-brand-500 dark:bg-slate-800 dark:group-hover:bg-brand-500/10"
        >
          {{ tag.post_count }}
        </sup>
      </router-link>
    </div>

    <EmptyState v-else title="暂无标签" />
  </div>
</template>
