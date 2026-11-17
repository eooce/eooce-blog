<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import CommentSection from '@/components/CommentSection.vue'
</script>

<template>
  <div class="container-page py-10">
    <PageHeader title="留言板" eyebrow="Guestbook" description="随便聊聊，留下你的想法与建议，审核通过后会展示在这里" />

    <!-- 左移量对齐标题「留言板」的第三个字（2 个字宽），随标题字号在 sm 断点变化 -->
    <div class="ml-[3.625rem] max-w-3xl sm:ml-[4.375rem]">
      <CommentSection source="guestbook" />
    </div>
  </div>
</template>
