import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { BASE_TITLE } from '@/utils/title'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 首页不设 meta.title：标签页只显示主标题（index.html 的 <title>）
    { path: '/', name: 'home', component: () => import('@/views/public/HomeView.vue') },
    { path: '/post/:slug', name: 'post-detail', component: () => import('@/views/public/PostDetailView.vue') },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/public/CategoriesView.vue'),
      meta: { title: '分类' },
    },
    {
      path: '/category/:slug',
      name: 'category-posts',
      component: () => import('@/views/public/CategoryPostsView.vue'),
      props: { kind: 'category' as const },
      meta: { title: '分类' },
    },
    { path: '/tags', name: 'tags', component: () => import('@/views/public/TagsView.vue'), meta: { title: '标签' } },
    {
      path: '/tag/:slug',
      name: 'tag-posts',
      component: () => import('@/views/public/TagPostsView.vue'),
      meta: { title: '标签' },
    },
    {
      path: '/archives',
      name: 'archives',
      component: () => import('@/views/public/ArchivesView.vue'),
      meta: { title: '归档' },
    },
    { path: '/search', name: 'search', component: () => import('@/views/public/SearchView.vue'), meta: { title: '搜索' } },
    { path: '/about', name: 'about', component: () => import('@/views/public/AboutView.vue'), meta: { title: '关于' } },
    {
      path: '/guestbook',
      name: 'guestbook',
      component: () => import('@/views/public/GuestbookView.vue'),
      meta: { title: '留言板' },
    },
    { path: '/page/:slug', name: 'custom-page', component: () => import('@/views/public/CustomPageView.vue') },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/public/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },

    {
      path: '/home/login',
      name: 'admin-login',
      component: () => import('@/views/admin/LoginView.vue'),
      meta: { bare: true, title: '登录' },
    },
    {
      path: '/home',
      component: () => import('@/views/admin/AdminLayout.vue'),
      // 管理后台独立布局：不渲染前台的页头与页脚
      meta: { bare: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/DashboardView.vue'),
          meta: { title: '仪表盘' },
        },
        {
          path: 'posts',
          name: 'admin-posts',
          component: () => import('@/views/admin/PostListView.vue'),
          meta: { title: '文章管理' },
        },
        {
          path: 'posts/new',
          name: 'admin-post-new',
          component: () => import('@/views/admin/PostEditView.vue'),
          meta: { title: '写文章' },
        },
        {
          path: 'posts/:id/edit',
          name: 'admin-post-edit',
          component: () => import('@/views/admin/PostEditView.vue'),
          meta: { title: '编辑文章' },
        },
        {
          path: 'categories',
          name: 'admin-categories',
          component: () => import('@/views/admin/CategoryListView.vue'),
          meta: { title: '分类管理' },
        },
        {
          path: 'tags',
          name: 'admin-tags',
          component: () => import('@/views/admin/TagListView.vue'),
          meta: { title: '标签管理' },
        },
        {
          path: 'comments',
          name: 'admin-comments',
          component: () => import('@/views/admin/CommentListView.vue'),
          meta: { title: '评论管理' },
        },
        {
          path: 'menus',
          name: 'admin-menus',
          component: () => import('@/views/admin/MenuManageView.vue'),
          meta: { title: '菜单管理' },
        },
        {
          path: 'links',
          name: 'admin-links',
          component: () => import('@/views/admin/FriendLinksView.vue'),
          meta: { title: '友情链接' },
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/views/admin/SiteSettingsView.vue'),
          meta: { title: '站点设置' },
        },
      ],
    },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 90 }
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.path.startsWith('/home') && to.name !== 'admin-login' && !auth.isLoggedIn) {
    return { path: '/home/login', query: { redirect: to.fullPath } }
  }
})

// 标签页标题：首页只显示主标题，其余页面为「主标题-页面标题」（动态页面由视图自行覆盖）
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${BASE_TITLE}-${title}` : BASE_TITLE
})

export default router