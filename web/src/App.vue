<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import ScrollProgress from '@/components/ScrollProgress.vue'
import BackToTop from '@/components/BackToTop.vue'
import { useSiteStore } from '@/stores/site'

const route = useRoute()
const isBare = computed(() => route.meta.bare === true)
// 每次整页加载拉取站点信息，保证任意路由下页头/页脚标题正确
// 注意：浏览器标签页标题以 index.html 的 <title> 为准，不在此处覆盖
const site = useSiteStore()
onMounted(() => site.fetch())
</script>

<template>
  <router-view v-if="isBare" />
  <div v-else class="flex min-h-screen flex-col">
    <ScrollProgress />
    <SiteHeader />
    <main class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <SiteFooter />
    <BackToTop />
  </div>
</template>
