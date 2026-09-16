<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    words: string[]
    typeSpeed?: number
    deleteSpeed?: number
    holdTime?: number
  }>(),
  {
    typeSpeed: 140,
    deleteSpeed: 70,
    holdTime: 1800,
  },
)

const text = ref('')
let timer: ReturnType<typeof setTimeout> | null = null
let index = 0
let char = 0
let deleting = false

function tick() {
  const word = props.words[index % props.words.length]
  if (!deleting) {
    char += 1
    text.value = word.slice(0, char)
    if (char >= word.length) {
      deleting = true
      timer = setTimeout(tick, props.holdTime)
      return
    }
    timer = setTimeout(tick, props.typeSpeed)
  } else {
    char -= 1
    text.value = word.slice(0, char)
    if (char <= 0) {
      deleting = false
      index += 1
      timer = setTimeout(tick, 400)
      return
    }
    timer = setTimeout(tick, props.deleteSpeed)
  }
}

onMounted(() => {
  timer = setTimeout(tick, 500)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <span class="font-mono font-bold text-accent-600 dark:text-accent-400">
    {{ text }}<span class="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-caret rounded-full bg-accent-500" />
  </span>
</template>
