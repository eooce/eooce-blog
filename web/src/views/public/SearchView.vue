<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '@/api'
import type { PostItem } from '@/types'
import PostCard from '@/components/PostCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const keyword = ref((route.query.q as string) ?? '')
const posts = ref<PostItem[]>([])
const total = ref(0)
const loading = ref(false)
const searched = ref(false)

const q = computed(() => (route.query.q as string) ?? '')

async function search() {
  const value = q.value.trim()
  if (!value) return
  loading.value = true
  searched.value = true
  try {
    const data = await publicApi.posts({ search: value, pageSize: 12 })
    posts.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function submit() {
  const value = keyword.value.trim()
  if (!value) return
  router.push({ path: '/search', query: { q: value } })
}

watch(q, () => {
  keyword.value = q.value
  search()
})

onMounted(search)
</script>

<template>
  <div class="container-page py-10">
    <header class="mb-8 text-center">
      <h1 class="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">搜索文章</h1>
      <form class="mx-auto mt-6 flex max-w-xl gap-3" @submit.prevent="submit">
        <input
          v-model="keyword"
          type="search"
          placeholder="输入关键词，按标题或正文搜索..."
          class="input flex-1"
          autofocus
        />
        <button type="submit" class="btn-primary shrink-0">搜索</button>
      </form>
    </header>

    <div v-if="loading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="card h-72 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else-if="searched && q">
      <p class="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
        找到 <span class="font-semibold text-brand-500">{{ total }}</span> 篇与「{{ q }}」相关的文章
      </p>
      <div v-if="posts.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="(post, i) in posts" :key="post.id" v-reveal="Math.min(i * 70, 420)">
          <PostCard :post="post" />
        </div>
      </div>
      <EmptyState
        v-else
        title="没有找到相关文章"
        description="换个关键词试试，或浏览全部分类"
      >
        <router-link to="/categories" class="btn-outline">浏览分类</router-link>
      </EmptyState>
    </template>
  </div>
</template>
