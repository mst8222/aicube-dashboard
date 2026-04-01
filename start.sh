#!/bin/bash
# AICube Dashboard 自动重启脚本
# 崩溃后自动重启，保持服务持续运行

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/aicube-dashboard.log"
export PATH="/usr/local/bin:$PATH"

echo "[$(date)] AICube Dashboard 启动器初始化..." >> "$LOG_FILE"

while true; do
    echo "[$(date)] 检查服务状态..." >> "$LOG_FILE"
    
    # 停止旧服务和5180端口
    pkill -f "5180" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "server/index" 2>/dev/null || true
    sleep 1
    
    cd "$APP_DIR"
    
    # 启动 API 服务器 (内部端口 3000)
    /usr/local/bin/node server/index.cjs >> "$LOG_FILE" 2>&1 &
    disown
    echo "[$(date)] API 服务器启动" >> "$LOG_FILE"
    sleep 2
    
    # 启动 Vite 前端
    setsid /usr/local/bin/node node_modules/.bin/vite --host 0.0.0.0 --port 5173 > /tmp/vite.log 2>&1 &
    disown
    echo "[$(date)] Vite 前端启动" >> "$LOG_FILE"
    
    sleep 5
    
    # 检查服务是否成功启动
    if lsof -i :3000 > /dev/null 2>&1 && lsof -i :5173 > /dev/null 2>&1; then
        echo "[$(date)] ✅ 服务启动成功 - API:3000, Frontend:5173" >> "$LOG_FILE"
    else
        echo "[$(date)] ❌ 服务启动失败，准备重试..." >> "$LOG_FILE"
    fi
    
    sleep 60
done
