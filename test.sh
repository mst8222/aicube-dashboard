#!/bin/bash
# 代码测试脚本 - 每次修改后运行此脚本
# 用法: bash scripts/test.sh

echo "🧪 开始测试 AICube Dashboard..."
cd /home/moston/.openclaw/workspace/aicube-dashboard

echo ""
echo "1️⃣ 语法检查..."
for f in src/**/*.vue src/**/*.js; do
  if [ -f "$f" ]; then
    node --check "$f" 2>&1 || echo "❌ $f 有语法错误"
  fi
done

echo ""
echo "2️⃣ 构建测试..."
npm run build 2>&1 | tail -5

echo ""
echo "3️⃣ 开发服务器测试..."
timeout 10 npm run dev > /tmp/vite-test.log 2>&1 &
DEV_PID=$!
sleep 5
if curl -s http://localhost:5173 | grep -q "html"; then
  echo "✅ 开发服务器正常"
else
  echo "❌ 开发服务器启动失败"
fi
kill $DEV_PID 2>/dev/null

echo ""
echo "✅ 测试完成！"
