#!/bin/bash
# Get Lambda security group ID
# Usage: ./scripts/get-lambda-sg.sh [stage]

set -e

STAGE=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-sitix-INT}
REGION=${AWS_REGION:-us-east-1}

FUNCTION_NAME="ai-search-2-0-${STAGE}-api"

echo "🔍 Getting Lambda security group for: $FUNCTION_NAME"
echo ""

# Get Lambda function configuration
VPC_CONFIG=$(aws lambda get-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --profile $AWS_PROFILE \
    --query 'VpcConfig' \
    --output json 2>/dev/null || echo '{}')

# Check if Lambda is in VPC
if echo "$VPC_CONFIG" | grep -q '"SecurityGroupIds"'; then
    SG_IDS=$(echo "$VPC_CONFIG" | python3 -c "import sys, json; data=json.load(sys.stdin); print(' '.join(data.get('SecurityGroupIds', [])))")
    
    if [ -n "$SG_IDS" ]; then
        echo "✅ Lambda Security Group IDs:"
        for SG_ID in $SG_IDS; do
            echo "   $SG_ID"
        done
        echo ""
        echo "📝 Add this to terraform.tfvars:"
        echo "   lambda_security_group_id = \"$(echo $SG_IDS | awk '{print $1}')\""
    else
        echo "⚠️  Lambda is in VPC but no security groups found"
    fi
else
    echo "⚠️  Lambda is NOT in a VPC yet"
    echo ""
    echo "📋 Lambda will be deployed without VPC first."
    echo "   After deployment, you can:"
    echo "   1. Create a security group for Lambda manually, OR"
    echo "   2. Let Serverless create one (check AWS Console)"
    echo ""
    echo "   Then run this script again to get the security group ID."
fi

# Also get subnet IDs if available
SUBNET_IDS=$(echo "$VPC_CONFIG" | python3 -c "import sys, json; data=json.load(sys.stdin); print(' '.join(data.get('SubnetIds', [])))" 2>/dev/null || echo "")

if [ -n "$SUBNET_IDS" ]; then
    echo ""
    echo "✅ Lambda Subnet IDs:"
    for SUBNET_ID in $SUBNET_IDS; do
        echo "   $SUBNET_ID"
    done
    echo ""
    echo "📝 Add these to your .env file:"
    echo "   LAMBDA_SUBNET_ID_1=$(echo $SUBNET_IDS | awk '{print $1}')"
    echo "   LAMBDA_SUBNET_ID_2=$(echo $SUBNET_IDS | awk '{print $2}')"
fi

