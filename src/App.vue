<template>
  <!-- 登录页：全屏纯净，无菜单 -->
  <router-view v-if="$route.name === 'login'" />

  <!-- 管理后台：正常布局 -->
  <div class="app-container" v-else>
    <!-- 移动端顶部栏 -->
    <header class="mobile-header">
      <button class="hamburger" @click="menuOpen = !menuOpen">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="mobile-logo">
        <span class="logo-icon">🧊</span>
        <span class="logo-text">ClawCube</span>
      </div>
    </header>

    <!-- 移动端菜单遮罩 -->
    <div class="menu-overlay" v-if="menuOpen" @click="menuOpen = false"></div>

    <!-- 左侧菜单 -->
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="logo">
        <span class="logo-icon">🧊</span>
        <span class="logo-text">ClawCube</span>
      </div>
      <nav class="nav-menu">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
          @click="menuOpen = false"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="btn-logout" @click="logout">
          <span>🚪</span> 退出登录
        </button>
        <div class="version">v1.0.0</div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const menuOpen = ref(false)

function logout() {
  auth.logout()
  router.push('/login')
}

const menuItems = [
  { path: '/', icon: '📊', label: '设备看板' },
  { path: '/channels', icon: '📡', label: '频道管理' },
  { path: '/sessions', icon: '💬', label: '会话/任务' },
  { path: '/models', icon: '🤖', label: '模型管理' },
  { path: '/skills', icon: '🛠️', label: '技能管理' },
  { path: '/plugins', icon: '📦', label: '插件管理' },
  { path: '/agent-list', icon: '📋', label: '智能体管理' },
  { path: '/agents', icon: '🏢', label: '智能体办公室' },
]
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

.app-container {
  display: flex;
  min-height: 100vh;
}

/* 移动端顶部栏 */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  z-index: 100;
  padding: 0 16px;
  align-items: center;
  gap: 16px;
}

.hamburger {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: #e2e8f0;
  border-radius: 1px;
}

.mobile-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-logo .logo-icon {
  font-size: 24px;
}

.mobile-logo .logo-text {
  font-size: 18px;
  font-weight: bold;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 菜单遮罩 */
.menu-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #334155;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 200;
}

.logo {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #334155;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 20px;
  font-weight: bold;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-menu {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #334155;
  color: #e2e8f0;
}

.nav-item.active {
  background: #3b82f6;
  color: white;
}

.nav-icon {
  font-size: 18px;
}

.nav-label {
  font-size: 14px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-logout {
  width: 100%;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.btn-logout:hover { background: rgba(239, 68, 68, 0.25); }

.version {
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

/* 主内容区 */
.main-content {
  flex: 1;
  padding: 24px;
  margin-left: 240px;
  max-height: 100vh;
  overflow-y: auto;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }
  
  .menu-overlay {
    display: block;
  }
  
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.open {
    transform: translateX(0);
  }
  
  .main-content {
    margin-left: 0;
    margin-top: 56px;
    padding: 16px;
  }
  
  .nav-label {
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 12px;
  }
  
  .nav-item {
    padding: 14px 16px;
  }
}
</style>
