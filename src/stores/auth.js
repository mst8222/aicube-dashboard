// 简单的 auth store（无第三方依赖）
import { reactive, readonly } from 'vue'

const STORAGE_KEY = 'aicube_auth'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const state = reactive({
  token: loadFromStorage()?.token || null,
  user: loadFromStorage()?.user || null,
  isLoggedIn: !!(loadFromStorage()?.token)
})

function login(token, user) {
  state.token = token
  state.user = user
  state.isLoggedIn = true
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
}

function logout() {
  state.token = null
  state.user = null
  state.isLoggedIn = false
  localStorage.removeItem(STORAGE_KEY)
}

function getToken() {
  return state.token
}

export function useAuthStore() {
  return {
    state: readonly(state),
    login,
    logout,
    getToken,
    isLoggedIn: readonly(state).isLoggedIn,
  }
}
