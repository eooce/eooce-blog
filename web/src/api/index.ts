import client from './client'
import type {
  AdminMenuItem,
  AdminPostRow,
  AdminStats,
  Category,
  Comment,
  CustomPage,
  FriendLink,
  GuestbookMessage,
  PageData,
  PostDetail,
  PostItem,
  PublicNavItem,
  SiteInfo,
  Tag,
} from '@/types'

/* ---------------- public ---------------- */

export interface PostQuery {
  page?: number
  pageSize?: number
  category?: string
  tag?: string
  search?: string
}

export const publicApi = {
  site: () => client.get<unknown, SiteInfo>('/site'),
  posts: (params: PostQuery) => client.get<unknown, PageData<PostItem>>('/posts', { params }),
  post: (slug: string) => client.get<unknown, PostDetail>(`/posts/${slug}`),
  comments: (slug: string) => client.get<unknown, Comment[]>(`/posts/${slug}/comments`),
  addComment: (slug: string, body: { nickname: string; email: string; content: string }) =>
    client.post(`/posts/${slug}/comments`, body),
  categories: () => client.get<unknown, Category[]>('/categories'),
  tags: () => client.get<unknown, Tag[]>('/tags'),
  archives: () =>
    client.get<unknown, { total: number; groups: Array<{ month: string; posts: PostItem[] }> }>('/archives'),
  nav: () => client.get<unknown, PublicNavItem[]>('/nav'),
  page: (slug: string) => client.get<unknown, CustomPage>(`/pages/${slug}`),
  guestbook: () => client.get<unknown, GuestbookMessage[]>('/guestbook'),
  addGuestbook: (body: { nickname: string; email: string; content: string }) => client.post('/guestbook', body),
  links: () => client.get<unknown, FriendLink[]>('/links'),
}

/* ---------------- auth ---------------- */

export const authApi = {
  captcha: () => client.get<unknown, { id: string; svg: string }>('/auth/captcha'),
  login: (body: { username: string; password: string; captcha_id: string; captcha_code: string }) =>
    client.post<unknown, { token: string; username: string }>('/auth/login', body),
}

/* ---------------- admin ---------------- */

export const adminApi = {
  stats: () => client.get<unknown, AdminStats>('/admin/stats'),

  posts: (params: { page?: number; pageSize?: number; status?: string; q?: string }) =>
    client.get<unknown, PageData<AdminPostRow>>('/admin/posts', { params }),
  post: (id: number) =>
    client.get<unknown, AdminPostRow & { content: string; cover_image: string; tag_ids: number[] }>(`/admin/posts/${id}`),
  createPost: (body: Record<string, unknown>) => client.post<unknown, { id: number; slug: string }>('/admin/posts', body),
  updatePost: (id: number, body: Record<string, unknown>) => client.put(`/admin/posts/${id}`, body),
  patchPostStatus: (id: number, body: { status?: string; pinned?: boolean }) =>
    client.patch(`/admin/posts/${id}/status`, body),
  deletePost: (id: number) => client.delete(`/admin/posts/${id}`),

  categories: () => client.get<unknown, Category[]>('/admin/categories'),
  createCategory: (body: { name: string; slug?: string; description?: string }) =>
    client.post<unknown, { id: number }>('/admin/categories', body),
  updateCategory: (id: number, body: { name: string; slug?: string; description?: string }) =>
    client.put(`/admin/categories/${id}`, body),
  deleteCategory: (id: number) => client.delete(`/admin/categories/${id}`),
  moveCategory: (id: number, direction: 'up' | 'down') =>
    client.patch(`/admin/categories/${id}/move`, { direction }),

  tags: () => client.get<unknown, Tag[]>('/admin/tags'),
  createTag: (body: { name: string }) => client.post<unknown, { id: number }>('/admin/tags', body),
  updateTag: (id: number, body: { name: string }) => client.put(`/admin/tags/${id}`, body),
  deleteTag: (id: number) => client.delete(`/admin/tags/${id}`),
  /** 设为首页蜂窝 C 位（独占） */
  setTagCenter: (id: number) => client.patch(`/admin/tags/${id}/center`, {}),

  comments: (params: { page?: number; pageSize?: number; status?: string }) =>
    client.get<unknown, PageData<Comment>>('/admin/comments', { params }),
  patchCommentStatus: (id: number, status: string) =>
    client.patch(`/admin/comments/${id}/status`, { status }),
  deleteComment: (id: number) => client.delete(`/admin/comments/${id}`),

  updateSite: (body: Record<string, unknown>) => client.put('/admin/site', body),
  updateAccount: (body: { current_password: string; username?: string; new_password?: string }) =>
    client.put<unknown, { token: string; username: string; message: string }>('/admin/account', body),

  menus: () => client.get<unknown, AdminMenuItem[]>('/admin/menus'),
  guestbook: (params: { page?: number; pageSize?: number; status?: string }) =>
    client.get<unknown, PageData<GuestbookMessage>>('/admin/guestbook', { params }),
  patchGuestbookStatus: (id: number, status: string) =>
    client.patch(`/admin/guestbook/${id}/status`, { status }),
  deleteGuestbook: (id: number) => client.delete(`/admin/guestbook/${id}`),

  links: () => client.get<unknown, FriendLink[]>('/admin/links'),
  createLink: (body: { name: string; url: string; description?: string; visible?: boolean }) =>
    client.post<unknown, { id: number }>('/admin/links', body),
  updateLink: (id: number, body: { name: string; url: string; description?: string; visible?: boolean }) =>
    client.put(`/admin/links/${id}`, body),
  moveLink: (id: number, direction: 'up' | 'down') => client.patch(`/admin/links/${id}/move`, { direction }),
  deleteLink: (id: number) => client.delete(`/admin/links/${id}`),
  createMenu: (body: Record<string, unknown>) => client.post<unknown, { id: number }>('/admin/menus', body),
  updateMenu: (id: number, body: Record<string, unknown>) => client.put(`/admin/menus/${id}`, body),
  moveMenu: (id: number, direction: 'up' | 'down') =>
    client.patch(`/admin/menus/${id}/move`, { direction }),
  deleteMenu: (id: number) => client.delete(`/admin/menus/${id}`),
}
