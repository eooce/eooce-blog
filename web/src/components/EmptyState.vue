<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-20 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
      <svg class="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M21 21l-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke-linecap="round" />
      </svg>
    </div>
    <h3 class="text-base font-semibold text-slate-700 dark:text-slate-200">{{ title }}</h3>
    <p v-if="description" class="max-w-sm text-sm text-slate-400 dark:text-slate-500">{{ description }}</p>
    <slot />
  </div>
</template>
