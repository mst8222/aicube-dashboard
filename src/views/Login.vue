<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <span class="logo-icon">🧊</span>
        <h1>ClawCube</h1>
        <p>身份验证</p>
      </div>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" type="text" placeholder="请输入用户名" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        </div>
        <div class="error-msg" v-if="errorMsg">{{ errorMsg }}</div>
        <button type="submit" class="btn-login" :disabled="loading">
          {{ loading ? '验证中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    const json = await res.json()
    if (json.success) {
      authStore.login(json.token, json.user)
      router.push('/')
    } else {
      errorMsg.value = json.error || '登录失败'
    }
  } catch (e) {
    errorMsg.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  padding: 20px;
}
.login-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 380px;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.logo-icon { font-size: 48px; display: block; margin-bottom: 8px; }
.login-header h1 {
  font-size: 28px;
  font-weight: bold;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}
.login-header p { color: #64748b; font-size: 14px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
.form-group input {
  width: 100%;
  padding: 12px;
  background: #0f1520;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 15px;
  box-sizing: border-box;
}
.form-group input:focus { outline: none; border-color: #00D9C4; }
.error-msg {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 10px 14px;
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 16px;
}
.btn-login {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}
.btn-login:hover { opacity: 0.9; }
.btn-login:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
