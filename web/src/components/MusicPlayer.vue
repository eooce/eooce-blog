<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Song {
  filename: string
  url: string
  size: string
  extension: string
}

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(false)
const listError = ref('')
const playError = ref('')
const songs = ref<Song[]>([])
const currentIndex = ref(-1)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(80)
const query = ref('')
const playMode = ref<'order' | 'shuffle' | 'repeat'>('order')

const audio = new Audio()
audio.volume = volume.value / 100
audio.preload = 'metadata'
let listLoaded = false
let skipTries = 0
let playErrorTimer = 0
let clearSearchTimer = 0

const currentSong = computed(() => songs.value[currentIndex.value] ?? null)
const progress = computed(() =>
  duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0,
)

/** 搜索过滤：返回带原始索引的匹配项，null 表示未搜索 */
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return null
  return songs.value
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => {
      const n = parseName(song.filename)
      return `${n.title} ${n.artist}`.toLowerCase().includes(q)
    })
})

const visibleSongs = computed(() =>
  filtered.value ?? songs.value.map((song, index) => ({ song, index })),
)

function parseName(filename: string): { title: string; artist: string } {
  const base = filename.replace(/\.[^.]+$/, '')
  const parts = base.split(/\s*[-–]\s*/)
  if (parts.length >= 2) {
    const artist = parts[parts.length - 1].trim()
    const title = parts.slice(0, -1).join(' - ').trim()
    if (artist && title) return { title, artist }
  }
  return { title: base, artist: '未知歌手' }
}

