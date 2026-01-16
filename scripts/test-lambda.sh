#!/bin/bash
# Test Lambda function
# Usage: ./scripts/test-lambda.sh [stage]

set -e

STAGE=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-sitix-INT}

FUNCTION_NAME="ai-search-2-0-${STAGE}-api"

echo "🧪 Testing Lambda function: $FUNCTION_NAME"
echo ""

# Get API Gateway URL
API_URL=$(aws apigatewayv2 get-apis \
    --region us-east-1 \
    --profile $AWS_PROFILE \
    --query "Items[?Name=='ai-search-2-0-${STAGE}'].ApiEndpoint" \
    --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "⚠️  Could not find API Gateway URL automatically"
    echo "   Please get it from AWS Console:"
    echo "   AWS Console → API Gateway → HTTP APIs → ai-search-2-0-${STAGE}"
    echo ""
    read -p "Enter API Gateway URL (or press Enter to test via Lambda invoke): " API_URL
fi

if [ -n "$API_URL" ]; then
    echo "✅ Testing via API Gateway: $API_URL"
    echo ""
    
    # Test health endpoint
    echo "📋 Testing /api/health..."
    curl -s "${API_URL}/api/health" | python3 -m json.tool || echo "❌ Health check failed"
    echo ""
    
    # Test search endpoint
    echo "📋 Testing /api/search..."
    curl -s -X POST "${API_URL}/api/search" \
        -H "Content-Type: application/json" \
        -d '{"query": "test search"}' | python3 -m json.tool || echo "❌ Search failed"
else
    echo "📋 Testing via Lambda invoke..."
    aws lambda invoke \
        --function-name $FUNCTION_NAME \
        --region us-east-1 \
        --profile $AWS_PROFILE \
        --payload '{"httpMethod":"GET","path":"/api/health"}' \
        /tmp/lambda-response.json
    
    echo ""
    echo "Response:"
    cat /tmp/lambda-response.json | python3 -m json.tool
fi

echo ""
echo "✅ Test complete!"

