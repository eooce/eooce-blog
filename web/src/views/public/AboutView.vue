<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MarkdownView from '@/components/MarkdownView.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useSiteStore } from '@/stores/site'

const site = useSiteStore()
const loading = ref(true)

onMounted(async () => {
  site.loaded = false
  await site.fetch()
  loading.value = false
})
</script>

<template>
  <div class="container-page py-10">
    <PageHeader title="关于" eyebrow="About" description="关于博主与这个站点" />

    <div v-if="loading" class="card mx-auto h-64 max-w-3xl animate-pulse bg-slate-100 dark:bg-slate-800" />

    <div v-reveal v-else class="card mx-auto max-w-3xl p-8 sm:p-10">
      <MarkdownView v-if="site.info.about_content" :content="site.info.about_content" />
      <p v-else class="py-10 text-center text-sm text-slate-400">博主还没有填写关于页内容</p>
    </div>
  </div>
</template>
