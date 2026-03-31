// 全局 fetch 包装，自动附加前端 Bearer token，401 时跳转登录页
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const originalFetch = window.fetch
window.fetch = function(input, init = {}) {
  const auth = useAuthStore()
  const headers = new Headers(init.headers || {})
  if (auth.state.token) {
    headers.set('Authorization', `Bearer ${auth.state.token}`)
  }
  return originalFetch(input, { ...init, headers })
    .then(response => {
      if (response.status === 401) {
        auth.logout()
        router.push('/login')
        return response
      }
      return response
    })
}
