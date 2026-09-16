<script setup lang="ts">
const props = defineProps<{ slug: string; text: string }>()

const gradients = [
  'from-brand-600 via-brand-500 to-emerald-400',
  'from-accent-500 via-accent-400 to-amber-300',
  'from-teal-600 via-brand-500 to-brand-400',
  'from-orange-500 via-accent-500 to-amber-400',
  'from-brand-500 via-teal-500 to-cyan-400',
  'from-brand-700 via-brand-500 to-accent-400',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const gradient = gradients[hash(props.slug) % gradients.length]
</script>

<template>
  <div
    class="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br"
    :class="gradient"
  >
    <!-- 漂浮装饰光斑 -->
    <span class="pointer-events-none absolute -left-6 -top-8 h-24 w-24 animate-float rounded-full bg-white/15 blur-md" aria-hidden="true" />
    <span
      class="pointer-events-none absolute -bottom-8 right-4 h-28 w-28 animate-float rounded-full bg-white/10 blur-md"
      style="animation-delay: -5s"
      aria-hidden="true"
    />
    <!-- 山形剪影 -->
    <svg class="absolute inset-0 h-full w-full opacity-10" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 160 L80 60 L140 120 L200 40 L260 110 L320 70 L400 140 L400 200 L0 200 Z" fill="#fff" />
    </svg>
    <!-- 微光扫过 -->
    <span
      class="pointer-events-none absolute inset-y-0 w-1/3 -translate-x-[140%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer"
      aria-hidden="true"
    />
    <span class="relative animate-float-y text-5xl font-black text-white/90 drop-shadow-lg">{{ props.text.slice(0, 1) }}</span>
  </div>
</template>
