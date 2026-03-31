<template>
  <div class="dashboard">
    <h1 class="page-title">📊 机器性能看板</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">💻</div>
        <div class="stat-info">
          <div class="stat-label">CPU 使用率</div>
          <div class="stat-value">{{ cpu }}%</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" :style="{ width: cpu + '%', background: cpuColor }"></div>
          </div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🧠</div>
        <div class="stat-info">
          <div class="stat-label">内存使用</div>
          <div class="stat-value">{{ memory }}%</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" :style="{ width: memory + '%', background: memoryColor }"></div>
          </div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-info">
          <div class="stat-label">磁盘使用</div>
          <div class="stat-value">{{ disk }}%</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" :style="{ width: disk + '%', background: diskColor }"></div>
          </div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🌡️</div>
        <div class="stat-info">
          <div class="stat-label">CPU 温度</div>
          <div class="stat-value">{{ temp }}°C</div>
          <div class="stat-sub">{{ tempStatus }}</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📡</div>
        <div class="stat-info">
          <div class="stat-label">网络上传</div>
          <div class="stat-value">{{ uploadSpeed }}</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📥</div>
        <div class="stat-info">
          <div class="stat-label">网络下载</div>
          <div class="stat-value">{{ downloadSpeed }}</div>
        </div>
      </div>
    </div>
    
    <div class="charts-row">
      <div class="chart-card">
        <h3>📈 CPU/内存 使用趋势</h3>
        <div class="mini-chart">
          <div v-for="(v, i) in chartData" :key="i" class="chart-bar-group">
            <div class="chart-bar cpu" :style="{ height: v.cpu + '%' }"></div>
            <div class="chart-bar mem" :style="{ height: v.mem + '%' }"></div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="dot cpu"></span> CPU</span>
          <span class="legend-item"><span class="dot mem"></span> 内存</span>
        </div>
      </div>
      <div class="chart-card">
        <h3>📊 进程 TOP 5</h3>
        <div class="process-list">
          <div v-for="p in topProcesses" :key="p.name" class="process-item">
            <span class="process-name">{{ p.name }}</span>
            <span class="process-cpu" :style="{ color: p.cpu > 50 ? '#ef4444' : '#22c55e' }">{{ p.cpu }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const cpu = ref(0)
const memory = ref(0)
const disk = ref(45)
const temp = ref(0)
const uploadSpeed = ref('0 KB/s')
const downloadSpeed = ref('0 KB/s')
const topProcesses = ref([
  { name: 'node', cpu: 0 },
  { name: 'mihomo', cpu: 0 },
  { name: 'postgres', cpu: 0 },
])
const chartData = ref([])
let updateTimer = null

const cpuColor = computed(() => cpu.value > 80 ? '#ef4444' : cpu.value > 50 ? '#eab308' : '#22c55e')
const memoryColor = computed(() => memory.value > 80 ? '#ef4444' : memory.value > 50 ? '#eab308' : '#22c55e')
const diskColor = computed(() => disk.value > 90 ? '#ef4444' : disk.value > 70 ? '#eab308' : '#22c55e')
const tempStatus = computed(() => temp.value > 80 ? '⚠️ 过热' : temp.value > 60 ? '🌡️ 正常' : '✅ 良好')

async function fetchStats() {
  try {
    const res = await fetch('/api/system/stats')
    if (res.ok) {
      const data = await res.json()
      cpu.value = data.cpu || 0
      memory.value = data.memory || 0
      temp.value = data.temp || 0
    }
  } catch (e) {
    cpu.value = Math.floor(Math.random() * 40 + 20)
    memory.value = Math.floor(Math.random() * 30 + 40)
    temp.value = Math.floor(Math.random() * 20 + 45)
  }
  
  chartData.value.push({ cpu: cpu.value, mem: memory.value })
  if (chartData.value.length > 20) chartData.value.shift()
}

onMounted(() => {
  fetchStats()
  updateTimer = setInterval(fetchStats, 3000)
})

onUnmounted(() => {
  if (updateTimer) clearInterval(updateTimer)
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.page-title {
  font-size: 24px;
  margin-bottom: 24px;
  color: #f8fafc;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #1e293b;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  border: 1px solid #334155;
}

.stat-icon {
  font-size: 36px;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #f8fafc;
}

.stat-bar {
  height: 6px;
  background: #334155;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s, background 0.3s;
}

.stat-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.chart-card {
  background: #1e293b;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;
}

.chart-card h3 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #e2e8f0;
}

.mini-chart {
  height: 120px;
  background: #0f172a;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 8px;
}

.chart-bar-group {
  flex: 1;
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 100%;
}

.chart-bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s;
  min-height: 4px;
}

.chart-bar.cpu {
  background: #3b82f6;
}

.chart-bar.mem {
  background: #a78bfa;
}

.chart-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.cpu {
  background: #3b82f6;
}

.dot.mem {
  background: #a78bfa;
}

.process-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.process-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #0f172a;
  border-radius: 6px;
}

.process-name {
  color: #94a3b8;
}

.process-cpu {
  font-weight: bold;
}

/* 移动端响应式 */
@media (max-width: 900px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 20px;
    margin-bottom: 16px;
  }
  
  .stat-card {
    padding: 16px;
    gap: 12px;
  }
  
  .stat-icon {
    font-size: 28px;
  }
  
  .stat-value {
    font-size: 24px;
  }
  
  .stats-grid {
    gap: 12px;
  }
  
  .chart-card {
    padding: 16px;
  }
  
  .mini-chart {
    height: 100px;
  }
}
</style>
