<script setup lang="ts">
import { computed } from 'vue'
import type { Tag } from '@/types'

const props = defineProps<{ tags: Tag[] }>()

/** 蜂窝最多显示的标签数（含 C 位） */
const MAX_TAGS = 10

/** 蜂窝尺寸（紧凑版）：C 位 90×109，环绕 78×90 */
const CENTER = 90
const CENTER_H = 109
const RING = 78

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

/**
 * 固定槽位（相对中心的偏移，屏幕坐标 y 向下）：
 *      左上   右上
 *   左    C位    右
 *  远左  左下  右下  远右
 *          底部
 */
const SLOTS: Array<{ x: number; y: number }> = [
  { x: 0, y: 0 }, // C 位
  { x: -46, y: -88 }, // 左上
  { x: 46, y: -88 }, // 右上
  { x: -94, y: 0 }, // 左
  { x: 94, y: 0 }, // 右
  { x: -46, y: 92 }, // 左下（与 C 位底部留出间隙）
  { x: 46, y: 92 }, // 右下（与 C 位底部留出间隙）
  { x: -140, y: 92 }, // 远左下
  { x: 140, y: 92 }, // 远右下
  { x: 0, y: 176 }, // 底部
]

interface Hex {
  tag: Tag
  w: number
  h: number
  x: number
  y: number
  tier: 'center' | 'ring'
  delay: number
}

const hexes = computed<Hex[]>(() => {
  const sorted = [...props.tags].sort((a, b) => (b.post_count ?? 0) - (a.post_count ?? 0))
  if (!sorted.length) return []
  // C 位：后台标记的标签；未标记时取文章数最多的
  const centerIdx = sorted.findIndex((t) => t.is_center === 1)
  const center = centerIdx >= 0 ? sorted[centerIdx] : sorted[0]
  const rest = sorted.filter((t) => t.id !== center.id).slice(0, MAX_TAGS - 1)

  const all = [center, ...rest]
  const list: Hex[] = []
  for (let i = 0; i < all.length && i < SLOTS.length; i++) {
    const w = i === 0 ? CENTER : RING
    list.push({
      tag: all[i],
      w,
      h: i === 0 ? CENTER_H : Math.round(w * 1.155),
      x: SLOTS[i].x,
      y: SLOTS[i].y,
      tier: i === 0 ? 'center' : 'ring',
      delay: i === 0 ? 0 : 120 + i * 80,
    })
  }
  return list
})

const containerStyle = { width: '420px', height: '450px' }

function hexPos(hex: Hex) {
  const style: Record<string, string> = {
    left: `calc(50% + ${hex.x}px)`,
    top: `calc(50% + ${hex.y}px)`,
    width: `${hex.w}px`,
    height: `${hex.h}px`,
    marginLeft: `${-hex.w / 2}px`,
    marginTop: `${-hex.h / 2}px`,
    animationDelay: `${hex.delay}ms`,
  }
  // C 位外层不裁切，否则 drop-shadow 的发光会被 clip-path 一起剪掉（裁切由内层承担）
  if (hex.tier !== 'center') style.clipPath = HEX_CLIP
  return style
}

/** 外层：描边色 + 悬停动效 */
function outerClass(hex: Hex): string {
  if (hex.tier === 'center') {
    return 'z-10 drop-shadow-[0_0_12px_rgba(45,212,191,0.3)] hover:scale-105 hover:drop-shadow-[0_0_22px_rgba(45,212,191,0.55)]'
  }
  return 'bg-slate-900/[0.18] dark:bg-white/20 hover:scale-110 hover:z-20 hover:drop-shadow-[0_0_16px_rgba(99,102,241,0.4)]'
}

/** 内层：填充色 + 文字色 */
function innerClass(hex: Hex): string {
  if (hex.tier === 'center') {
    return 'bg-[linear-gradient(180deg,#79e0d8_0%,#2bbdb4_30%,#109690_64%,#0a6159_100%)] text-white'
  }
  return 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white dark:group-hover:bg-brand-500'
}
</script>

<template>
  <div class="relative" :style="containerStyle">
    <router-link
      v-for="hex in hexes"
      :key="hex.tag.id"
      :to="`/tag/${hex.tag.slug}`"
      :title="`${hex.tag.name} · ${hex.tag.post_count ?? 0} 篇文章`"
      class="hex-in group absolute transition-all duration-300 focus-visible:outline-none"
      :class="outerClass(hex)"
      :style="hexPos(hex)"
    >
      <span
        class="absolute flex flex-col items-center justify-center pt-1.5 text-center"
        :class="[innerClass(hex), hex.tier === 'center' ? 'inset-0' : 'inset-[2px]']"
        :style="{ clipPath: HEX_CLIP }"
      >
        <span
          class="max-w-full truncate px-1"
          :class="hex.tier === 'center' ? 'text-lg font-bold' : 'text-sm font-semibold'"
        >
          {{ hex.tag.name }}
        </span>
        <span class="text-[11px] leading-tight opacity-70">
          {{ hex.tag.post_count ?? 0 }} 篇
        </span>
      </span>
    </router-link>
  </div>
</template>