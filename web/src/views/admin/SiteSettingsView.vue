<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const site = useSiteStore()
const auth = useAuthStore()

/* ---------------- 站点信息 ---------------- */
const form = ref({ site_title: '', site_subtitle: '', about_content: '', site_logo: '' })
const savingSite = ref(false)
const siteMessage = ref('')
const siteError = ref('')
const logoInput = ref<HTMLInputElement | null>(null)
const logoError = ref('')

async function loadSite() {
  site.loaded = false
  await site.fetch()
  form.value = {
    site_title: site.info.site_title,
    site_subtitle: site.info.site_subtitle,
    about_content: site.info.about_content,
    site_logo: site.info.site_logo ?? '',
  }
}

function pickLogo() {
  logoInput.value?.click()
}

function onLogoChange(e: Event) {
  logoError.value = ''
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    logoError.value = '请选择图片文件'
    input.value = ''
    return
  }
  if (file.size > 400 * 1024) {
    logoError.value = '图片不能超过 400KB，请压缩后再上传'
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.value.site_logo = reader.result as string
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function resetLogo() {
  form.value.site_logo = ''
  logoError.value = ''
}

async function saveSite() {
  siteMessage.value = ''
  siteError.value = ''
  if (!form.value.site_title.trim()) {
    siteError.value = '站点标题不能为空'
    return
  }
  savingSite.value = true
  try {
    await adminApi.updateSite({ ...form.value })
    await site.reload()
    siteMessage.value = '站点信息已保存，前台刷新后生效'
  } catch (e) {
    siteError.value = e instanceof Error ? e.message : '保存失败，请重试'
  } finally {
    savingSite.value = false
  }
}

/* ---------------- 账号安全 ---------------- */
const accountForm = ref({ current_password: '', username: '', new_password: '', confirm_password: '' })
const savingAccount = ref(false)
const accountMessage = ref('')
const accountError = ref('')

async function saveAccount() {
  accountMessage.value = ''
  accountError.value = ''
  if (!accountForm.value.current_password) {
    accountError.value = '请输入当前密码'
    return
  }
  if (!accountForm.value.username && !accountForm.value.new_password) {
    accountError.value = '用户名和新密码至少填写一项'
    return
  }
  if (accountForm.value.new_password && accountForm.value.new_password !== accountForm.value.confirm_password) {
    accountError.value = '两次输入的新密码不一致'
    return
  }
  savingAccount.value = true
  try {
    const res = await adminApi.updateAccount({
      current_password: accountForm.value.current_password,
      username: accountForm.value.username.trim() || undefined,
      new_password: accountForm.value.new_password || undefined,
    })
    auth.setSession(res.token, res.username)
    accountMessage.value = '账号信息已更新'
    accountForm.value = { current_password: '', username: '', new_password: '', confirm_password: '' }
  } catch (e) {
    accountError.value = e instanceof Error ? e.message : '更新失败，请重试'
  } finally {
    savingAccount.value = false
  }
}

onMounted(loadSite)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <!-- 站点信息 -->
    <section class="card p-6 sm:p-8">
      <header class="mb-6">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">站点设置</h1>
        <p class="mt-1 text-sm text-slate-400">站点的名称、副标题、Logo 与关于页内容</p>
      </header>

      <div class="space-y-5">
        <!-- Logo -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">站点 Logo</label>
          <div class="flex items-center gap-4">
            <img
              :src="form.site_logo || '/favicon.ico'"
              alt="logo 预览"
              class="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-900"
            />
            <div class="flex flex-col gap-2">
              <div class="flex gap-2">
                <button type="button" class="btn-outline !py-1.5 text-xs" @click="pickLogo">
                  {{ form.site_logo ? '更换图片' : '上传图片' }}
                </button>
                <button
                  v-if="form.site_logo"
                  type="button"
                  class="btn-ghost !py-1.5 text-xs text-rose-500"
                  @click="resetLogo"
                >
                  恢复默认
                </button>
              </div>
              <p class="text-xs text-slate-400">支持 PNG / JPG / SVG / WebP，不超过 400KB</p>
              <p v-if="logoError" class="text-xs text-rose-500">{{ logoError }}</p>
            </div>
            <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="onLogoChange" />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">站点标题 *</label>
            <input v-model="form.site_title" type="text" maxlength="60" class="input" placeholder="例如：老王Blog" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">站点副标题</label>
            <input v-model="form.site_subtitle" type="text" maxlength="120" class="input" placeholder="一句话介绍你的站点" />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">关于页内容（Markdown）</label>
          <textarea
            v-model="form.about_content"
            rows="8"
            class="input resize-y font-mono text-[13px]"
            placeholder="支持 Markdown 语法，展示在「关于」页面"
          />
        </div>

        <div class="flex items-center justify-between gap-4">
          <p v-if="siteMessage" class="text-sm text-emerald-600 dark:text-emerald-400">{{ siteMessage }}</p>
          <p v-else-if="siteError" class="text-sm text-rose-600 dark:text-rose-400">{{ siteError }}</p>
          <span v-else class="text-xs text-slate-400">保存后前台立即生效</span>
          <button type="button" class="btn-primary shrink-0" :disabled="savingSite" @click="saveSite">
            {{ savingSite ? '保存中...' : '保存站点信息' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 账号安全 -->
    <section class="card p-6 sm:p-8">
      <header class="mb-6">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">账号安全</h2>
        <p class="mt-1 text-sm text-slate-400">修改管理员用户名或密码，需验证当前密码</p>
      </header>

      <div class="space-y-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">当前密码 *</label>
          <input v-model="accountForm.current_password" type="password" class="input" placeholder="输入当前密码以验证身份" autocomplete="current-password" />
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">新用户名</label>
            <input v-model="accountForm.username" type="text" maxlength="30" class="input" :placeholder="`当前：${auth.username || '未设置'}`" autocomplete="username" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">新密码</label>
            <input v-model="accountForm.new_password" type="password" maxlength="64" class="input" placeholder="至少 6 位，留空则不修改" autocomplete="new-password" />
          </div>
        </div>
        <div v-if="accountForm.new_password">
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">确认新密码 *</label>
          <input v-model="accountForm.confirm_password" type="password" maxlength="64" class="input" placeholder="再次输入新密码" autocomplete="new-password" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <p v-if="accountMessage" class="text-sm text-emerald-600 dark:text-emerald-400">{{ accountMessage }}</p>
          <p v-else-if="accountError" class="text-sm text-rose-600 dark:text-rose-400">{{ accountError }}</p>
          <span v-else class="text-xs text-slate-400">修改用户名后需使用新用户名重新登录</span>
          <button type="button" class="btn-primary shrink-0" :disabled="savingAccount" @click="saveAccount">
            {{ savingAccount ? '更新中...' : '更新账号信息' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
