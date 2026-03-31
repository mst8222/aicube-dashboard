<template>
  <div class="office-wrapper">
    <div class="office-header">
      <h1>🏢 智能体办公室</h1>
      <div class="header-info">
        <span class="info-tag">Godot 4 Web</span>
        <span class="info-hint">点击办公室中的角色查看详情</span>
      </div>
    </div>
    <div class="game-container" ref="containerRef">
      <iframe
        ref="iframeRef"
        src="/office/index.html"
        class="godot-iframe"
        allow="cross-origin-isolated"
        scrolling="no"
        @load="onIframeLoad"
      ></iframe>
    </div>
    <div class="status-bar">
      <span class="status-dot" :class="{ loaded: iframeLoaded }"></span>
      <span>{{ iframeLoaded ? '✅ 游戏已加载' : '⏳ 加载中...' }}</span>
      <button class="btn-fullscreen" @click="toggleFullscreen">
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const iframeRef = ref(null)
const containerRef = ref(null)
const iframeLoaded = ref(false)
const isFullscreen = ref(false)

function onIframeLoad() {
  iframeLoaded.value = true
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<style scoped>
.office-wrapper {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.office-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.office-header h1 {
  font-size: 20px;
  color: #f8fafc;
  margin: 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-tag {
  background: rgba(0, 217, 196, 0.15);
  color: #00d9c4;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  border: 1px solid rgba(0, 217, 196, 0.3);
}

.info-hint {
  color: #64748b;
  font-size: 12px;
}

.game-container {
  flex: 1;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #2a3444;
  background: #0a0a0a;
}

.godot-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #1a2234;
  border-radius: 8px;
  border: 1px solid #2a3444;
  font-size: 13px;
  color: #94a3b8;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fbbf24;
  transition: background 0.3s;
}

.status-dot.loaded {
  background: #22c55e;
}

.btn-fullscreen {
  margin-left: auto;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.2s;
}

.btn-fullscreen:hover {
  background: rgba(59, 130, 246, 0.25);
}
</style>
