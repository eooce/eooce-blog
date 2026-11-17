<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { publicApi } from '@/api'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{
  /** 评论来源：post = 文章评论（需配合 slug），guestbook = 留言板 */
  source: 'post' | 'guestbook'
  /** 文章 slug，source 为 post 时必传 */
  slug?: string
  /** 列表标题（如「评论」），不传则不渲染标题行 */
  title?: string
}>()

interface CommentItem {
  id: number
  parent_id?: number | null
  /** 1 = 博主回复 */
  is_admin?: number
  nickname: string
  content: string
  created_at: string
}

interface ReplyItem extends CommentItem {
  /** 需要 @ 提及的昵称（回复别人的回复时使用，回复主题根时为空） */
  mention: string
}

interface Thread {
  root: CommentItem
  replies: ReplyItem[]
}

const items = ref<CommentItem[]>([])
const loading = ref(true)

const form = ref({ nickname: '', email: '', content: '' })
const submitting = ref(false)
const submitMessage = ref('')
const submitError = ref('')
const replyTo = ref<CommentItem | null>(null)

const formRef = ref<HTMLFormElement | null>(null)
const contentRef = ref<HTMLTextAreaElement | null>(null)

const noun = computed(() => (props.source === 'post' ? '评论' : '留言'))
const placeholder = computed(() =>
  replyTo.value ? `回复 @${replyTo.value.nickname}... *` : props.source === 'post' ? '说点什么吧... *' : '想说的话... *',
)
const emptyTitle = computed(() => (props.source === 'post' ? '还没有评论' : '还没有留言'))
const emptyDescription = computed(() => (props.source === 'post' ? '来抢沙发吧' : '来写下第一条留言吧'))

// 追溯到所在主题的根评论；父级链断裂（未通过审核或已删除）时返回 undefined
function resolveRoot(item: CommentItem, byId: Map<number, CommentItem>): CommentItem | undefined {
  let cur = item
  const seen = new Set<number>()
  while (cur.parent_id != null) {
    if (seen.has(cur.id)) return undefined
    seen.add(cur.id)
    const parent = byId.get(cur.parent_id)
    if (!parent) return undefined
    cur = parent
  }
  return cur
}

/* 两级嵌套展示：根评论按时间倒序，其下回复按时间正序；
   嵌套回复（回复别人的回复）归并到同一主题下，用 @昵称 区分 */
const threads = computed<Thread[]>(() => {
  const byId = new Map(items.value.map((c) => [c.id, c]))
  const roots: Thread[] = []
  const threadByRoot = new Map<number, Thread>()
  for (const item of items.value) {
    const root = resolveRoot(item, byId)
    if (!root || root.id === item.id) {
      // 根评论，或父级不可见导致被孤立的回复 —— 都作为独立主题展示
      const thread: Thread = { root: item, replies: [] }
      threadByRoot.set(item.id, thread)
      roots.push(thread)
    }
  }
  // items 按时间倒序，逆序遍历让回复区内为正序（旧 → 新）
  for (const item of [...items.value].reverse()) {
    const root = resolveRoot(item, byId)
    if (!root || root.id === item.id) continue
    const thread = threadByRoot.get(root.id)
    if (!thread) continue
    const parentNickname = item.parent_id != null ? (byId.get(item.parent_id)?.nickname ?? '') : ''
    thread.replies.push({ ...item, mention: item.parent_id === root.id ? '' : parentNickname })
  }
  return roots
})

async function load() {
  loading.value = true
  try {
    items.value =
      props.source === 'post' && props.slug ? await publicApi.comments(props.slug) : await publicApi.guestbook()
  } finally {
    loading.value = false
  }
}

function startReply(item: CommentItem) {
  replyTo.value = item
  submitMessage.value = ''
  submitError.value = ''
  void nextTick(() => {
    formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    contentRef.value?.focus()
  })
}

function cancelReply() {
  replyTo.value = null
}

