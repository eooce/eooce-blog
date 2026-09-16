<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const progress = ref(0)
const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
let ticking = false

function update() {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(1, window.scrollY / max) : 0
  visible.value = window.scrollY > 480
  ticking = false
}

function onScroll() {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(update)
  }
}

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  update()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-90"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-90"
  >
    <button
      v-if="visible"
      aria-label="回到顶部"
      title="回到顶部"
      class="group fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lift backdrop-blur transition-transform duration-300 hover:-translate-y-1 dark:bg-slate-900/90"
      @click="toTop"
    >
      <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          :r="RADIUS"
          fill="none"
          class="stroke-slate-200 dark:stroke-slate-700"
          stroke-width="3"
        />
        <circle
          cx="24"
          cy="24"
          :r="RADIUS"
          fill="none"
          stroke="url(#backtop-gradient)"
          stroke-width="3"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="CIRCUMFERENCE * (1 - progress)"
          class="transition-[stroke-dashoffset] duration-150 ease-out"
        />
        <defs>
          <linearGradient id="backtop-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#377c77" />
            <stop offset="100%" stop-color="#fd742d" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        class="relative h-4.5 w-4.5 text-slate-500 transition-colors group-hover:text-brand-500 dark:text-slate-300"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </transition>
</template>
