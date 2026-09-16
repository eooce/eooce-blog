<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import type { AdminMenuItem, NavMenuType } from '@/types'
import { useNavStore } from '@/stores/nav'

const navStore = useNavStore()

const menus = ref<AdminMenuItem[]>([])
const loading = ref(true)
const message = ref('')
const error = ref('')

/* ---------------- 弹窗状态 ---------------- */
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const parentId = ref<number | null>(null)
const form = ref({
  label: '',
  type: 'page' as NavMenuType,
  url: '',
  system_path: '/archives',
  visible: true,
  page_title: '',
  page_slug: '',
  page_content: '',
})
const saving = ref(false)
const dialogError = ref('')

const TYPE_LABELS: Record<NavMenuType, string> = {
  system: '系统页面',
  group: '多页分组',
  page: '单页',
  link: '直接跳转',
}

const dialogTypes = computed<{ value: NavMenuType; label: string }[]>(() => {
  if (dialogMode.value === 'edit') return []
  return parentId.value
    ? [
        { value: 'page', label: '单页' },
        { value: 'link', label: '直接跳转' },
      ]
    : [
        { value: 'page', label: '单页' },
        { value: 'group', label: '多页分组' },
        { value: 'link', label: '直接跳转' },
      ]
})

/* ---------------- 数据 ---------------- */
async function load() {
  loading.value = true
  try {
    menus.value = await adminApi.menus()
  } finally {
    loading.value = false
  }
}

const topMenus = computed(() => menus.value.filter((m) => m.parent_id === null))
const childrenOf = (id: number) => menus.value.filter((m) => m.parent_id === id)

function targetText(m: AdminMenuItem): string {
  if (m.type === 'system') return m.system_path
  if (m.type === 'page') return `/page/${m.page_slug ?? ''}`
  if (m.type === 'link') return m.url
  return '包含子菜单'
}

