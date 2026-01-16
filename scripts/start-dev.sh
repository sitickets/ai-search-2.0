#!/bin/bash
# Start both Lambda API and UI via serverless offline

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_DIR/test-ui"

echo "🚀 Starting AI Search 2.0 Development Environment"
echo ""

# Check if ports are available
check_port() {
    if lsof -i :$1 > /dev/null 2>&1; then
        echo "❌ Port $1 is already in use!"
        exit 1
    fi
}

check_port 4000  # API
check_port 4002  # API Lambda
check_port 5001  # UI
check_port 5002  # UI Lambda

echo "✅ All ports available"
echo ""

# Start API in background
echo "📡 Starting API Lambda (port 4000)..."
cd "$PROJECT_DIR"
npm run build > /dev/null 2>&1
npx serverless offline start --httpPort 4000 --lambdaPort 4002 > /tmp/ai-search-api.log 2>&1 &
API_PID=$!
echo "   API PID: $API_PID"
echo "   Logs: tail -f /tmp/ai-search-api.log"

# Wait for API to start
sleep 5

# Start UI in background
echo ""
echo "🖥️  Starting UI Lambda (port 5001)..."
cd "$UI_DIR"
npm run build > /dev/null 2>&1
npx serverless offline start --httpPort 5001 --lambdaPort 5002 > /tmp/ai-search-ui.log 2>&1 &
UI_PID=$!
echo "   UI PID: $UI_PID"
echo "   Logs: tail -f /tmp/ai-search-ui.log"

# Wait for UI to start
sleep 5

echo ""
echo "✅ Both services starting..."
echo ""
echo "📋 Services:"
echo "   - API: http://localhost:4000"
echo "   - UI:  http://localhost:5001"
echo ""
echo "📝 Logs:"
echo "   - API: tail -f /tmp/ai-search-api.log"
echo "   - UI:  tail -f /tmp/ai-search-ui.log"
echo ""
echo "🛑 To stop:"
echo "   kill $API_PID $UI_PID"
echo ""

# Keep script running
wait

