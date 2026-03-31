#!/bin/bash
# AICube Dashboard 自动重启脚本
# 崩溃后自动重启，保持服务持续运行

APP_DIR="/home/moston/.openclaw/workspace/aicube-dashboard"
LOG_FILE="/tmp/aicube-dashboard.log"

echo "[$(date)] AICube Dashboard 启动器初始化..." >> "$LOG_FILE"

while true; do
    echo "[$(date)] 检查服务状态..." >> "$LOG_FILE"
    
    # 停止旧服务和5180端口
    pkill -f "5180" 2>/dev/null || true
    
    cd "$APP_DIR"
    
    # 启动 API 服务器 (内部端口 3000)
    node server/index.cjs >> "$LOG_FILE" 2>&1 &
    API_PID=$!
    echo "[$(date)] API 服务器启动，PID: $API_PID" >> "$LOG_FILE"
    sleep 2
    
    # 启动 Vite 前端
    setsid node node_modules/.bin/vite --host 0.0.0.0 --port 5173 > /tmp/vite.log 2>&1 &
    VITE_PID=$!
    echo "[$(date)] Vite 前端启动，PID: $VITE_PID" >> "$LOG_FILE"
    
    sleep 3
    
    # 检查服务是否成功启动
    if lsof -i :3000 > /dev/null 2>&1 && lsof -i :5173 > /dev/null 2>&1; then
        echo "[$(date)] ✅ 服务启动成功 - API:3000, Frontend:5173" >> "$LOG_FILE"
    else
        echo "[$(date)] ❌ 服务启动失败，准备重试..." >> "$LOG_FILE"
    fi
    
    # 等待服务进程退出
    wait $API_PID $VITE_PID 2>/dev/null
    EXIT_CODE=$?
    echo "[$(date)] 进程退出，代码: $EXIT_CODE，5秒后重启..." >> "$LOG_FILE"
    sleep 5
done
