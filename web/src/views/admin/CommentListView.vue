<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { adminApi } from '@/api'
import type { Comment } from '@/types'

const route = useRoute()
const router = useRouter()

const comments = ref<Comment[]>([])
const total = ref(0)
const loading = ref(true)
const source = ref<'post' | 'guestbook'>(route.query.source === 'guestbook' ? 'guestbook' : 'post')
const status = ref((route.query.status as string) ?? '')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const busy = ref(0)

async function load() {
  loading.value = true
  try {
    const data =
      source.value === 'guestbook'
        ? await adminApi.guestbook({ page: page.value, pageSize: 10, status: status.value || undefined })
        : await adminApi.comments({ page: page.value, pageSize: 10, status: status.value || undefined })
    comments.value = data.list as Comment[]
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function syncFromQuery() {
  source.value = route.query.source === 'guestbook' ? 'guestbook' : 'post'
  status.value = (route.query.status as string) ?? ''
}

function pushQuery(patch: Record<string, string>) {
  const query: Record<string, string> = {}
  const merged = {
    page: String(page.value),
    status: status.value,
    source: source.value === 'guestbook' ? 'guestbook' : '',
    ...patch,
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v && !(k === 'page' && v === '1')) query[k] = v
  }
  router.push({ path: '/home/comments', query })
}

watch(
  () => route.query,
  () => {
    syncFromQuery()
    load()
  },
)

async function setStatus(comment: Comment, next: string) {
  busy.value = comment.id
  try {
    if (source.value === 'guestbook') {
      await adminApi.patchGuestbookStatus(comment.id, next)
    } else {
      await adminApi.patchCommentStatus(comment.id, next)
    }
    await load()
  } finally {
    busy.value = 0
  }
}

async function remove(comment: Comment) {
  const what = source.value === 'guestbook' ? '留言' : '评论'
  if (!window.confirm(`确定删除「${comment.nickname}」的${what}？`)) return
  busy.value = comment.id
  try {
    if (source.value === 'guestbook') {
      await adminApi.deleteGuestbook(comment.id)
    } else {
      await adminApi.deleteComment(comment.id)
    }
    await load()
  } finally {
    busy.value = 0
  }
}

const statusBadge = (s: string) =>
  s === 'approved'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
    : s === 'pending'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
const statusLabel = (s: string) => (s === 'approved' ? '已通过' : s === 'pending' ? '待审核' : '已拒绝')

onMounted(() => {
  syncFromQuery()
  load()
})
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">评论管理</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        共 {{ total }} 条{{ source === 'guestbook' ? '留言' : '评论' }}，审核通过后会在前台展示
      </p>
    </header>

    <div class="card mb-5 flex flex-wrap items-center gap-2 p-4">
      <!-- 来源切换 -->
      <div class="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="source === 'post' ? 'bg-white text-brand-600 shadow-soft dark:bg-slate-900 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="pushQuery({ source: '', page: '1' })"
        >
          文章评论
        </button>
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="source === 'guestbook' ? 'bg-white text-brand-600 shadow-soft dark:bg-slate-900 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="pushQuery({ source: 'guestbook', page: '1' })"
        >
          留言板
        </button>
      </div>
      <span class="mx-1 hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />
      <!-- 状态筛选 -->
      <button
        v-for="opt in [
          { value: '', label: '全部' },
          { value: 'pending', label: '待审核' },
          { value: 'approved', label: '已通过' },
          { value: 'rejected', label: '已拒绝' },
        ]"
        :key="opt.value"
        class="btn !px-3 !py-1.5 text-xs"
        :class="status === opt.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'"
        @click="status = opt.value; pushQuery({ page: '1', status: opt.value })"
      >
        {{ opt.label }}
      </button>
    </div>

    <div class="space-y-4">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 4" :key="i" class="card h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
      </div>

      <p v-else-if="!comments.length" class="card p-10 text-center text-sm text-slate-400">
        没有符合条件的{{ source === 'guestbook' ? '留言' : '评论' }}
      </p>

      <div v-for="comment in comments" v-else :key="comment.id" class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
              {{ comment.nickname.slice(0, 1) }}
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ comment.nickname }}</span>
                <span class="badge" :class="statusBadge(comment.status)">{{ statusLabel(comment.status) }}</span>
                <span class="text-xs text-slate-400">{{ dayjs(comment.created_at).format('YYYY-MM-DD HH:mm') }}</span>
              </div>
              <p class="mt-0.5 text-xs text-slate-400">
                <template v-if="source === 'guestbook'">来自留言板</template>
                <template v-else>
                  评论于
                  <router-link :to="`/post/${comment.post_slug}`" target="_blank" class="text-brand-500 hover:underline">
                    {{ comment.post_title }}
                  </router-link>
                </template>
              </p>
            </div>
          </div>
          <div class="flex gap-1.5">
            <template v-if="comment.status !== 'approved'">
              <button class="btn-outline !px-2.5 !py-1 text-xs" :disabled="busy === comment.id" @click="setStatus(comment, 'approved')">通过</button>
            </template>
            <template v-if="comment.status !== 'rejected'">
              <button class="btn-outline !px-2.5 !py-1 text-xs" :disabled="busy === comment.id" @click="setStatus(comment, 'rejected')">拒绝</button>
            </template>
            <button class="btn-ghost !px-2.5 !py-1 text-xs text-rose-500" :disabled="busy === comment.id" @click="remove(comment)">删除</button>
          </div>
        </div>
        <p class="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {{ comment.content }}
        </p>
      </div>
    </div>

    <div v-if="total > 10" class="mt-6 flex items-center justify-between text-sm">
      <span class="text-slate-400">第 {{ page }} 页 / 共 {{ Math.ceil(total / 10) }} 页</span>
      <div class="flex gap-2">
        <button class="btn-outline !px-3 !py-1.5 text-xs" :disabled="page <= 1" @click="pushQuery({ page: String(page - 1) })">上一页</button>
        <button class="btn-outline !px-3 !py-1.5 text-xs" :disabled="page >= Math.ceil(total / 10)" @click="pushQuery({ page: String(page + 1) })">下一页</button>
      </div>
    </div>
  </div>
</template>