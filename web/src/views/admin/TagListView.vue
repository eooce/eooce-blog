<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import type { Tag } from '@/types'

const tags = ref<Tag[]>([])
const loading = ref(true)
const creating = ref(false)
const newName = ref('')
const error = ref('')
const editing = ref<number | null>(null)
const editName = ref('')

async function load() {
  loading.value = true
  try {
    tags.value = await adminApi.tags()
  } finally {
    loading.value = false
  }
}

async function create() {
  error.value = ''
  if (!newName.value.trim()) return
  try {
    await adminApi.createTag({ name: newName.value.trim() })
    newName.value = ''
    creating.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  }
}

async function saveEdit(tag: Tag) {
  error.value = ''
  try {
    await adminApi.updateTag(tag.id, { name: editName.value.trim() })
    editing.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '更新失败'
  }
}

async function remove(tag: Tag) {
  if (!window.confirm(`确定删除标签「${tag.name}」？相关文章与该标签的关联会一并移除。`)) return
  await adminApi.deleteTag(tag.id)
  await load()
}

/** 设为首页蜂窝 C 位（独占） */
async function setCenter(tag: Tag) {
  error.value = ''
  try {
    await adminApi.setTagCenter(tag.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '设置失败'
  }
}

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">标签管理</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          删除标签会同时解除与文章的关联；星标标签将占据首页蜂窝的 C 位（仅一个）
        </p>
      </div>
      <button class="btn-primary" @click="creating = !creating">
        {{ creating ? '取消' : '新建标签' }}
      </button>
    </header>

    <div v-if="creating" class="card mb-5 flex gap-3 p-5">
      <input v-model="newName" type="text" placeholder="标签名称" class="input max-w-xs" maxlength="30" @keydown.enter="create" />
      <button class="btn-primary" @click="create">创建</button>
    </div>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
      {{ error }}
    </p>

    <div v-if="loading" class="card p-5">
      <div class="flex flex-wrap gap-3">
        <div v-for="i in 8" :key="i" class="h-9 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>

    <div v-else class="card p-6">
      <div v-if="tags.length" class="flex flex-wrap gap-3">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="flex items-center gap-2 rounded-full border border-slate-200 py-1.5 pl-4 pr-2 dark:border-slate-700"
        >
          <template v-if="editing === tag.id">
            <input
              v-model="editName"
              class="w-24 rounded-lg border border-brand-300 bg-transparent px-2 py-0.5 text-sm focus:outline-none dark:text-white"
              maxlength="30"
              @keydown.enter="saveEdit(tag)"
            />
            <button class="text-xs font-medium text-emerald-600" @click="saveEdit(tag)">保存</button>
            <button class="text-xs text-slate-400" @click="editing = null">取消</button>
          </template>
          <template v-else>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ tag.name }}
              <span class="ml-1 text-xs text-slate-400">{{ tag.post_count }}</span>
            </span>
            <span
              v-if="tag.is_center === 1"
              class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
              title="首页蜂窝 C 位"
            >
              ★ C位
            </span>
            <button class="text-xs text-brand-500 hover:underline" @click="editing = tag.id; editName = tag.name">编辑</button>
            <button
              class="text-xs text-slate-400 hover:text-amber-500 hover:underline"
              title="设为首页蜂窝 C 位"
              @click="setCenter(tag)"
            >
              ★ 设C位
            </button>
            <button class="text-xs text-rose-400 hover:underline" @click="remove(tag)">删除</button>
          </template>
        </div>
      </div>
      <p v-else class="py-8 text-center text-sm text-slate-400">暂无标签</p>
    </div>
  </div>
</template>
