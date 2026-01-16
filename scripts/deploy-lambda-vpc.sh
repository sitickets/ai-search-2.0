#!/bin/bash
# Deploy Lambda with VPC configuration
# Usage: ./scripts/deploy-lambda-vpc.sh [stage]

set -e

STAGE=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-sitix-INT}

echo "🚀 Deploying Lambda with VPC configuration for stage: $STAGE"
echo ""

# Check required environment variables
if [ -z "$LAMBDA_SECURITY_GROUP_ID" ]; then
    echo "❌ Error: LAMBDA_SECURITY_GROUP_ID not set"
    echo "   Run: export LAMBDA_SECURITY_GROUP_ID=sg-xxxxx"
    exit 1
fi

if [ -z "$LAMBDA_SUBNET_ID_1" ] || [ -z "$LAMBDA_SUBNET_ID_2" ]; then
    echo "❌ Error: LAMBDA_SUBNET_ID_1 and LAMBDA_SUBNET_ID_2 must be set"
    echo "   Run: export LAMBDA_SUBNET_ID_1=subnet-xxxxx"
    echo "        export LAMBDA_SUBNET_ID_2=subnet-yyyy"
    exit 1
fi

echo "✅ Using Security Group: $LAMBDA_SECURITY_GROUP_ID"
echo "✅ Using Subnets: $LAMBDA_SUBNET_ID_1, $LAMBDA_SUBNET_ID_2"
echo ""

# Deploy
cd "$(dirname "$0")/.."
AWS_PROFILE=$AWS_PROFILE npx serverless deploy --stage $STAGE

echo ""
echo "✅ Lambda deployed with VPC configuration!"
echo ""
echo "🧪 Test the setup:"
echo "   ./scripts/test-lambda.sh $STAGE"

