<template>
  <div class="page">
    <div class="page-header">
      <h1>💬 会话 / 任务</h1>
      <button class="btn-primary" @click="showNewSession = true">+ 新建会话</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">⏳ 加载中...</div>

    <!-- Agent 过滤 -->
    <div class="filter-bar" v-if="!loading">
      <button
        v-for="opt in filterOptions"
        :key="opt.value"
        class="filter-btn"
        :class="{ active: filter === opt.value }"
        @click="filter = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Agent 卡片列表 -->
    <div class="agents-grid" v-if="!loading">
      <div
        v-for="item in filteredAgents"
        :key="item.agentId"
        class="agent-card"
      >
        <div class="agent-header" @click="toggleAgent(item)">
          <span class="agent-emoji">{{ item.agentEmoji }}</span>
          <div class="agent-info">
            <span class="agent-name">{{ item.agentName }}</span>
            <span class="session-count">{{ item.sessionCount }} 个会话</span>
          </div>
          <span class="expand-icon">{{ expandedAgents.has(item.agentId) ? '▲' : '▼' }}</span>
        </div>

        <!-- 会话列表 -->
        <div v-if="expandedAgents.has(item.agentId)" class="sessions-list">
          <div
            v-for="session in item.sessions"
            :key="session.sessionKey"
            class="session-item"
            @click="openSession(item.agentId, session.sessionKey)"
          >
            <div class="session-meta">
              <span class="session-key">{{ session.sessionKey.slice(0, 16) }}...</span>
              <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
            </div>
            <div class="session-info">
              <span class="session-tokens" v-if="session.totalTokens">💰 {{ session.totalTokens }}</span>
              <span class="session-status" :class="session.abortedLastRun ? 'aborted' : 'running'">
                {{ session.abortedLastRun ? '⏹ 已停止' : '✅ 运行中' }}
              </span>
            </div>
          </div>
          <div v-if="item.sessions.length === 0" class="empty-sessions">暂无会话</div>
        </div>
      </div>

      <div v-if="filteredAgents.length === 0" class="empty-state">
        没有会话记录
      </div>
    </div>

    <!-- 新建会话弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showNewSession" @click.self="showNewSession = false">
        <div class="modal">
          <div class="modal-header">
            <span>➕ 新建会话</span>
            <button class="close-btn" @click="showNewSession = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>选择 Agent</label>
              <select v-model="newSession.agentId">
                <option value="">请选择...</option>
                <option v-for="a in allAgents" :key="a.id" :value="a.id">
                  {{ a.identityEmoji }} {{ a.identityName }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>输入消息</label>
              <textarea
                v-model="newSession.message"
                placeholder="请输入第一条消息..."
                rows="5"
              ></textarea>
            </div>
            <div v-if="newSession.error" class="error-msg">{{ newSession.error }}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showNewSession = false">取消</button>
            <button class="btn-primary" @click="createSession" :disabled="creating">
              {{ creating ? '发送中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 会话详情弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="currentSession" @click.self="closeSession">
        <div class="modal modal-wide">
          <div class="modal-header">
            <span>💬 {{ currentSession.agentName }} — {{ currentSession.sessionKey.slice(0, 16) }}...</span>
            <button class="close-btn" @click="closeSession">×</button>
          </div>
          <div class="modal-body session-detail-body">
            <!-- 消息列表 -->
            <div class="messages-list" ref="messagesContainer">
              <div v-if="loadingMessages" class="loading-state">⏳ 加载消息...</div>
              <div v-else-if="messages.length === 0" class="empty-state">暂无消息</div>
              <div
                v-else
                v-for="(msg, idx) in messages"
                :key="idx"
                class="message-item"
                :class="msg.role"
              >
                <div class="message-role">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
                <div class="message-content">{{ msg.content || msg.text || JSON.stringify(msg) }}</div>
              </div>
            </div>
            <!-- 输入框 -->
            <div class="message-input-area">
              <textarea
                v-model="replyMessage"
                placeholder="输入回复内容..."
                rows="3"
                @keydown.ctrl.enter="sendReply"
              ></textarea>
              <button class="btn-primary" @click="sendReply" :disabled="sending">
                {{ sending ? '发送中...' : '发送 (Ctrl+Enter)' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const sessionsData = ref([])
const allAgents = ref([])
const filter = ref('all')
const expandedAgents = ref(new Set())
const showNewSession = ref(false)
const creating = ref(false)
const currentSession = ref(null)
const messages = ref([])
const loadingMessages = ref(false)
const replyMessage = ref('')
const sending = ref(false)
const messagesContainer = ref(null)

const newSession = ref({
  agentId: '',
  message: '',
  error: ''
})

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'busy', label: '运行中' },
  { value: 'idle', label: '空闲' },
]

const filteredAgents = computed(() => {
  const items = filter.value === 'all'
    ? sessionsData.value
    : sessionsData.value.filter(a => a.sessions.some(s => filter.value === 'busy' ? !s.abortedLastRun : s.abortedLastRun))
  return items
})

async function fetchSessions() {
  loading.value = true
  try {
    const res = await fetch('/api/sessions')
    const json = await res.json()
    if (json.success) {
      sessionsData.value = json.data
    }
  } catch (e) {
    console.error('fetch sessions error:', e)
  } finally {
    loading.value = false
  }
}

async function fetchAgents() {
  try {
    const res = await fetch('/api/agents')
    const json = await res.json()
    if (json.success) allAgents.value = json.data
  } catch {}
}

function toggleAgent(item) {
  if (expandedAgents.value.has(item.agentId)) {
    expandedAgents.value.delete(item.agentId)
  } else {
    expandedAgents.value.add(item.agentId)
  }
}

function formatTime(ts) {
  if (!ts) return '未知'
  const d = new Date(ts)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return d.toLocaleDateString('zh-CN')
}

async function openSession(agentId, sessionKey) {
  currentSession.value = { agentId, sessionKey }
  loadingMessages.value = true
  messages.value = []
  try {
    const res = await fetch(`/api/sessions/${agentId}/${sessionKey}/messages`)
    const json = await res.json()
    if (json.success) messages.value = json.messages || []
  } catch {}
  loadingMessages.value = false
}

function closeSession() {
  currentSession.value = null
  messages.value = []
  replyMessage.value = ''
}

async function sendReply() {
  if (!replyMessage.value.trim() || sending.value) return
  sending.value = true
  const msg = replyMessage.value
  replyMessage.value = ''
  try {
    const res = await fetch(`/api/sessions/${currentSession.value.agentId}/${currentSession.value.sessionKey}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    })
    const json = await res.json()
    if (json.success) {
      await openSession(currentSession.value.agentId, currentSession.value.sessionKey)
    }
  } catch {}
  sending.value = false
}

async function createSession() {
  if (!newSession.value.agentId || !newSession.value.message) {
    newSession.value.error = '请选择 Agent 并输入消息'
    return
  }
  creating.value = true
  newSession.value.error = ''
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession.value)
    })
    const json = await res.json()
    if (json.success) {
      showNewSession.value = false
      newSession.value = { agentId: '', message: '', error: '' }
      await fetchSessions()
    } else {
      newSession.value.error = json.error || '创建失败'
    }
  } catch (e) {
    newSession.value.error = '网络错误'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  fetchSessions()
  fetchAgents()
})
</script>

<style scoped>
.page { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 22px; color: #f8fafc; }
.btn-primary { background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }
.btn-primary:hover { background: #00c4b3; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.loading-state { text-align: center; padding: 40px; color: #64748b; }
.filter-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-btn { background: #1A2234; color: #94a3b8; border: 1px solid #2a3444; padding: 6px 16px; border-radius: 20px; cursor: pointer; font-size: 13px; }
.filter-btn.active { background: rgba(0, 217, 196, 0.2); color: #00D9C4; border-color: rgba(0, 217, 196, 0.4); }
.agents-grid { display: flex; flex-direction: column; gap: 12px; }
.agent-card { background: #1A2234; border: 1px solid #2a3444; border-radius: 12px; overflow: hidden; }
.agent-header { display: flex; align-items: center; gap: 14px; padding: 16px; cursor: pointer; transition: background 0.15s; }
.agent-header:hover { background: rgba(255,255,255,0.03); }
.agent-emoji { font-size: 28px; }
.agent-info { flex: 1; }
.agent-name { display: block; font-size: 15px; font-weight: bold; color: #f8fafc; }
.session-count { font-size: 12px; color: #64748b; }
.expand-icon { color: #64748b; font-size: 12px; }
.sessions-list { border-top: 1px solid #2a3444; }
.session-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(42,52,68,0.5); }
.session-item:last-child { border-bottom: none; }
.session-item:hover { background: rgba(0, 217, 196, 0.05); }
.session-meta { display: flex; flex-direction: column; gap: 2px; }
.session-key { font-size: 12px; color: #64748b; font-family: monospace; }
.session-time { font-size: 12px; color: #94a3b8; }
.session-info { display: flex; gap: 10px; align-items: center; }
.session-tokens { font-size: 12px; color: #fbbf24; }
.session-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.session-status.running { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.session-status.aborted { background: rgba(100, 116, 139, 0.15); color: #64748b; }
.empty-sessions, .empty-state { text-align: center; padding: 24px; color: #64748b; font-size: 14px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #1A2234; border-radius: 16px; width: 100%; max-width: 480px; border: 1px solid #2a3444; }
.modal-wide { max-width: 700px; height: 80vh; display: flex; flex-direction: column; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #2a3444; font-size: 16px; font-weight: bold; color: #f8fafc; flex-shrink: 0; }
.close-btn { background: none; border: none; color: #64748b; font-size: 24px; cursor: pointer; }
.modal-body { padding: 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.session-detail-body { padding: 0; display: flex; flex-direction: column; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid #2a3444; flex-shrink: 0; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; color: #94a3b8; }
.form-group select, .form-group textarea { background: #0f1520; border: 1px solid #2a3444; border-radius: 8px; padding: 10px 12px; color: #f8fafc; font-size: 14px; font-family: inherit; resize: vertical; }
.form-group select:focus, .form-group textarea:focus { outline: none; border-color: #00D9C4; }
.error-msg { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px; color: #ef4444; font-size: 13px; }
.btn-cancel { background: #2a3444; color: #e2e8f0; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.messages-list { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; max-height: calc(80vh - 160px); }
.message-item { display: flex; gap: 10px; }
.message-item.user { flex-direction: row-reverse; }
.message-role { font-size: 18px; flex-shrink: 0; }
.message-content { background: #0f1520; padding: 10px 14px; border-radius: 10px; font-size: 14px; color: #e2e8f0; max-width: 75%; word-break: break-all; line-height: 1.5; }
.message-item.user .message-content { background: rgba(0, 217, 196, 0.15); color: #00D9C4; }
.message-input-area { display: flex; gap: 10px; padding: 16px 20px; border-top: 1px solid #2a3444; flex-shrink: 0; }
.message-input-area textarea { flex: 1; background: #0f1520; border: 1px solid #2a3444; border-radius: 8px; padding: 10px 12px; color: #f8fafc; font-size: 14px; font-family: inherit; resize: none; }
.message-input-area textarea:focus { outline: none; border-color: #00D9C4; }
@media (max-width: 600px) {
  .page-header { flex-direction: column; gap: 12px; align-items: flex-start; }
  .modal-wide { height: 90vh; }
}
</style>
