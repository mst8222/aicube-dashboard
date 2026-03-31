<template>
  <div class="page">
    <div class="page-header">
      <h1>💬 Channel 管理</h1>
      <button class="btn-add" @click="showAddModal = true">+ 添加 Channel</button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon online">💬</div>
        <div class="stat-info">
          <div class="stat-label">在线 Channel</div>
          <div class="stat-num">{{ onlineCount }} / {{ channels.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon providers">🔗</div>
        <div class="stat-info">
          <div class="stat-label">已配置渠道</div>
          <div class="stat-num">{{ channels.length }}</div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="btn-action" @click="refreshChannels">
        <span>🔄</span> 刷新
      </button>
      <button class="btn-action" @click="checkStatus">
        <span>📡</span> 检测状态
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span>🔄</span> 加载中...
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-state">
      <span>⚠️</span> {{ errorMsg }}
      <button class="btn-retry" @click="fetchChannels">重试</button>
    </div>

    <!-- Channel 列表 -->
    <div class="channels-grid" v-if="!loading && !errorMsg">
      <div v-for="ch in channels" :key="ch.id" class="channel-card">
        <div class="channel-header">
          <span class="channel-icon">{{ getChannelIcon(ch.provider) }}</span>
          <div class="channel-meta">
            <span class="channel-name">{{ ch.name }}</span>
            <span class="channel-provider">{{ ch.provider }}</span>
          </div>
          <span class="channel-status-badge" :class="getStatusClass(ch.status)">
            {{ formatStatus(ch.status) }}
          </span>
        </div>
        <div class="channel-body">
          <div class="info-row">
            <span class="info-label">状态</span>
            <span class="info-value">{{ ch.status || '未知' }}</span>
          </div>
          <div class="info-row" v-if="ch.account">
            <span class="info-label">账号</span>
            <span class="info-value">{{ ch.account }}</span>
          </div>
          <div class="info-row" v-if="ch.chatId">
            <span class="info-label">Chat ID</span>
            <span class="info-value mono">{{ ch.chatId }}</span>
          </div>
        </div>
        <div class="channel-footer">
          <button class="btn-detail" @click="showChannelDetail(ch)">详情</button>
          <button class="btn-remove" @click="removeChannel(ch.name || ch.id)">移除</button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="channels.length === 0" class="empty-card">
        <span class="empty-icon">💬</span>
        <p>暂无已配置的 Channel</p>
        <button class="btn-add-small" @click="showAddModal = true">添加第一个 Channel</button>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="selectedChannel" @click.self="selectedChannel = null">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-icon">{{ getChannelIcon(selectedChannel.provider) }}</span>
            <span class="modal-title">{{ selectedChannel.name }}</span>
            <button class="close-btn" @click="selectedChannel = null">×</button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-item" v-for="(val, key) in selectedChannel" :key="key">
                <span class="detail-label">{{ key }}</span>
                <span class="detail-value">{{ val }}</span>
              </div>
            </div>
            <div v-if="Object.keys(selectedChannel).length === 0" class="no-data">
              无详细信息
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="selectedChannel = null">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 添加 Channel 弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
        <div class="modal">
          <div class="modal-header">
            <span>➕ 添加 Channel</span>
            <button class="close-btn" @click="showAddModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="provider-grid">
              <div
                v-for="p in availableProviders"
                :key="p.id"
                class="provider-card"
                :class="{ selected: newChannel.channel === p.id }"
                @click="newChannel.channel = p.id"
              >
                <span class="provider-icon">{{ p.icon }}</span>
                <span class="provider-name">{{ p.name }}</span>
                <span class="provider-desc">{{ p.desc }}</span>
              </div>
            </div>
            <div class="form-group" style="margin-top: 16px;">
              <label>Channel 类型</label>
              <select v-model="newChannel.channel">
                <option v-for="p in availableProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="form-group" v-if="newChannel.channel === 'feishu'">
              <label>飞书 App ID</label>
              <input v-model="newChannel.appId" type="text" placeholder="cli_xxx" />
            </div>
            <div class="form-group" v-if="newChannel.channel === 'feishu'">
              <label>飞书 App Secret</label>
              <input v-model="newChannel.appSecret" type="password" placeholder="App Secret" />
            </div>
            <div class="form-group" v-if="newChannel.channel === 'telegram'">
              <label>Bot Token</label>
              <input v-model="newChannel.botToken" type="text" placeholder="123456:ABC-DEF..." />
            </div>
            <div class="form-group" v-if="newChannel.channel === 'discord'">
              <label>Bot Token</label>
              <input v-model="newChannel.botToken" type="text" placeholder="Discord bot token" />
            </div>
            <div class="form-group" v-if="newChannel.channel === 'slack'">
              <label>Bot Token</label>
              <input v-model="newChannel.botToken" type="text" placeholder="xoxb-..." />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showAddModal = false">取消</button>
            <button class="btn-save" @click="addChannel" :disabled="adding">
              {{ adding ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Status 检测结果弹窗 -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="statusResult" @click.self="statusResult = null">
        <div class="modal modal-wide">
          <div class="modal-header">
            <span>📡 Channel 状态检测</span>
            <button class="close-btn" @click="statusResult = null">×</button>
          </div>
          <div class="modal-body">
            <pre class="status-raw">{{ statusResult }}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="statusResult = null">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const errorMsg = ref('')
const channels = ref([])
const showAddModal = ref(false)
const selectedChannel = ref(null)
const statusResult = ref(null)
const adding = ref(false)

const newChannel = ref({
  channel: 'feishu',
  appId: '',
  appSecret: '',
  botToken: '',
})

const availableProviders = [
  { id: 'feishu', name: '飞书', icon: '📐', desc: 'Feishu/Lark' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', desc: 'Telegram Bot' },
  { id: 'discord', name: 'Discord', icon: '🎮', desc: 'Discord Bot' },
  { id: 'slack', name: 'Slack', icon: 'Slack', desc: 'Slack Bot' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', desc: 'WhatsApp Web' },
  { id: 'signal', name: 'Signal', icon: '🔒', desc: 'Signal' },
]

const onlineCount = computed(() =>
  channels.value.filter(ch => {
    const s = (ch.status || '').toLowerCase()
    return s.includes('connected') || s.includes('enabled') || s.includes('online')
  }).length
)

function getChannelIcon(provider) {
  const p = availableProviders.find(x => x.id === (provider || '').toLowerCase())
  return p ? p.icon : '💬'
}

function formatStatus(status) {
  if (!status) return '未知'
  const s = status.toLowerCase()
  if (s.includes('connected') || s.includes('enabled') || s.includes('online')) return '在线'
  if (s.includes('disconnected') || s.includes('disabled') || s.includes('offline')) return '离线'
  return '在线'
}

function getStatusClass(status) {
  if (!status) return 'status-unknown'
  const s = status.toLowerCase()
  if (s.includes('connected') || s.includes('enabled') || s.includes('online')) return 'status-online'
  if (s.includes('disconnected') || s.includes('disabled') || s.includes('offline')) return 'status-offline'
  return 'status-online'
}

async function fetchChannels() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/channels')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.success) {
      channels.value = json.data || []
    } else {
      throw new Error(json.error || '加载失败')
    }
  } catch (e) {
    errorMsg.value = '加载 Channel 列表失败: ' + e.message
  } finally {
    loading.value = false
  }
}

async function refreshChannels() {
  await fetchChannels()
}

async function checkStatus() {
  statusResult.value = '检测中...'
  try {
    const res = await fetch('/api/channels/status')
    const json = await res.json()
    statusResult.value = json.raw || JSON.stringify(json.data, null, 2)
  } catch (e) {
    statusResult.value = '检测失败: ' + e.message
  }
}

function showChannelDetail(ch) {
  selectedChannel.value = { ...ch }
}

async function removeChannel(name) {
  if (!confirm(`确定要移除 Channel "${name}" 吗？`)) return
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(name)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '移除失败')
    await fetchChannels()
  } catch (e) {
    alert('移除失败: ' + e.message)
  }
}

async function addChannel() {
  if (!newChannel.value.channel) return
  adding.value = true
  try {
    const body = { channel: newChannel.value.channel }
    if (newChannel.value.appId) body.appId = newChannel.value.appId
    if (newChannel.value.appSecret) body.appSecret = newChannel.value.appSecret
    if (newChannel.value.botToken) body.botToken = newChannel.value.botToken

    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '添加失败')
    showAddModal.value = false
    await fetchChannels()
  } catch (e) {
    alert('添加失败: ' + e.message)
  } finally {
    adding.value = false
  }
}

