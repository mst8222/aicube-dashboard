<template>
  <div class="agent-list-page">
    <div class="page-header">
      <h1>📋 智能体管理</h1>
      <button class="btn-add" @click="showAddModal = true">+ 添加 Agent</button>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-ring" :class="statusColor">
          <svg viewBox="0 0 100 100">
            <circle class="ring-bg" cx="50" cy="50" r="42"/>
            <circle class="ring-fill" cx="50" cy="50" r="42" 
              :stroke-dasharray="`${workingCount / agents.length * 264} 264`"/>
          </svg>
          <span class="ring-value">{{ Math.round(workingCount / agents.length * 100) }}%</span>
        </div>
        <div class="stat-info">
          <div class="stat-label">运行中</div>
          <div class="stat-num">{{ workingCount }} / {{ agents.length }}</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-ring resting">
          <svg viewBox="0 0 100 100">
            <circle class="ring-bg" cx="50" cy="50" r="42"/>
            <circle class="ring-fill" cx="50" cy="50" r="42" 
              :stroke-dasharray="`${restingCount / agents.length * 264} 264`"/>
          </svg>
          <span class="ring-value">{{ Math.round(restingCount / agents.length * 100) }}%</span>
        </div>
        <div class="stat-info">
          <div class="stat-label">空闲中</div>
          <div class="stat-num">{{ restingCount }} / {{ agents.length }}</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-ring cpu">
          <svg viewBox="0 0 100 100">
            <circle class="ring-bg" cx="50" cy="50" r="42"/>
            <circle class="ring-fill" cx="50" cy="50" r="42" 
              :stroke-dasharray="`${avgCpu * 2.64} 264`"/>
          </svg>
          <span class="ring-value">{{ avgCpu }}%</span>
        </div>
        <div class="stat-info">
          <div class="stat-label">平均CPU</div>
          <div class="stat-num">负载</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-ring memory">
          <svg viewBox="0 0 100 100">
            <circle class="ring-bg" cx="50" cy="50" r="42"/>
            <circle class="ring-fill" cx="50" cy="50" r="42" 
              :stroke-dasharray="`${avgMem * 2.64} 264`"/>
          </svg>
          <span class="ring-value">{{ avgMem }}%</span>
        </div>
        <div class="stat-info">
          <div class="stat-label">平均内存</div>
          <div class="stat-num">占用</div>
        </div>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="action-bar">
      <button class="btn-action" @click="refreshAgents">
        <span>🔄</span> 刷新
      </button>
      <button class="btn-action" @click="startAllAgents">
        <span>▶️</span> 全部启动
      </button>
      <button class="btn-action" @click="stopAllAgents">
        <span>⏹️</span> 全部停止
      </button>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span>🔄</span> 加载中...
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-state">
      <span>⚠️</span> {{ errorMsg }}
      <button class="btn-retry" @click="fetchAgents">重试</button>
    </div>

    <!-- Agent 列表 -->
    <div class="agents-table" v-if="!loading && !errorMsg">
      <div class="table-header">
        <div class="col col-status">状态</div>
        <div class="col col-name">Agent名称</div>
        <div class="col col-ip">IP地址</div>
        <div class="col col-port">端口</div>
        <div class="col col-cpu">CPU</div>
        <div class="col col-mem">内存</div>
        <div class="col col-task">当前任务</div>
        <div class="col col-activity">最后活动</div>
        <div class="col col-actions">操作</div>
      </div>
      
      <div class="table-body">
        <div v-for="agent in agents" :key="agent.id" class="table-row">
          <div class="col col-status">
            <span class="status-dot" :class="agent._raw?.runtimeStatus || agent.status"></span>
          </div>
          <div class="col col-name">
            <span class="agent-avatar">{{ agent.avatar }}</span>
            <span class="agent-name">{{ agent.name }}</span>
          </div>
          <div class="col col-ip">{{ agent.ip || '127.0.0.1' }}</div>
          <div class="col col-port">{{ agent.port || '------' }}</div>
          <div class="col col-cpu">
            <div class="mini-bar">
              <div class="mini-bar-fill" :style="{ width: agent.cpu + '%', background: getCpuColor(agent.cpu) }"></div>
            </div>
            <span class="mini-val">{{ agent.cpu }}%</span>
          </div>
          <div class="col col-mem">
            <div class="mini-bar">
              <div class="mini-bar-fill" :style="{ width: agent.memory + '%', background: getMemColor(agent.memory) }"></div>
            </div>
            <span class="mini-val">{{ agent.memory }}%</span>
          </div>
          <div class="col col-task">
            <span class="task-text" :title="agent.task || '空闲'">{{ agent.task || '空闲' }}</span>
          </div>
          <div class="col col-activity">
            <span class="activity-time">{{ formatTime(agent.lastActivity) }}</span>
          </div>
          <div class="col col-actions">
            <button class="btn-session" @click="openSessionModal(agent)">💬 会话</button>
            <button class="btn-edit" @click="showAgentDetail(agent.id)">编辑</button>
            <button class="btn-delete" @click="deleteAgent(agent.id)">删除</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 编辑弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="selectedAgent" @click.self="selectedAgent = null">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-avatar">{{ selectedAgent.avatar }}</span>
            <span class="modal-title">编辑 Agent</span>
            <button class="close-btn" @click="selectedAgent = null">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>名称</label>
                <input v-model="selectedAgent.name" type="text" />
              </div>
              <div class="form-group">
                <label>头像</label>
                <input v-model="selectedAgent.avatar" type="text" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>IP地址</label>
                <input v-model="selectedAgent.ip" type="text" />
              </div>
              <div class="form-group">
                <label>端口</label>
                <input v-model="selectedAgent.port" type="text" />
              </div>
            </div>
            <div class="form-group">
              <label>状态</label>
              <div class="status-toggle">
                <button :class="{ active: selectedAgent.status === 'working' }" @click="selectedAgent.status = 'working'">💼 工作</button>
                <button :class="{ active: selectedAgent.status === 'resting' }" @click="selectedAgent.status = 'resting'">🛋️ 空闲</button>
              </div>
            </div>
            <div class="form-group">
              <label>当前任务</label>
              <input v-model="selectedAgent.task" type="text" placeholder="输入任务描述..." />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="selectedAgent = null">取消</button>
            <button class="btn-save" @click="saveAgent">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 添加弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
        <div class="modal">
          <div class="modal-header">
            <span>➕ 添加新 Agent</span>
            <button class="close-btn" @click="showAddModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>名称</label>
              <input v-model="newAgent.name" type="text" placeholder="输入 Agent 名称..." />
            </div>
            <div class="form-group">
              <label>头像</label>
              <input v-model="newAgent.avatar" type="text" placeholder="例如: 🧑‍💻" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showAddModal = false">取消</button>
            <button class="btn-save" @click="addAgent">添加</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 会话弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showSessionModal" @click.self="showSessionModal = false">
        <div class="modal">
          <div class="modal-header">
            <span>💬 向 Agent 发送消息</span>
            <button class="close-btn" @click="showSessionModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Agent</label>
              <div class="session-agent-display">
                <span class="session-agent-avatar">{{ sessionForm.agentAvatar }}</span>
                <span class="session-agent-name">{{ sessionForm.agentName }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>输入消息</label>
              <textarea
                v-model="sessionForm.message"
                placeholder="请输入消息..."
                rows="5"
              ></textarea>
            </div>
            <div v-if="sessionForm.error" class="error-msg">{{ sessionForm.error }}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showSessionModal = false">取消</button>
            <button class="btn-save" @click="createSession" :disabled="sessionForm.sending">
              {{ sessionForm.sending ? '发送中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const loading = ref(true)
const errorMsg = ref('')
const selectedAgent = ref(null)
const showAddModal = ref(false)
const showSessionModal = ref(false)
const sessionForm = ref({
  agentId: '',
  agentName: '',
  agentAvatar: '',
  message: '',
  error: '',
  sending: false
})
const newAgent = ref({ name: '', avatar: '🧑‍💻', ip: '', port: '' })

const agents = ref([])

const workingCount = computed(() => agents.value.filter(a => a.status === 'busy' || a.status === 'working').length)
const restingCount = computed(() => agents.value.filter(a => a.status !== 'busy' && a.status !== 'working').length)
const avgCpu = computed(() => {
  const working = agents.value.filter(a => a.status === 'busy' || a.status === 'working')
  return working.length ? Math.round(working.reduce((sum, a) => sum + a.cpu, 0) / working.length) : 0
})
const avgMem = computed(() => {
  const working = agents.value.filter(a => a.status === 'busy' || a.status === 'working')
  return working.length ? Math.round(working.reduce((sum, a) => sum + a.memory, 0) / working.length) : 0
})
const statusColor = computed(() => workingCount.value > 0 ? 'active' : 'inactive')

function getCpuColor(cpu) { return cpu > 80 ? '#ef4444' : cpu > 50 ? '#eab308' : '#22c55e' }
function getMemColor(mem) { return mem > 80 ? '#ef4444' : mem > 50 ? '#eab308' : '#22c55e' }

function formatTime(isoString) {
  if (!isoString) return '从未'
  try {
    const d = new Date(isoString)
    const now = Date.now()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch { return '未知' }
}

// 从 identityName 提取中文名，如 "经理 (Manager)" -> "经理"
function extractChineseName(identityName) {
  if (!identityName) return ''
  const match = identityName.match(/^(.+?)\s*\(/)
  return match ? match[1] : identityName
}

// 将 API 数据映射为组件内部格式
function mapAgentFromApi(apiItem) {
  const status = apiItem.runtimeStatus || 'idle'
  const rawName = extractChineseName(apiItem.identityName) || apiItem.identityName || apiItem.id
  const isPersistent = apiItem.isPersistent !== false  // 默认为 true
  const displayName = isPersistent ? rawName : `【临时工】${rawName}`
  return {
    id: apiItem.id,
    name: displayName,
    avatar: apiItem.identityEmoji || '🤖',
    status,           // 使用 API 返回的真实状态
    lastActivity: apiItem.lastActivity || null,
    task: status === 'busy' ? '任务执行中...' : '空闲',
    cpu: status === 'busy' ? Math.floor(Math.random() * 30 + 20) : 0,
    memory: status === 'busy' ? Math.floor(Math.random() * 20 + 30) : 0,
    ip: '127.0.0.1',
    port: '------',
    _raw: apiItem
  }
}

async function fetchAgents(isSilent = false) {
  if (!isSilent) {
    loading.value = true
    errorMsg.value = ''
  }
  try {
    const res = await fetch('/api/agents')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.success && Array.isArray(json.data)) {
      const newAgents = json.data.map(mapAgentFromApi)
      // 静默刷新时不触发 loading，只更新数据
      agents.value = newAgents
      // 智能调整轮询间隔
      const anyBusy = newAgents.some(a => a.status === 'busy')
      scheduleNextPoll(anyBusy ? 5000 : 30000)
    } else {
      throw new Error('返回数据格式异常')
    }
  } catch (e) {
    if (!isSilent) {
      errorMsg.value = '加载 Agent 列表失败: ' + e.message
    }
    console.error('fetchAgents error:', e)
    scheduleNextPoll(10000) // 出错时10秒后重试
  } finally {
    if (!isSilent) loading.value = false
  }
}

// 智能轮询调度
let refreshTimer = null
function scheduleNextPoll(delayMs) {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => fetchAgents(true), delayMs)
}

function showAgentDetail(id) {
  const agent = agents.value.find(a => a.id === id)
  if (agent) selectedAgent.value = { ...agent }
}

async function saveAgent() {
  try {
    const raw = selectedAgent.value._raw
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityName: raw.identityName || selectedAgent.value.name,
        identityEmoji: selectedAgent.value.avatar,
        identitySource: raw.identitySource || 'identity'
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchAgents()
  } catch (e) {
    alert('保存失败: ' + e.message)
    return
  }
  selectedAgent.value = null
}

async function deleteAgent(id) {
  if (!confirm('确定删除此 Agent？')) return
  try {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchAgents()
  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

async function addAgent() {
  if (!newAgent.value.name) return
  try {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityName: newAgent.value.name + ' (Agent)',
        identityEmoji: newAgent.value.avatar || '🧑‍💻',
        identitySource: 'identity'
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchAgents()
  } catch (e) {
    alert('添加失败: ' + e.message)
    return
  }
  newAgent.value = { name: '', avatar: '🧑‍💻', ip: '', port: '' }
  showAddModal.value = false
}

function openSessionModal(agent) {
  sessionForm.value = {
    agentId: agent.id,
    agentName: agent.name,
    agentAvatar: agent.avatar,
    message: '',
    error: '',
    sending: false
  }
  showSessionModal.value = true
}

async function createSession() {
  if (!sessionForm.value.message.trim()) {
    sessionForm.value.error = '请输入消息'
    return
  }
  sessionForm.value.sending = true
  sessionForm.value.error = ''
  try {
    const res = await fetch(`/api/agents/${sessionForm.value.agentId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: sessionForm.value.message })
    })
    const json = await res.json()
    if (json.success) {
      showSessionModal.value = false
      sessionForm.value.message = ''
    } else {
      sessionForm.value.error = json.error || '发送失败'
    }
  } catch (e) {
    sessionForm.value.error = '网络错误'
  } finally {
    sessionForm.value.sending = false
  }
}

async function refreshAgents() {
  await fetchAgents()
}

function startAllAgents() {
  // API 不支持批量操作，改为提示
  alert('批量操作暂不支持，请通过 OpenClaw 管理')
}

function stopAllAgents() {
  alert('批量操作暂不支持，请通过 OpenClaw 管理')
}

onMounted(() => {
  fetchAgents()        // 首次立即加载
  scheduleNextPoll(30000)  // 30秒后下次
})

onUnmounted(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<style scoped>
.agent-list-page { max-width: 1400px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h1 { font-size: 24px; color: #f8fafc; }
.btn-add { background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }
.btn-add:hover { background: #00c4b3; }

.stats-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
.stat-card { background: #1A2234; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; min-width: 180px; border: 1px solid #2a3444; }
.stat-ring { width: 80px; height: 80px; position: relative; }
.stat-ring svg { transform: rotate(-90deg); width: 100%; height: 100%; }
.ring-bg { fill: none; stroke: #2a3444; stroke-width: 8; }
.ring-fill { fill: none; stroke: #00D9C4; stroke-width: 8; stroke-linecap: round; transition: stroke-dasharray 0.5s; }
.stat-ring.resting .ring-fill { stroke: #fbbf24; }
.stat-ring.cpu .ring-fill { stroke: #60a5fa; }
.stat-ring.memory .ring-fill { stroke: #a78bfa; }
.ring-value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #f8fafc; }
.stat-label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
.stat-num { font-size: 20px; font-weight: bold; color: #f8fafc; }

.action-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.btn-action { background: #1A2234; color: #e2e8f0; border: 1px solid #2a3444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.btn-action:hover { background: #2a3444; }

.agents-table { background: #1A2234; border-radius: 12px; overflow: hidden; border: 1px solid #2a3444; margin-bottom: 20px; }
.table-header { display: flex; background: #0f1520; padding: 12px 16px; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; }
.table-row { display: flex; padding: 12px 16px; border-bottom: 1px solid #2a3444; align-items: center; }
.table-row:hover { background: rgba(0, 217, 196, 0.05); }
.col { padding: 0 8px; }
.col-status { width: 60px; }
.col-name { width: 140px; display: flex; align-items: center; gap: 8px; }
.col-ip { width: 120px; font-family: monospace; color: #94a3b8; }
.col-port { width: 80px; color: #94a3b8; }
.col-cpu, .col-mem { width: 120px; }
.col-task { flex: 1; }
.col-actions { width: 140px; display: flex; gap: 8px; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.status-dot.busy, .status-dot.working { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
.status-dot.idle, .status-dot.resting { background: #fbbf24; }
.agent-avatar { font-size: 20px; }
.agent-name { font-weight: 500; color: #f8fafc; }
.mini-bar { width: 60px; height: 6px; background: #2a3444; border-radius: 3px; display: inline-block; vertical-align: middle; }
.mini-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.mini-val { font-size: 12px; color: #94a3b8; margin-left: 8px; }
.task-text { font-size: 12px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: inline-block; }
.btn-edit, .btn-delete, .btn-session { padding: 4px 12px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; }
.btn-edit { background: rgba(0, 217, 196, 0.2); color: #00D9C4; }
.btn-edit:hover { background: rgba(0, 217, 196, 0.3); }
.btn-delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.btn-delete:hover { background: rgba(239, 68, 68, 0.3); }
.btn-session { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.btn-session:hover { background: rgba(59, 130, 246, 0.3); }

.session-agent-display { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #0f1520; border: 1px solid #2a3444; border-radius: 6px; }
.session-agent-avatar { font-size: 20px; }
.session-agent-name { font-size: 14px; color: #f8fafc; }
.form-group textarea { background: #0f1520; border: 1px solid #2a3444; border-radius: 8px; padding: 10px 12px; color: #f8fafc; font-size: 14px; font-family: inherit; resize: vertical; }
.form-group textarea:focus { outline: none; border-color: #00D9C4; }
.error-msg { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px; color: #ef4444; font-size: 13px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #1A2234; border-radius: 16px; width: 100%; max-width: 500px; border: 1px solid #2a3444; }
.modal-header { display: flex; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid #2a3444; }
.modal-avatar { font-size: 32px; }
.modal-title { font-size: 18px; font-weight: bold; color: #f8fafc; flex: 1; }
.close-btn { background: none; border: none; color: #64748b; font-size: 24px; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; color: #64748b; }
.form-group input { background: #0f1520; border: 1px solid #2a3444; border-radius: 6px; padding: 10px 12px; color: #f8fafc; font-size: 14px; }
.form-group input:focus { outline: none; border-color: #00D9C4; }
.status-toggle { display: flex; gap: 8px; }
.status-toggle button { flex: 1; padding: 10px; border: 1px solid #2a3444; border-radius: 6px; background: #0f1520; color: #64748b; cursor: pointer; }
.status-toggle button.active { background: rgba(0, 217, 196, 0.2); border-color: #00D9C4; color: #00D9C4; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid #2a3444; }
.btn-cancel { background: #2a3444; color: #e2e8f0; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.btn-save { background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-save:hover { background: #00c4b3; }

@media (max-width: 900px) {
  .stats-row { gap: 12px; }
  .stat-card { min-width: 140px; padding: 14px; }
  .stat-ring { width: 60px; height: 60px; }
  .col-ip, .col-port { display: none; }
  .col-task { display: none; }
}
@media (max-width: 600px) {
  .table-header { display: none; }
  .table-row { flex-wrap: wrap; gap: 8px; }
  .col { width: auto; flex: 1 1 45%; }
  .col-actions { width: 100%; justify-content: flex-end; }
}

.loading-state { text-align: center; padding: 60px 20px; color: #64748b; font-size: 16px; }
.loading-state span { font-size: 24px; display: block; margin-bottom: 12px; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.error-state { text-align: center; padding: 40px 20px; color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 12px; margin-bottom: 20px; }
.error-state span { font-size: 24px; display: block; margin-bottom: 12px; }
.btn-retry { margin-top: 12px; background: #ef4444; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

.col-activity { width: 100px; }
.activity-time { font-size: 12px; color: #64748b; }
</style>