/* ---------------- 新增 / 编辑 ---------------- */
function openCreate(parent: AdminMenuItem | null) {
  dialogMode.value = 'create'
  editingId.value = null
  parentId.value = parent?.id ?? null
  form.value = {
    label: '',
    type: parent ? 'page' : 'page',
    url: 'https://',
    system_path: '/archives',
    visible: true,
    page_title: '',
    page_slug: '',
    page_content: '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(item: AdminMenuItem) {
  dialogMode.value = 'edit'
  editingId.value = item.id
  parentId.value = item.parent_id
  form.value = {
    label: item.label,
    type: item.type,
    url: item.url || 'https://',
    system_path: item.system_path || '/archives',
    visible: item.visible === 1,
    page_title: item.page_title ?? '',
    page_slug: item.page_slug ?? '',
    page_content: item.page_content ?? '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

async function save() {
  dialogError.value = ''
  const f = form.value
  if (!f.label.trim()) {
    dialogError.value = '请填写菜单名称'
    return
  }
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      const body: Record<string, unknown> = {
        label: f.label.trim(),
        type: f.type,
        parent_id: parentId.value,
        visible: f.visible,
      }
      if (f.type === 'link') body.url = f.url.trim()
      if (f.type === 'system') body.system_path = f.system_path
      if (f.type === 'page') {
        body.page = { title: f.page_title.trim() || f.label.trim(), slug: f.page_slug.trim(), content: f.page_content }
      }
      await adminApi.createMenu(body)
    } else if (editingId.value) {
      const body: Record<string, unknown> = { label: f.label.trim(), visible: f.visible }
      if (f.type === 'link') body.url = f.url.trim()
      if (f.type === 'system') body.system_path = f.system_path
      if (f.type === 'page') {
        body.page = { title: f.page_title.trim() || f.label.trim(), slug: f.page_slug.trim(), content: f.page_content }
      }
      await adminApi.updateMenu(editingId.value, body)
    }
    dialogOpen.value = false
    message.value = '菜单已保存'
    error.value = ''
    await Promise.all([load(), navStore.reload()])
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

/* ---------------- 操作 ---------------- */
async function move(item: AdminMenuItem, direction: 'up' | 'down') {
  await adminApi.moveMenu(item.id, direction)
  await load()
}

async function toggleVisible(item: AdminMenuItem) {
  await adminApi.updateMenu(item.id, {
    label: item.label,
    visible: item.visible !== 1,
    ...(item.type === 'link' ? { url: item.url } : {}),
    ...(item.type === 'system' ? { system_path: item.system_path } : {}),
    ...(item.type === 'page' && item.page_id
      ? { page: { title: item.page_title ?? item.label, slug: item.page_slug ?? '', content: item.page_content ?? '' } }
      : {}),
  })
  await load()
}

async function remove(item: AdminMenuItem) {
  const extra =
    item.type === 'group' && childrenOf(item.id).length
      ? '该分组下的子菜单也会一并删除。'
      : item.type === 'page'
        ? '对应的单页内容将一并删除。'
        : ''
  if (!window.confirm(`确定删除菜单「${item.label}」吗？${extra}`)) return
  try {
    await adminApi.deleteMenu(item.id)
    message.value = '菜单已删除'
    error.value = ''
    await Promise.all([load(), navStore.reload()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-6 flex items-end justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">菜单管理</h1>
        <p class="mt-1 text-sm text-slate-400">管理前台导航：单页、多页分组与跳转链接，支持排序与显隐</p>
      </div>
      <button type="button" class="btn-primary shrink-0" @click="openCreate(null)">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 5v14m-7-7h14" stroke-linecap="round" />
        </svg>
        新增菜单
      </button>
    </div>

    <p v-if="message" class="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{{ message }}</p>
    <p v-else-if="error" class="mb-4 text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

    <div v-if="loading" class="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />

    <div v-else class="card divide-y divide-slate-100 dark:divide-slate-800">
      <div v-for="item in topMenus" :key="item.id" class="p-4">
        <!-- 顶级菜单 -->
        <div class="flex items-center gap-3">
          <span
            class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            :class="
              item.type === 'system'
                ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
            "
          >
            {{ TYPE_LABELS[item.type] }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              {{ item.label }}
              <span v-if="item.visible !== 1" class="ml-1.5 text-xs font-normal text-slate-400">（已隐藏）</span>
            </p>
            <p class="truncate text-xs text-slate-400">{{ targetText(item) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="上移" @click="move(item, 'up')">↑</button>
            <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="下移" @click="move(item, 'down')">↓</button>
            <button
              v-if="item.type !== 'system'"
              class="btn-ghost h-8 w-8 !p-0"
              :title="item.visible === 1 ? '隐藏' : '显示'"
              @click="toggleVisible(item)"
            >
              <svg v-if="item.visible === 1" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17.4 17.4 0 0 1-2.2 3M6.6 6.6C3.8 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.9-.4 4.1-1" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button class="btn-ghost h-8 !px-2 text-xs" @click="openEdit(item)">编辑</button>
            <button class="btn-ghost h-8 w-8 !p-0 text-rose-500" title="删除" @click="remove(item)">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="m4 7 16 0M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 子菜单 -->
        <div v-if="item.type === 'group'" class="mt-3 space-y-2 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
          <div v-for="child in childrenOf(item.id)" :key="child.id" class="flex items-center gap-3">
            <span class="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {{ TYPE_LABELS[child.type] }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-slate-700 dark:text-slate-300">
                {{ child.label }}
                <span v-if="child.visible !== 1" class="ml-1 text-xs text-slate-400">（已隐藏）</span>
              </p>
              <p class="truncate text-xs text-slate-400">{{ targetText(child) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="上移" @click="move(child, 'up')">↑</button>
              <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="下移" @click="move(child, 'down')">↓</button>
              <button class="btn-ghost h-8 !px-2 text-xs" @click="openEdit(child)">编辑</button>
              <button class="btn-ghost h-8 w-8 !p-0 text-rose-500" title="删除" @click="remove(child)">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path d="m4 7 16 0M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-2 text-xs text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-500 dark:border-slate-700"
            @click="openCreate(item)"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M12 5v14m-7-7h14" stroke-linecap="round" />
            </svg>
            添加子菜单
          </button>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="dialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="dialogOpen = false" />
      <div class="card relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 class="mb-1 text-lg font-bold text-slate-900 dark:text-white">
          {{ dialogMode === 'create' ? (parentId ? '添加子菜单' : '新增菜单') : '编辑菜单' }}
        </h2>
        <p v-if="dialogMode === 'create' && parentId" class="mb-4 text-xs text-slate-400">将添加为「多页分组」的子菜单</p>

        <!-- 类型选择（仅新增） -->
        <div v-if="dialogMode === 'create'" class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">菜单类型</label>
          <div class="flex gap-2">
            <button
              v-for="t in dialogTypes"
              :key="t.value"
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all"
              :class="
                form.type === t.value
                  ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-slate-200 text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:text-slate-400'
              "
              @click="form.type = t.value"
            >
              {{ t.label }}
            </button>
          </div>
          <p class="mt-1.5 text-xs text-slate-400">
            {{
              form.type === 'group'
                ? '「多页分组」在前台显示为下拉菜单，可包含多个子菜单'
                : form.type === 'link'
                  ? '点击菜单将在新标签页打开外部链接'
                  : '创建一个自定义内容页面（支持 Markdown）'
            }}
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">菜单名称 *</label>
            <input v-model="form.label" type="text" maxlength="30" class="input" placeholder="显示在导航栏的文字" />
          </div>

          <!-- 单页字段 -->
          <template v-if="form.type === 'page'">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">页面标题 *</label>
                <input v-model="form.page_title" type="text" maxlength="60" class="input" placeholder="默认与菜单名称相同" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">页面 Slug</label>
                <input v-model="form.page_slug" type="text" maxlength="80" class="input" placeholder="留空自动生成" />
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">页面内容（Markdown）</label>
              <textarea v-model="form.page_content" rows="7" class="input resize-y font-mono text-[13px]" placeholder="支持 Markdown 语法" />
            </div>
          </template>

          <!-- 跳转字段 -->
          <div v-if="form.type === 'link'">
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">链接地址 *</label>
            <input v-model="form.url" type="text" maxlength="500" class="input" placeholder="https://example.com" />
            <p class="mt-1 text-xs text-slate-400">前台点击时将在新标签页打开</p>
          </div>

          <!-- 系统页面（仅编辑内置菜单时可选路径） -->
          <div v-if="form.type === 'system' && dialogMode === 'edit'">
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">指向页面</label>
            <select v-model="form.system_path" class="input">
              <option value="/">首页</option>
              <option value="/archives">归档</option>
              <option value="/about">关于</option>
            </select>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input v-model="form.visible" type="checkbox" class="h-4 w-4 rounded accent-brand-500" />
            在前台导航中显示
          </label>
        </div>

        <p v-if="dialogError" class="mt-4 text-sm text-rose-600 dark:text-rose-400">{{ dialogError }}</p>

        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn-outline" @click="dialogOpen = false">取消</button>
          <button type="button" class="btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
