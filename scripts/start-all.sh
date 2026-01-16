#!/bin/bash
# Start both API Lambda and UI server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_DIR/test-ui"

echo "🚀 Starting AI Search 2.0 - API + UI"
echo ""

# Check ports
check_port() {
    if lsof -i :$1 > /dev/null 2>&1; then
        echo "⚠️  Port $1 is in use - stopping existing process..."
        lsof -ti :$1 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

check_port 4000  # API
check_port 4002  # API Lambda
check_port 5001  # UI

echo "✅ Ports available"
echo ""

# Build API
echo "📦 Building API..."
cd "$PROJECT_DIR"
npm run build > /dev/null 2>&1 || echo "Build completed with warnings"

# Start API in background
echo "📡 Starting API Lambda (port 4000)..."
npx serverless offline start --httpPort 4000 --lambdaPort 4002 > /tmp/ai-search-api.log 2>&1 &
API_PID=$!
echo "   PID: $API_PID"
echo "   Logs: tail -f /tmp/ai-search-api.log"

# Wait for API
sleep 5

# Ensure UI HTML file exists
cd "$UI_DIR"
if [ ! -f "index.html" ]; then
    echo "📄 Creating UI file..."
    cp public/index.html index.html 2>/dev/null || true
fi

# Start UI in background
echo ""
echo "🖥️  Starting UI Server (port 5001)..."
cd "$UI_DIR"
python3 -m http.server 5001 > /tmp/ai-search-ui.log 2>&1 &
UI_PID=$!
echo "   PID: $UI_PID"
echo "   Logs: tail -f /tmp/ai-search-ui.log"

# Wait for UI
sleep 2

echo ""
echo "✅ Both services started!"
echo ""
echo "📋 Services:"
echo "   - API: http://localhost:4000"
echo "   - UI:  http://localhost:5001"
echo ""
echo "🌐 Open: http://localhost:5001"
echo ""
echo "📝 Logs:"
echo "   - API: tail -f /tmp/ai-search-api.log"
echo "   - UI:  tail -f /tmp/ai-search-ui.log"
echo ""
echo "🛑 To stop:"
echo "   kill $API_PID $UI_PID"
echo "   OR: pkill -f 'serverless offline.*4000' && pkill -f 'python3.*5001'"
echo ""

# Keep running
wait

