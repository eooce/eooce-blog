export interface PostItem {
  id: number
  title: string
  slug: string
  summary: string
  cover_image: string
  category_name: string | null
  category_slug: string | null
  status: string
  pinned: number
  views: number
  reading_minutes: number
  published_at: string | null
  created_at: string
  updated_at: string
  tags: Array<{ name: string; slug: string }>
}

export interface PostDetail extends PostItem {
  content: string
  prev: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  post_count?: number
}

export interface Tag {
  id: number
  name: string
  slug: string
  post_count?: number
  /** 首页蜂窝 C 位标记（1 = C位） */
  is_center?: number
}

export interface Comment {
  id: number
  post_id?: number
  post_title?: string
  post_slug?: string
  nickname: string
  email?: string
  content: string
  status: string
  created_at: string
}

export interface GuestbookMessage {
  id: number
  nickname: string
  email?: string
  content: string
  status: string
  created_at: string
}

export interface FriendLink {
  id: number
  name: string
  url: string
  description: string
  sort_order?: number
  visible?: number
  created_at?: string
}

export interface SiteInfo {
  site_title: string
  site_subtitle: string
  about_content: string
  site_logo?: string
}

export type NavMenuType = 'system' | 'group' | 'page' | 'link'

export interface PublicNavItem {
  id: number
  label: string
  type: NavMenuType
  to: string
  url: string
  open_new_tab: boolean
  children: PublicNavItem[]
}

export interface AdminMenuItem {
  id: number
  parent_id: number | null
  label: string
  type: NavMenuType
  system_path: string
  page_id: number | null
  url: string
  sort_order: number
  visible: number
  page_title: string | null
  page_slug: string | null
  page_content: string | null
}

export interface CustomPage {
  title: string
  content: string
  updated_at: string
}

export interface AdminStats {
  posts: { total: number; published: number; drafts: number }
  comments: { total: number; pending: number }
  views: number
  trend: {
    posts: Array<{ date: string; count: number }>
    comments: Array<{ date: string; count: number }>
  }
}

export interface AdminPostRow {
  id: number
  title: string
  slug: string
  summary: string
  status: string
  pinned: number
  views: number
  reading_minutes: number
  published_at: string | null
  created_at: string
  updated_at: string
  category_name: string | null
  category_id: number | null
  comment_count: number
}
