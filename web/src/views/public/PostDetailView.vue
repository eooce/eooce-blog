<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { publicApi } from '@/api'
import type { Comment, PostDetail } from '@/types'
import { BASE_TITLE } from '@/utils/title'
import MarkdownView, { type TocItem } from '@/components/MarkdownView.vue'
import CoverPlaceholder from '@/components/CoverPlaceholder.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const post = ref<PostDetail | null>(null)
const loading = ref(true)
const missing = ref(false)
// 封面图加载失败时回退为渐变占位图
const coverBroken = ref(false)

const toc = ref<TocItem[]>([])
const activeHeading = ref('')

const comments = ref<Comment[]>([])
const commentsLoading = ref(true)

const form = ref({ nickname: '', email: '', content: '' })
const submitting = ref(false)
const submitMessage = ref('')
const submitError = ref('')

const formatDate = (d: string | null) => (d ? dayjs(d).format('YYYY年MM月DD日') : '')

async function loadPost() {
  loading.value = true
  missing.value = false
  post.value = null
  coverBroken.value = false
  toc.value = []
  try {
    post.value = await publicApi.post(route.params.slug as string)
    document.title = `${BASE_TITLE}-${post.value.title}`
  } catch {
    missing.value = true
  } finally {
    loading.value = false
  }
  void nextTick(() => setupObserver())
}

async function loadComments() {
  commentsLoading.value = true
  try {
    comments.value = await publicApi.comments(route.params.slug as string)
  } finally {
    commentsLoading.value = false
  }
}

async function submitComment() {
  submitError.value = ''
  submitMessage.value = ''
  submitting.value = true
  try {
    await publicApi.addComment(route.params.slug as string, { ...form.value })
    submitMessage.value = '评论提交成功，审核通过后将会展示，感谢参与！'
    form.value = { nickname: '', email: '', content: '' }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : '提交失败，请重试'
  } finally {
    submitting.value = false
  }
}

let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeHeading.value = entry.target.id
          break
        }
      }
    },
    { rootMargin: '-80px 0px -70% 0px' },
  )
  for (const item of toc.value) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
}

onBeforeUnmount(() => observer?.disconnect())

watch(() => route.params.slug, () => {
  if (route.name === 'post-detail') {
    loadPost()
    loadComments()
  }
})

onMounted(() => {
  loadPost()
  loadComments()
})
</script>