async function submit() {
  submitError.value = ''
  submitMessage.value = ''
  submitting.value = true
  try {
    const body = { ...form.value, parent_id: replyTo.value?.id ?? null }
    if (props.source === 'post' && props.slug) {
      await publicApi.addComment(props.slug, body)
    } else {
      await publicApi.addGuestbook(body)
    }
    submitMessage.value = `${noun.value}提交成功，审核通过后将会展示，感谢参与！`
    form.value = { nickname: '', email: '', content: '' }
    replyTo.value = null
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : '提交失败，请重试'
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.slug,
  () => {
    if (props.source === 'post') {
      replyTo.value = null
      void load()
    }
  },
)

onMounted(load)
</script>

<template>
  <section>
    <h2 v-if="title" class="mb-6 text-xl font-bold text-slate-900 dark:text-white">
      {{ title }} <span class="text-sm font-normal text-slate-400">({{ items.length }})</span>
    </h2>

    <!-- 发表表单（回复时显示目标横条） -->
    <form ref="formRef" class="card space-y-4 p-6" @submit.prevent="submit">
      <div
        v-if="replyTo"
        class="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
      >
        <span>回复 @{{ replyTo.nickname }}：</span>
        <button
          type="button"
          class="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          @click="cancelReply"
        >
          ✕
        </button>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <input v-model="form.nickname" type="text" placeholder="昵称 *" required maxlength="30" class="input" />
        <input v-model="form.email" type="email" placeholder="邮箱 *（不会被展示）" required class="input" />
      </div>
      <textarea
        ref="contentRef"
        v-model="form.content"
        :placeholder="placeholder"
        required
        rows="4"
        maxlength="1000"
        class="input resize-none"
      />
      <div class="flex items-center justify-between gap-4">
        <p v-if="submitMessage" class="text-sm text-emerald-600 dark:text-emerald-400">{{ submitMessage }}</p>
        <p v-else-if="submitError" class="text-sm text-rose-600 dark:text-rose-400">{{ submitError }}</p>
        <span v-else class="text-xs text-slate-400">{{ noun }}将展示在审核通过后</span>
        <button type="submit" class="btn-primary shrink-0" :disabled="submitting">
          {{ submitting ? '提交中...' : replyTo ? '发表回复' : `发表${noun}` }}
        </button>
      </div>
    </form>

    <!-- 列表 -->
    <div v-if="loading" class="mt-6 space-y-4">
      <div v-for="i in 2" :key="i" class="card h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <div v-else-if="threads.length" class="mt-6 space-y-4">
      <div
        v-for="(thread, i) in threads"
        :key="thread.root.id"
        v-reveal="Math.min(i * 60, 300)"
        class="card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
      >
        <!-- 根评论 -->
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-soft transition-transform duration-300 hover:scale-110 hover:rotate-6"
          >
            {{ thread.root.nickname.slice(0, 1) }}
          </div>
          <div>
            <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {{ thread.root.nickname }}
              <span
                v-if="thread.root.is_admin"
                class="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-400"
                >博主</span
              >
            </p>
            <p class="text-xs text-slate-400">{{ dayjs(thread.root.created_at).format('YYYY-MM-DD HH:mm') }}</p>
          </div>
        </div>
        <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {{ thread.root.content }}
        </p>
        <div class="mt-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-500"
            @click="startReply(thread.root)"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 17l-5-5 5-5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 12h11a5 5 0 0 1 5 5v3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            回复
          </button>
        </div>

        <!-- 回复区（缩进展示） -->
        <div v-if="thread.replies.length" class="mt-4 space-y-4 border-l-2 border-slate-100 pl-4 sm:ml-11 dark:border-slate-800">
          <div v-for="reply in thread.replies" :key="reply.id">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white shadow-soft"
              >
                {{ reply.nickname.slice(0, 1) }}
              </div>
              <div>
                <p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {{ reply.nickname }}
                  <span
                    v-if="reply.is_admin"
                    class="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-400"
                    >博主</span
                  >
                  <span v-if="reply.mention" class="text-xs font-normal text-slate-400">回复 @{{ reply.mention }}</span>
                </p>
                <p class="text-xs text-slate-400">{{ dayjs(reply.created_at).format('YYYY-MM-DD HH:mm') }}</p>
              </div>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {{ reply.content }}
            </p>
            <div class="mt-1.5">
              <button
                type="button"
                class="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-500"
                @click="startReply(reply)"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M9 17l-5-5 5-5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 12h11a5 5 0 0 1 5 5v3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                回复
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-else class="!py-10" :title="emptyTitle" :description="emptyDescription" />
  </section>
</template>
