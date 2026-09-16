import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const client = axios.create({ baseURL: '/api', timeout: 15000 })

export interface ApiError extends Error {
  status?: number
}

client.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`
  return config
})

client.interceptors.response.use(
  (res) => res.data.data,
  (err) => {
    const status = err.response?.status
    const message: string = err.response?.data?.message ?? '网络异常，请稍后重试'
    if (status === 401) {
      const auth = useAuthStore()
      auth.logout()
      if (router.currentRoute.value.path.startsWith('/home')) {
        router.push({ path: '/home/login', query: { redirect: router.currentRoute.value.fullPath } })
      }
    }
    const error = new Error(message) as ApiError
    error.status = status
    return Promise.reject(error)
  },
)

export default client
