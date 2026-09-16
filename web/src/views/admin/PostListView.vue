<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { adminApi } from '@/api'
import type { AdminPostRow } from '@/types'

const route = useRoute()
const router = useRouter()

const posts = ref<AdminPostRow[]>([])
const total = ref(0)
const loading = ref(true)
const q = ref('')
const status = ref((route.query.status as string) ?? '')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const deleting = ref(0)

async function load() {
  loading.value = true
  try {
    const data = await adminApi.posts({
      page: page.value,
      pageSize: 10,
      q: q.value || undefined,
      status: status.value || undefined,
    })
    posts.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function pushQuery(patch: Record<string, string | undefined>) {
  const query: Record<string, string> = {}
  const merged = { page: String(page.value), status: status.value, q: q.value, ...patch }
  for (const [k, v] of Object.entries(merged)) {
    if (v && !(k === 'page' && v === '1')) query[k] = v
  }
  router.push({ path: '/home/posts', query })
}

watch(() => route.query, () => load())

async function toggleStatus(post: AdminPostRow) {
  const next = post.status === 'published' ? 'draft' : 'published'
  await adminApi.patchPostStatus(post.id, { status: next })
  post.status = next
}

async function togglePinned(post: AdminPostRow) {
  await adminApi.patchPostStatus(post.id, { pinned: !post.pinned })
  post.pinned = post.pinned ? 0 : 1
}

async function remove(post: AdminPostRow) {
  if (!window.confirm(`确定删除文章「${post.title}」？此操作不可恢复。`)) return
  deleting.value = post.id
  try {
    await adminApi.deletePost(post.id)
    await load()
  } finally {
    deleting.value = 0
  }
}

const formatDate = (d: string | null) => (d ? dayjs(d).format('MM-DD HH:mm') : '—')

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">文章管理</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {{ total }} 篇文章</p>
      </div>
      <router-link to="/home/posts/new" class="btn-primary">新建文章</router-link>
    </header>

    <div class="card mb-5 flex flex-wrap items-center gap-3 p-4">
      <input
        v-model="q"
        type="search"
        placeholder="按标题搜索..."
        class="input max-w-xs flex-1"
        @keydown.enter="pushQuery({ page: '1', q: q })"
      />
      <select v-model="status" class="input w-36" @change="pushQuery({ page: '1', status: status })">
        <option value="">全部状态</option>
        <option value="published">已发布</option>
        <option value="draft">草稿</option>
      </select>
      <button class="btn-outline" @click="pushQuery({ page: '1', q: q })">搜索</button>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
              <th class="px-5 py-3.5 font-semibold">文章</th>
              <th class="px-5 py-3.5 font-semibold">分类</th>
              <th class="px-5 py-3.5 font-semibold">状态</th>
              <th class="px-5 py-3.5 font-semibold">数据</th>
              <th class="px-5 py-3.5 font-semibold">更新时间</th>
              <th class="px-5 py-3.5 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody v-if="!loading">
            <tr
              v-for="post in posts"
              :key="post.id"
              class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-800/40"
            >
              <td class="max-w-xs px-5 py-4">
                <p class="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                  <span v-if="post.pinned" class="badge shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">置顶</span>
                  <span class="truncate">{{ post.title }}</span>
                </p>
                <p class="mt-0.5 truncate text-xs text-slate-400">/post/{{ post.slug }}</p>
              </td>
              <td class="px-5 py-4 text-slate-500 dark:text-slate-400">{{ post.category_name ?? '—' }}</td>
              <td class="px-5 py-4">
                <button
                  class="badge cursor-pointer"
                  :class="post.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'"
                  @click="toggleStatus(post)"
                >
                  {{ post.status === 'published' ? '已发布' : '草稿' }}
                </button>
              </td>
              <td class="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                {{ post.views }} 阅读 · {{ post.comment_count }} 评论
              </td>
              <td class="px-5 py-4 text-xs text-slate-400">{{ formatDate(post.updated_at) }}</td>
              <td class="px-5 py-4">
                <div class="flex justify-end gap-1.5">
                  <button class="btn-ghost !px-2 text-xs" :title="post.pinned ? '取消置顶' : '置顶'" @click="togglePinned(post)">
                    {{ post.pinned ? '取消置顶' : '置顶' }}
                  </button>
                  <router-link :to="`/home/posts/${post.id}/edit`" class="btn-ghost !px-2 text-xs text-brand-600 dark:text-brand-400">编辑</router-link>
                  <button
                    class="btn-ghost !px-2 text-xs text-rose-500"
                    :disabled="deleting === post.id"
                    @click="remove(post)"
                  >
                    {{ deleting === post.id ? '删除中' : '删除' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="loading" class="space-y-3 p-5">
        <div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
      <p v-else-if="!posts.length" class="p-10 text-center text-sm text-slate-400">没有符合条件的文章</p>

      <div v-if="total > 10" class="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-sm dark:border-slate-800">
        <span class="text-slate-400">第 {{ page }} 页 / 共 {{ Math.ceil(total / 10) }} 页</span>
        <div class="flex gap-2">
          <button class="btn-outline !px-3 !py-1.5 text-xs" :disabled="page <= 1" @click="pushQuery({ page: String(page - 1) })">上一页</button>
          <button class="btn-outline !px-3 !py-1.5 text-xs" :disabled="page >= Math.ceil(total / 10)" @click="pushQuery({ page: String(page + 1) })">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>
