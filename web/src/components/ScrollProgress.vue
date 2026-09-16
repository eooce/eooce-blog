<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const progress = ref(0)
let ticking = false

function update() {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(1, window.scrollY / max) : 0
  ticking = false
}

function onScroll() {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(update)
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  update()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
    <div
      class="h-full rounded-r-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500 shadow-glow transition-[width] duration-150 ease-out"
      :style="{ width: `${progress * 100}%` }"
    />
  </div>
</template>
