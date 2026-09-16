<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ (e: 'change', page: number): void }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const pages = computed<(number | '...')[]>(() => {
  const t = totalPages.value
  const cur = props.page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const set = new Set<number>([1, t, cur, cur - 1, cur + 1])
  const list = Array.from(set)
    .filter((n) => n >= 1 && n <= t)
    .sort((a, b) => a - b)
  const result: (number | '...')[] = []
  let prev = 0
  for (const n of list) {
    if (n - prev > 1) result.push('...')
    result.push(n)
    prev = n
  }
  return result
})

function go(page: number) {
  if (page < 1 || page > totalPages.value || page === props.page) return
  emit('change', page)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="flex items-center justify-center gap-1.5" aria-label="分页">
    <button class="btn-outline !px-3" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
    <template v-for="(p, i) in pages" :key="`${p}-${i}`">
      <span v-if="p === '...'" class="px-1.5 text-slate-400">…</span>
      <button
        v-else
        class="h-9 w-9 rounded-xl text-sm font-medium transition-colors"
        :class="
          p === page
            ? 'bg-brand-600 text-white shadow-soft'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="go(p)"
      >
        {{ p }}
      </button>
    </template>
    <button class="btn-outline !px-3" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
  </nav>
</template>
