import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import ChannelManage from '@/views/ChannelManage.vue'
import ModelManage from '@/views/ModelManage.vue'
import SkillManage from '@/views/SkillManage.vue'
import PluginManage from '@/views/PluginManage.vue'
import AgentsManage from '@/views/AgentsManage.vue'
import AgentList from '@/views/AgentList.vue'
import SessionsManage from '@/views/SessionsManage.vue'
import Login from '@/views/Login.vue'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: Login },
  { path: '/', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/channels', name: 'channels', component: ChannelManage, meta: { requiresAuth: true } },
  { path: '/models', name: 'models', component: ModelManage, meta: { requiresAuth: true } },
  { path: '/skills', name: 'skills', component: SkillManage, meta: { requiresAuth: true } },
  { path: '/plugins', name: 'plugins', component: PluginManage, meta: { requiresAuth: true } },
  { path: '/agents', name: 'agents', component: AgentsManage, meta: { requiresAuth: true } },
  { path: '/agent-list', name: 'agent-list', component: AgentList, meta: { requiresAuth: true } },
  { path: '/sessions', name: 'sessions', component: SessionsManage, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.state.isLoggedIn) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.state.isLoggedIn) {
    return { name: 'dashboard' }
  }
})

export default router
