<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import type { Category } from '@/types'

const categories = ref<Category[]>([])
const loading = ref(true)
const creating = ref(false)
const newName = ref('')
const newSlug = ref('')
const newDescription = ref('')
const error = ref('')
const editing = ref<number | null>(null)
const editForm = ref({ name: '', slug: '', description: '' })

async function load() {
  loading.value = true
  try {
    categories.value = await adminApi.categories()
  } finally {
    loading.value = false
  }
}

async function create() {
  error.value = ''
  if (!newName.value.trim()) return
  try {
    await adminApi.createCategory({
      name: newName.value.trim(),
      slug: newSlug.value.trim() || undefined,
      description: newDescription.value.trim(),
    })
    newName.value = ''
    newSlug.value = ''
    newDescription.value = ''
    creating.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  }
}

function startEdit(cat: Category) {
  editing.value = cat.id
  editForm.value = { name: cat.name, slug: cat.slug, description: cat.description }
}

async function saveEdit(cat: Category) {
  error.value = ''
  try {
    await adminApi.updateCategory(cat.id, {
      name: editForm.value.name.trim(),
      slug: editForm.value.slug.trim() || cat.slug,
      description: editForm.value.description.trim(),
    })
    editing.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '更新失败'
  }
}

async function remove(cat: Category) {
  if (!window.confirm(`确定删除分类「${cat.name}」？该分类下的文章会保留并变为未分类。`)) return
  await adminApi.deleteCategory(cat.id)
  await load()
}

/** 上移 / 下移：顺序即前台分类菜单与分类页的展示顺序 */
async function move(cat: Category, direction: 'up' | 'down') {
  error.value = ''
  try {
    await adminApi.moveCategory(cat.id, direction)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '排序失败'
  }
}

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">分类管理</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          删除分类后，其下文章将变为未分类；用「排序」列的箭头调整分类顺序，前台分类菜单与分类页会同步
        </p>
      </div>
      <button class="btn-primary" @click="creating = !creating">
        {{ creating ? '取消' : '新建分类' }}
      </button>
    </header>

    <div v-if="creating" class="card mb-5 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_2fr_auto]">
      <input v-model="newName" type="text" placeholder="分类名称" class="input" maxlength="30" />
      <input v-model="newSlug" type="text" placeholder="Slug（留空自动生成英文）" class="input" maxlength="60" />
      <input v-model="newDescription" type="text" placeholder="分类描述（可选）" class="input" maxlength="200" />
      <button class="btn-primary" @click="create">创建</button>
    </div>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
      {{ error }}
    </p>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[600px] text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
              <th class="px-5 py-3.5 font-semibold">名称</th>
              <th class="px-5 py-3.5 font-semibold">Slug</th>
              <th class="px-5 py-3.5 font-semibold">描述</th>
              <th class="px-5 py-3.5 font-semibold">文章数</th>
              <th class="px-5 py-3.5 font-semibold">排序</th>
              <th class="px-5 py-3.5 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody v-if="!loading">
            <tr
              v-for="(cat, i) in categories"
              :key="cat.id"
              class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-800/40"
            >
              <td class="px-5 py-4">
                <template v-if="editing === cat.id">
                  <input v-model="editForm.name" class="input !py-1.5" maxlength="30" />
                </template>
                <template v-else>
                  <span class="font-medium text-slate-800 dark:text-slate-100">{{ cat.name }}</span>
                </template>
              </td>
              <td class="px-5 py-4 text-xs text-slate-400">
                <template v-if="editing === cat.id">
                  <input v-model="editForm.slug" class="input w-36 !py-1.5 text-xs" maxlength="60" />
                </template>
                <template v-else>
                  {{ cat.slug }}
                </template>
              </td>
              <td class="max-w-xs px-5 py-4">
                <template v-if="editing === cat.id">
                  <input v-model="editForm.description" class="input !py-1.5" maxlength="200" />
                </template>
                <template v-else>
                  <span class="text-slate-500 dark:text-slate-400">{{ cat.description || '—' }}</span>
                </template>
              </td>
              <td class="px-5 py-4 text-slate-500 dark:text-slate-400">{{ cat.post_count ?? 0 }}</td>
              <td class="px-5 py-4">
                <div class="flex items-center gap-1">
                  <button
                    class="btn-ghost h-7 w-7 rounded-lg p-0 text-xs disabled:opacity-30"
                    title="上移"
                    :disabled="i === 0"
                    @click="move(cat, 'up')"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="m6 15 6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    class="btn-ghost h-7 w-7 rounded-lg p-0 text-xs disabled:opacity-30"
                    title="下移"
                    :disabled="i === categories.length - 1"
                    @click="move(cat, 'down')"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="px-5 py-4">
                <div class="flex justify-end gap-1.5">
                  <template v-if="editing === cat.id">
                    <button class="btn-ghost !px-2 text-xs text-emerald-600" @click="saveEdit(cat)">保存</button>
                    <button class="btn-ghost !px-2 text-xs" @click="editing = null">取消</button>
                  </template>
                  <template v-else>
                    <button class="btn-ghost !px-2 text-xs text-brand-600 dark:text-brand-400" @click="startEdit(cat)">编辑</button>
                    <button class="btn-ghost !px-2 text-xs text-rose-500" @click="remove(cat)">删除</button>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="!categories.length">
              <td colspan="6" class="px-5 py-10 text-center text-sm text-slate-400">暂无分类</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="loading" class="space-y-3 p-5">
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  </div>
</template>