function fmt(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function showPlayError(msg: string) {
  playError.value = msg
  window.clearTimeout(playErrorTimer)
  playErrorTimer = window.setTimeout(() => (playError.value = ''), 4000)
}

async function loadList() {
  if (listLoaded || loading.value) return
  loading.value = true
  listError.value = ''
  try {
    const res = await fetch('https://music.eooce.com/api/music/list')
    if (!res.ok) throw new Error('bad status')
    const data = await res.json()
    songs.value = data.data ?? []
    listLoaded = true
  } catch {
    listError.value = '音乐列表加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) void loadList()
}

function play(index: number) {
  const song = songs.value[index]
  if (!song) return
  if (currentIndex.value === index) {
    togglePlay()
    return
  }
  currentIndex.value = index
  playError.value = ''
  audio.src = song.url
  audio.play().catch(() => {
    playing.value = false
  })
}

function togglePlay() {
  if (currentIndex.value < 0) {
    if (songs.value.length) play(0)
    return
  }
  if (audio.paused) {
    audio.play().catch(() => {})
  } else {
    audio.pause()
  }
}

function prev() {
  if (!songs.value.length) return
  play((currentIndex.value - 1 + songs.value.length) % songs.value.length)
}

function next() {
  if (!songs.value.length) return
  play((currentIndex.value + 1) % songs.value.length)
}

function seek(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (duration.value > 0) audio.currentTime = (v / 100) * duration.value
}

/** 播放结束：单曲循环重播当前曲 / 随机跳曲 / 顺序下一曲 */
function onEnded() {
  if (playMode.value === 'repeat') {
    audio.currentTime = 0
    audio.play().catch(() => {})
    return
  }
  if (playMode.value === 'shuffle' && songs.value.length > 1) {
    let r = currentIndex.value
    while (r === currentIndex.value) r = Math.floor(Math.random() * songs.value.length)
    play(r)
    return
  }
  next()
}

function cycleMode() {
  playMode.value = playMode.value === 'order' ? 'shuffle' : playMode.value === 'shuffle' ? 'repeat' : 'order'
}

const modeLabel = computed(() =>
  playMode.value === 'shuffle' ? '随机' : playMode.value === 'repeat' ? '单曲' : '顺序',
)
const modeTitle = computed(() =>
  playMode.value === 'order'
    ? '当前顺序播放，点击切换随机'
    : playMode.value === 'shuffle'
      ? '当前随机播放，点击切换单曲循环'
      : '当前单曲循环，点击切回顺序播放',
)

/** 播放后 2 秒自动清理搜索内容并取消聚焦 */
function scheduleClearSearch() {
  window.clearTimeout(clearSearchTimer)
  clearSearchTimer = window.setTimeout(() => {
    query.value = ''
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, 2000)
}

/** 从列表交互播放（点击 / 回车），搜索中则安排自动清理 */
function playFromList(index: number) {
  play(index)
  if (query.value.trim()) scheduleClearSearch()
}

/** 搜索框键盘：↑↓ 在结果间移动焦点，回车播放焦点项（或首个匹配） */
function onSearchKeydown(e: KeyboardEvent) {
  const buttons = [...(root.value?.querySelectorAll('ul li button[data-index]') ?? [])] as HTMLElement[]
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!buttons.length) return
    e.preventDefault()
    const idx = buttons.indexOf(document.activeElement as HTMLElement)
    const target = e.key === 'ArrowDown' ? Math.min(idx + 1, buttons.length - 1) : Math.max(idx - 1, 0)
    const el = buttons[idx === -1 ? 0 : target]
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest' })
    return
  }
  if (e.key === 'Enter') {
    const fromActive = (document.activeElement as HTMLElement | null)?.dataset?.index
    const target = fromActive ?? buttons[0]?.dataset.index
    if (target !== undefined) {
      e.preventDefault()
      playFromList(Number(target))
    }
  }
}

audio.addEventListener('play', () => {
  playing.value = true
  skipTries = 0
})
audio.addEventListener('pause', () => (playing.value = false))
audio.addEventListener('ended', () => onEnded())
audio.addEventListener('timeupdate', () => (currentTime.value = audio.currentTime))
audio.addEventListener('loadedmetadata', () => (duration.value = audio.duration))
// 媒体解码/格式错误：提示并自动跳到下一首，连续 5 首失败则停止
audio.addEventListener('error', () => {
  playing.value = false
  if (currentIndex.value < 0) return
  skipTries += 1
  if (skipTries >= 5) {
    skipTries = 0
    showPlayError('连续多首无法播放，已停止自动切换')
    return
  }
  showPlayError(`「${parseName(songs.value[currentIndex.value].filename).title}」当前浏览器无法播放，自动播放下一首`)
  next()
})

watch(volume, (v) => (audio.volume = v / 100))

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.clearTimeout(clearSearchTimer)
  audio.pause()
  audio.src = ''
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="btn-ghost h-9 w-9 rounded-xl p-0"
      :title="open ? '收起音乐播放器' : '音乐播放器'"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <!-- 播放中显示阶梯跳动的均衡器，否则显示音符图标 -->
      <span v-if="playing" class="flex h-4 w-4 items-end justify-center gap-[2px]" aria-hidden="true">
        <span class="eq-bar h-2 w-[3px] rounded-full bg-brand-500" style="animation-delay: 0s" />
        <span class="eq-bar h-4 w-[3px] rounded-full bg-accent-500" style="animation-delay: 0.3s" />
        <span class="eq-bar h-3 w-[3px] rounded-full bg-brand-500" style="animation-delay: 0.6s" />
      </span>
      <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        <path
          d="M9 18V6l10-2v11M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="open"
        class="card absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden p-0 shadow-lift"
      >
        <!-- 正在播放 -->
        <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span v-if="playing" class="flex h-3.5 items-end justify-center gap-[2px]" aria-hidden="true">
              <span class="eq-bar h-1.5 w-[2.5px] rounded-full bg-brand-500" style="animation-delay: 0s" />
              <span class="eq-bar h-3.5 w-[2.5px] rounded-full bg-accent-500" style="animation-delay: 0.3s" />
              <span class="eq-bar h-2.5 w-[2.5px] rounded-full bg-brand-500" style="animation-delay: 0.6s" />
            </span>
            <svg v-else class="h-3.5 w-3.5 text-brand-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 18V6l10-2v11" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <p class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              <template v-if="currentSong">
                {{ parseName(currentSong.filename).title }}
                <span class="ml-1 text-xs font-normal text-slate-400">{{ parseName(currentSong.filename).artist }}</span>
              </template>
              <template v-else>选择一首喜欢的音乐</template>
            </p>
          </div>

          <!-- 进度条 -->
          <div class="mt-2.5 flex items-center gap-2">
            <span class="w-9 shrink-0 text-[10px] tabular-nums text-slate-400">{{ fmt(currentTime) }}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              :value="progress"
              class="h-1 flex-1 accent-brand-500"
              aria-label="播放进度"
              @input="seek"
            />
            <span class="w-9 shrink-0 text-right text-[10px] tabular-nums text-slate-400">{{ fmt(duration) }}</span>
          </div>

          <!-- 控制按钮（右侧为播放模式点击切换） -->
          <div class="relative mt-2 flex items-center justify-center gap-5">
            <button class="btn-ghost h-8 w-8 rounded-full p-0" title="上一曲" @click="prev">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h2v14H6V5Zm3.5 7 8.5 6V6l-8.5 6Z" />
              </svg>
            </button>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
              :title="playing ? '暂停' : '播放'"
              @click="togglePlay"
            >
              <svg v-if="playing" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
              </svg>
              <svg v-else class="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </button>
            <button class="btn-ghost h-8 w-8 rounded-full p-0" title="下一曲" @click="next">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2V5ZM4 5v14l8.5-7L4 5Z" />
              </svg>
            </button>
            <!-- 播放模式：点击循环切换，与搜索框右缘对齐 -->
            <button
              type="button"
              class="btn-ghost absolute right-0 top-1/2 h-8 -translate-y-1/2 !gap-1 !px-2 text-[11px] text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              :title="modeTitle"
              @click="cycleMode"
            >
              <svg v-if="playMode === 'shuffle'" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="playMode === 'repeat'" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M11 10h1v4M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h10M4 18h7" stroke-linecap="round" />
              </svg>
              {{ modeLabel }}
            </button>
          </div>

          <!-- 音量 + 搜索 -->
          <div class="mt-2.5 flex items-center gap-2">
            <svg class="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 2.5a5 5 0 0 1 0 9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input v-model.number="volume" type="range" min="0" max="100" class="h-1 w-20 accent-brand-500" aria-label="音量" />
            <span class="w-6 shrink-0 text-[10px] tabular-nums text-slate-400">{{ volume }}%</span>
            <div class="relative min-w-0 flex-1">
              <svg class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke-linecap="round" />
              </svg>
              <input
                v-model="query"
                type="search"
                placeholder="搜索歌曲，回车播放"
                class="input h-8 w-full appearance-none !rounded-lg !py-1 !pl-6 !pr-2.5 text-xs"
                aria-label="搜索歌曲"
                @keydown="onSearchKeydown"
              />
            </div>
          </div>
        </div>

        <!-- 歌曲列表 -->
        <div class="max-h-80 overflow-y-auto">
          <!-- 播放错误横幅（不挤掉列表） -->
          <p
            v-if="playError"
            class="flex items-center gap-1.5 bg-accent-50 px-3 py-2 text-xs text-accent-600 dark:bg-accent-500/10 dark:text-accent-400"
          >
            <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="min-w-0 flex-1">{{ playError }}</span>
          </p>
          <div v-if="loading" class="space-y-2 p-4">
            <div v-for="i in 6" :key="i" class="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
          <div v-else-if="listError" class="p-6 text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ listError }}</p>
            <button type="button" class="btn-outline mt-3 !py-1.5 text-xs" @click="loadList">重新加载</button>
          </div>
          <ul v-else-if="visibleSongs.length" class="p-1.5">
            <li v-for="{ song, index } in visibleSongs" :key="song.url">
              <button
                type="button"
                :data-index="index"
                class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:bg-brand-50 dark:focus-visible:bg-brand-500/10"
                :class="
                  index === currentIndex
                    ? 'bg-brand-50 dark:bg-brand-500/10'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                "
                @click="playFromList(index)"
              >
                <span class="w-4 shrink-0 text-center">
                  <span v-if="index === currentIndex && playing" class="flex h-3 items-end justify-center gap-[2px]" aria-hidden="true">
                    <span class="eq-bar h-1 w-[2px] rounded-full bg-brand-500" style="animation-delay: 0s" />
                    <span class="eq-bar h-3 w-[2px] rounded-full bg-accent-500" style="animation-delay: 0.3s" />
                    <span class="eq-bar h-2 w-[2px] rounded-full bg-brand-500" style="animation-delay: 0.6s" />
                  </span>
                  <span v-else-if="index === currentIndex" class="text-brand-500">▶</span>
                  <span v-else class="text-[10px] tabular-nums text-slate-300 dark:text-slate-600">{{ index + 1 }}</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-sm"
                    :class="index === currentIndex ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'"
                  >
                    {{ parseName(song.filename).title }}
                  </span>
                  <span class="block truncate text-[11px] text-slate-400">{{ parseName(song.filename).artist }}</span>
                </span>
                <span class="shrink-0 text-[10px] text-slate-300 dark:text-slate-600">{{ song.extension }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="query.trim()" class="p-6 text-center text-sm text-slate-400">
            没有匹配「{{ query.trim() }}」的歌曲
          </p>
          <p v-else class="p-6 text-center text-sm text-slate-400">暂无歌曲</p>
        </div>
      </div>
    </transition>
  </div>
</template>