<template>
  <div class="container-page max-w-7xl py-8">
    <div v-if="loading" class="mx-auto max-w-3xl py-10">
      <div class="card h-96 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <EmptyState
      v-else-if="missing"
      title="文章不存在或未发布"
      description="这篇内容可能已被移动或删除"
    >
      <router-link to="/" class="btn-primary">返回首页</router-link>
    </EmptyState>

    <div v-else-if="post" class="mx-auto flex max-w-7xl gap-10">
      <article class="min-w-0 flex-1">
        <div v-reveal class="overflow-hidden rounded-3xl border border-slate-200/80 shadow-soft dark:border-slate-800">
          <div class="aspect-[21/7]">
            <img
              v-if="post.cover_image && !coverBroken"
              :src="post.cover_image"
              :alt="post.title"
              loading="lazy"
              class="h-full w-full object-cover"
              @error="coverBroken = true"
            />
            <CoverPlaceholder v-else :slug="post.slug" :text="post.title" />
          </div>
        </div>

        <header v-reveal="80" class="mt-8">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
            <router-link
              v-if="post.category_name"
              :to="`/category/${post.category_slug}`"
              class="badge bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400"
            >
              {{ post.category_name }}
            </router-link>
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ formatDate(post.published_at) }}
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ post.reading_minutes }} 分钟阅读
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ post.views }} 次阅读
            </span>
          </div>
          <h1 class="mt-4 text-2xl font-black leading-snug tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {{ post.title }}
          </h1>
          <p class="mt-4 rounded-2xl border-l-4 border-brand-400 bg-slate-50 px-5 py-3 text-sm leading-relaxed text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            {{ post.summary }}
          </p>
        </header>

        <div v-reveal="140" class="mt-8">
          <MarkdownView :content="post.content" @toc="toc = $event" />
        </div>

        <div v-if="post.tags.length" v-reveal class="mt-10 flex flex-wrap gap-2">
          <router-link
            v-for="tag in post.tags"
            :key="tag.slug"
            :to="`/tag/${tag.slug}`"
            class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-600 hover:shadow-soft dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
          >
            # {{ tag.name }}
          </router-link>
        </div>

        <nav v-reveal class="mt-10 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2 dark:border-slate-800">
          <router-link
            v-if="post.next"
            :to="`/post/${post.next.slug}`"
            class="card group p-5 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <p class="text-xs text-slate-400">← 下一篇</p>
            <p class="mt-1.5 font-semibold text-slate-800 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-400">
              {{ post.next.title }}
            </p>
          </router-link>
          <router-link
            v-if="post.prev"
            :to="`/post/${post.prev.slug}`"
            class="card group p-5 text-right hover:-translate-y-0.5 hover:shadow-lift sm:col-start-2"
          >
            <p class="text-xs text-slate-400">上一篇 →</p>
            <p class="mt-1.5 font-semibold text-slate-800 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-400">
              {{ post.prev.title }}
            </p>
          </router-link>
        </nav>

        <section class="mt-12">
          <h2 class="mb-6 text-xl font-bold text-slate-900 dark:text-white">
            评论 <span class="text-sm font-normal text-slate-400">({{ comments.length }})</span>
          </h2>

          <form class="card space-y-4 p-6" @submit.prevent="submitComment">
            <div class="grid gap-4 sm:grid-cols-2">
              <input v-model="form.nickname" type="text" placeholder="昵称 *" required maxlength="30" class="input" />
              <input v-model="form.email" type="email" placeholder="邮箱 *（不会被展示）" required class="input" />
            </div>
            <textarea
              v-model="form.content"
              placeholder="说点什么吧... *"
              required
              rows="4"
              maxlength="1000"
              class="input resize-none"
            />
            <div class="flex items-center justify-between gap-4">
              <p v-if="submitMessage" class="text-sm text-emerald-600 dark:text-emerald-400">{{ submitMessage }}</p>
              <p v-else-if="submitError" class="text-sm text-rose-600 dark:text-rose-400">{{ submitError }}</p>
              <span v-else class="text-xs text-slate-400">评论将展示在审核通过后</span>
              <button type="submit" class="btn-primary shrink-0" :disabled="submitting">
                {{ submitting ? '提交中...' : '发表评论' }}
              </button>
            </div>
          </form>

          <div v-if="commentsLoading" class="mt-6 space-y-4">
            <div v-for="i in 2" :key="i" class="card h-20 animate-pulse bg-slate-100 dark:bg-slate-800" />
          </div>
          <div v-else-if="comments.length" class="mt-6 space-y-4">
            <div
              v-for="(comment, i) in comments"
              :key="comment.id"
              v-reveal="Math.min(i * 60, 300)"
              class="card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-soft transition-transform duration-300 hover:scale-110 hover:rotate-6"
                >
                  {{ comment.nickname.slice(0, 1) }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ comment.nickname }}</p>
                  <p class="text-xs text-slate-400">{{ dayjs(comment.created_at).format('YYYY-MM-DD HH:mm') }}</p>
                </div>
              </div>
              <p class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ comment.content }}</p>
            </div>
          </div>
          <p v-else class="mt-6 rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-400 dark:bg-slate-900 dark:text-slate-500">
            还没有评论，来抢沙发吧
          </p>
        </section>
      </article>

      <aside v-if="toc.length" class="hidden w-60 shrink-0 xl:block">
        <div class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">目录</p>
          <nav>
            <a
              v-for="item in toc"
              :key="item.id"
              :href="`#${item.id}`"
              class="toc-link"
              :class="[{ active: activeHeading === item.id }, item.level > 2 ? 'pl-7' : '']"
            >
              {{ item.text }}
            </a>
          </nav>
        </div>
      </aside>
    </div>
  </div>
</template>
