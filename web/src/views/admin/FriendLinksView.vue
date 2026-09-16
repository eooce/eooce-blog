<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import type { FriendLink } from '@/types'

const links = ref<FriendLink[]>([])
const loading = ref(true)
const creating = ref(false)
const creating_busy = ref(false)
const error = ref('')
const editing = ref<number | null>(null)

const newForm = ref({ name: '', url: '', description: '' })
const editForm = ref({ name: '', url: '', description: '', visible: true })

async function load() {
  loading.value = true
  try {
    links.value = await adminApi.links()
  } finally {
    loading.value = false
  }
}

async function create() {
  error.value = ''
  if (!newForm.value.name.trim() || !newForm.value.url.trim()) return
  creating_busy.value = true
  try {
    await adminApi.createLink({
      name: newForm.value.name.trim(),
      url: newForm.value.url.trim(),
      description: newForm.value.description.trim(),
    })
    newForm.value = { name: '', url: '', description: '' }
    creating.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    creating_busy.value = false
  }
}

function startEdit(link: FriendLink) {
  editing.value = link.id
  editForm.value = {
    name: link.name,
    url: link.url,
    description: link.description,
    visible: link.visible !== 0,
  }
}

async function saveEdit(link: FriendLink) {
  error.value = ''
  try {
    await adminApi.updateLink(link.id, {
      name: editForm.value.name.trim(),
      url: editForm.value.url.trim(),
      description: editForm.value.description.trim(),
      visible: editForm.value.visible,
    })
    editing.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '更新失败'
  }
}

async function toggleVisible(link: FriendLink) {
  await adminApi.updateLink(link.id, {
    name: link.name,
    url: link.url,
    description: link.description,
    visible: link.visible === 0,
  })
  await load()
}

async function move(link: FriendLink, direction: 'up' | 'down') {
  await adminApi.moveLink(link.id, direction)
  await load()
}

async function remove(link: FriendLink) {
  if (!window.confirm(`确定删除友情链接「${link.name}」？`)) return
  await adminApi.deleteLink(link.id)
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">友情链接</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          展示在页脚的「友情链接」区块，点击新标签页打开
        </p>
      </div>
      <button class="btn-primary" @click="creating = !creating">
        {{ creating ? '取消' : '新增链接' }}
      </button>
    </header>

    <div v-if="creating" class="card mb-5 grid gap-3 p-5 sm:grid-cols-[1fr_1.5fr_auto]">
      <input v-model="newForm.name" type="text" placeholder="站点名称" class="input" maxlength="40" />
      <input v-model="newForm.url" type="url" placeholder="https://..." class="input" maxlength="500" />
      <button class="btn-primary" :disabled="creating_busy" @click="create">创建</button>
      <input
        v-model="newForm.description"
        type="text"
        placeholder="简介（可选）"
        class="input sm:col-span-3"
        maxlength="120"
      />
    </div>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
      {{ error }}
    </p>

    <div v-if="loading" class="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />

    <div v-else class="card divide-y divide-slate-100 dark:divide-slate-800">
      <div v-for="link in links" :key="link.id" class="flex items-center gap-3 p-4">
        <template v-if="editing === link.id">
          <input v-model="editForm.name" class="input !py-1.5" maxlength="40" />
          <input v-model="editForm.url" class="input !py-1.5" maxlength="500" />
          <input v-model="editForm.description" class="input hidden !py-1.5 lg:block" maxlength="120" placeholder="简介" />
          <label class="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input v-model="editForm.visible" type="checkbox" class="h-3.5 w-3.5 rounded accent-brand-500" />
            显示
          </label>
          <div class="flex shrink-0 gap-1">
            <button class="btn-ghost !px-2 text-xs text-emerald-600" @click="saveEdit(link)">保存</button>
            <button class="btn-ghost !px-2 text-xs" @click="editing = null">取消</button>
          </div>
        </template>
        <template v-else>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              {{ link.name }}
              <span v-if="link.visible === 0" class="ml-1.5 text-xs font-normal text-slate-400">（已隐藏）</span>
            </p>
            <p class="truncate text-xs text-slate-400">
              {{ link.url }}
              <span v-if="link.description" class="ml-2">{{ link.description }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="上移" @click="move(link, 'up')">↑</button>
            <button class="btn-ghost h-8 w-8 !p-0 text-xs" title="下移" @click="move(link, 'down')">↓</button>
            <button
              class="btn-ghost h-8 w-8 !p-0"
              :title="link.visible === 0 ? '显示' : '隐藏'"
              @click="toggleVisible(link)"
            >
              <svg v-if="link.visible !== 0" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17.4 17.4 0 0 1-2.2 3M6.6 6.6C3.8 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.9-.4 4.1-1" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button class="btn-ghost !px-2 text-xs text-brand-600 dark:text-brand-400" @click="startEdit(link)">编辑</button>
            <button class="btn-ghost h-8 w-8 !p-0 text-rose-500" title="删除" @click="remove(link)">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path d="m4 7 16 0M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </template>
      </div>
      <p v-if="!links.length" class="p-10 text-center text-sm text-slate-400">暂无友情链接，点击右上角新增</p>
    </div>
  </div>
</template>