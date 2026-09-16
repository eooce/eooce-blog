<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <header v-reveal class="mb-10">
    <p v-if="eyebrow" class="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-400">
      {{ eyebrow }}
    </p>
    <div class="flex items-end gap-4">
      <h1 class="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">{{ title }}</h1>
      <span
        class="mb-2 hidden h-1 flex-1 rounded-full bg-gradient-to-r from-brand-400/70 via-accent-400/50 to-transparent sm:block"
      />
    </div>
    <p v-if="description" class="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
      <slot name="description">{{ description }}</slot>
    </p>
  </header>
</template>
