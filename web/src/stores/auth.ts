import { defineStore } from 'pinia'

const TOKEN_KEY = 'blog_admin_token'
const USER_KEY = 'blog_admin_user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    username: localStorage.getItem(USER_KEY) ?? '',
  }),
  getters: {
    isLoggedIn: (state) => state.token !== '',
  },
  actions: {
    setSession(token: string, username: string) {
      this.token = token
      this.username = username
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, username)
    },
    logout() {
      this.token = ''
      this.username = ''
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})
