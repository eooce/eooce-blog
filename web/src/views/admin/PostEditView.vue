<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdEditor } from 'md-editor-v3'
import type { ToolbarNames, ExposeParam } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { adminApi } from '@/api'
import type { Category, Tag } from '@/types'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()

const editorRef = ref<ExposeParam>()
const form = ref({
  title: '',
  slug: '',
  summary: '',
  content: '',
  cover_image: '',
  category_id: null as number | null,
  status: 'draft' as 'draft' | 'published',
  pinned: false,
  tag_ids: [] as number[],
})

const categories = ref<Category[]>([])
const allTags = ref<Tag[]>([])
const saving = ref(false)
const error = ref('')
const isEdit = computed(() => route.params.id !== undefined)

const toolbars: ToolbarNames[] = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'quote', 'unorderedList', 'orderedList', '-',
  'code', 'codeRow', 'table', 'link', '-',
  'revoke', 'next', '=',
  'preview', 'htmlPreview',
]

onMounted(async () => {
  const [cats, tags] = await Promise.all([adminApi.categories(), adminApi.tags()])
  categories.value = cats
  allTags.value = tags
  if (isEdit.value) {
    const post = await adminApi.post(Number(route.params.id))
    form.value = {
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      cover_image: post.cover_image,
      category_id: post.category_id,
      status: post.status as 'draft' | 'published',
      pinned: post.pinned === 1,
      tag_ids: post.tag_ids,
    }
  }
})

async function save(nextStatus?: 'draft' | 'published') {
  error.value = ''
  if (!form.value.title.trim()) {
    error.value = '标题不能为空'
    return
  }
  if (!form.value.content.trim()) {
    error.value = '正文不能为空'
    return
  }
  const status = nextStatus ?? form.value.status
  const body = {
    ...form.value,
    status,
    category_id: form.value.category_id || null,
    tag_ids: [...form.value.tag_ids],
  }
  saving.value = true
  try {
    if (isEdit.value) {
      await adminApi.updatePost(Number(route.params.id), body)
    } else {
      const created = await adminApi.createPost(body)
      router.replace(`/home/posts/${created.id}/edit`)
    }
    form.value.status = status
    router.push('/home/posts')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

function toggleTag(id: number) {
  const list = form.value.tag_ids
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(id)
}
</script>

<template>
  <div>
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {{ isEdit ? '编辑文章' : '新建文章' }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">支持 Markdown 语法，右侧可实时预览</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-outline" :disabled="saving" @click="save('draft')">存为草稿</button>
        <button class="btn-primary" :disabled="saving" @click="save('published')">
          {{ saving ? '保存中...' : '发布' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
      {{ error }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div class="space-y-5">
        <div class="card p-5">
          <input
            v-model="form.title"
            type="text"
            placeholder="文章标题..."
            class="w-full border-0 bg-transparent text-2xl font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-0 dark:text-white dark:placeholder-slate-600"
          />
          <textarea
            v-model="form.summary"
            placeholder="摘要：简要描述这篇文章的内容（展示在列表页）"
            rows="2"
            class="mt-3 w-full resize-none border-0 bg-transparent text-sm text-slate-500 placeholder-slate-300 focus:outline-none focus:ring-0 dark:text-slate-400 dark:placeholder-slate-600"
          />
        </div>

        <div class="card overflow-hidden !p-0">
          <MdEditor
            ref="editorRef"
            v-model="form.content"
            :theme="theme.theme"
            :language="'zh-CN'"
            :toolbars="toolbars"
            :footers="[]"
            placeholder="开始写作吧..."
            class="!h-[560px]"
          />
        </div>
      </div>

      <aside class="space-y-5">
        <div class="card p-5">
          <h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">发布设置</h3>
          <label class="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">状态</label>
          <select v-model="form.status" class="input">
            <option value="draft">草稿（前台不可见）</option>
            <option value="published">已发布</option>
          </select>

          <label class="mt-4 mb-1.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              :checked="form.pinned"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              @change="form.pinned = ($event.target as HTMLInputElement).checked"
            />
            置顶显示（排于列表最前）
          </label>
        </div>

        <div class="card p-5">
          <h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">文章路径</h3>
          <input
            v-model="form.slug"
            type="text"
            placeholder="留空自动生成"
            maxlength="140"
            class="input"
          />
          <p class="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            留空则自动生成：英文开头取开头的英文部分（AWS大放水… → aws），中文取前两个字的拼音（注册最重要的环境… → zhu-ce）。可自定义，仅字母、数字与连字符有效。
          </p>
          <p v-if="form.slug" class="mt-1.5 truncate text-xs text-slate-400 dark:text-slate-500">
            /post/{{ form.slug }}
          </p>
        </div>

        <div class="card p-5">
          <h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">分类</h3>
          <select v-model="form.category_id" class="input">
            <option :value="null">未分类</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>

        <div class="card p-5">
          <h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">标签</h3>
          <div v-if="allTags.length" class="flex flex-wrap gap-2">
            <button
              v-for="tag in allTags"
              :key="tag.id"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="form.tag_ids.includes(tag.id)
                ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
                : 'border-slate-200 text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:text-slate-400'"
              @click="toggleTag(tag.id)"
            >
              {{ tag.name }}
            </button>
          </div>
          <p v-else class="text-xs text-slate-400">暂无标签，可先在标签管理中创建</p>
        </div>

        <div class="card p-5">
          <h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">封面图 URL（可选）</h3>
          <input v-model="form.cover_image" type="url" placeholder="https://..." class="input" />
          <p class="mt-2 text-xs text-slate-400">留空时前台会自动生成渐变封面</p>
        </div>

        <button class="btn-primary w-full" :disabled="saving" @click="save()">保存全部修改</button>
        <router-link to="/home/posts" class="btn-ghost w-full">返回列表</router-link>
      </aside>
    </div>
  </div>
</template>
