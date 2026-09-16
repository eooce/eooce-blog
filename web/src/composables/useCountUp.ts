import { ref, watch, type Ref } from 'vue'

/**
 * 数字滚动：从 0 缓动到目标值。
 * 目标值变化时重新滚动。
 */
export function useCountUp(target: Ref<number>, duration = 1200) {
  const display = ref(0)
  let raf = 0

  function animate(to: number) {
    cancelAnimationFrame(raf)
    const from = display.value
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      display.value = Math.round(from + (to - from) * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }

  watch(
    target,
    (value) => {
      if (value > 0) animate(value)
    },
    { immediate: true },
  )

  return display
}