onMounted(() => {
  fetchChannels()
})
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h1 { font-size: 24px; color: #f8fafc; }
.btn-add { background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }
.btn-add:hover { background: #00c4b3; }

.stats-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
.stat-card { background: #1A2234; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; min-width: 180px; border: 1px solid #2a3444; }
.stat-icon { font-size: 36px; }
.stat-info { flex: 1; }
.stat-label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
.stat-num { font-size: 20px; font-weight: bold; color: #f8fafc; }

.action-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.btn-action { background: #1A2234; color: #e2e8f0; border: 1px solid #2a3444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.btn-action:hover { background: #2a3444; }

.channels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 20px; }
.channel-card { background: #1A2234; border-radius: 12px; border: 1px solid #2a3444; overflow: hidden; transition: border-color 0.2s; }
.channel-card:hover { border-color: #3b82f6; }
.channel-header { display: flex; align-items: center; gap: 12px; padding: 16px; background: #0f1520; border-bottom: 1px solid #2a3444; }
.channel-icon { font-size: 28px; }
.channel-meta { flex: 1; }
.channel-name { display: block; font-size: 15px; font-weight: bold; color: #f8fafc; }
.channel-provider { font-size: 12px; color: #64748b; }
.channel-status-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
.status-online { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.status-offline { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.status-unknown { background: rgba(100, 116, 139, 0.2); color: #64748b; }
.channel-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; justify-content: space-between; font-size: 13px; }
.info-label { color: #64748b; }
.info-value { color: #e2e8f0; }
.info-value.mono { font-family: monospace; font-size: 12px; }
.channel-footer { padding: 12px 16px; border-top: 1px solid #2a3444; display: flex; gap: 8px; justify-content: flex-end; }
.btn-detail, .btn-remove { padding: 6px 14px; border-radius: 6px; font-size: 12px; border: none; cursor: pointer; }
.btn-detail { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.btn-detail:hover { background: rgba(59, 130, 246, 0.3); }
.btn-remove { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.btn-remove:hover { background: rgba(239, 68, 68, 0.3); }

.empty-card { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b; }
.empty-icon { font-size: 64px; display: block; margin-bottom: 16px; }
.btn-add-small { margin-top: 16px; background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #1A2234; border-radius: 16px; width: 100%; max-width: 500px; border: 1px solid #2a3444; }
.modal-wide { max-width: 700px; }
.modal-header { display: flex; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid #2a3444; }
.modal-icon { font-size: 28px; }
.modal-title { font-size: 18px; font-weight: bold; color: #f8fafc; flex: 1; }
.close-btn { background: none; border: none; color: #64748b; font-size: 24px; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid #2a3444; }
.btn-cancel { background: #2a3444; color: #e2e8f0; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.btn-save { background: #00D9C4; color: #151B28; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-save:hover { background: #00c4b3; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

.provider-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.provider-card { background: #0f1520; border: 2px solid #2a3444; border-radius: 10px; padding: 14px 10px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
.provider-card:hover { border-color: #3b82f6; }
.provider-card.selected { border-color: #00D9C4; background: rgba(0, 217, 196, 0.1); }
.provider-icon { font-size: 24px; display: block; margin-bottom: 6px; }
.provider-name { font-size: 13px; font-weight: bold; color: #f8fafc; display: block; }
.provider-desc { font-size: 11px; color: #64748b; display: block; margin-top: 2px; }

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; color: #64748b; }
.form-group input, .form-group select { background: #0f1520; border: 1px solid #2a3444; border-radius: 6px; padding: 10px 12px; color: #f8fafc; font-size: 14px; }
.form-group input:focus, .form-group select:focus { outline: none; border-color: #00D9C4; }
.form-group select { cursor: pointer; }

.detail-grid { display: flex; flex-direction: column; gap: 10px; }
.detail-item { display: flex; flex-direction: column; gap: 2px; }
.detail-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
.detail-value { font-size: 14px; color: #f8fafc; word-break: break-all; }
.no-data { text-align: center; color: #64748b; padding: 20px; }
.status-raw { background: #0f1520; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; color: #a5f3fc; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }

/* States */
.loading-state { text-align: center; padding: 60px 20px; color: #64748b; font-size: 16px; }
.loading-state span { font-size: 24px; display: block; margin-bottom: 12px; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: 40px 20px; color: #ef4444; background: rgba(239, 68, 68, 0.1); border-radius: 12px; margin-bottom: 20px; }
.error-state span { font-size: 24px; display: block; margin-bottom: 12px; }
.btn-retry { margin-top: 12px; background: #ef4444; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

@media (max-width: 600px) {
  .channels-grid { grid-template-columns: 1fr; }
  .stats-row { gap: 12px; }
  .stat-card { min-width: 140px; }
  .provider-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
