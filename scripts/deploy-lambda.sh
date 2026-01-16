#!/bin/bash
# Deploy Lambda with container image
# Usage: ./scripts/deploy-lambda.sh [stage]

set -e

STAGE=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-sitix-INT}
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Deploying Lambda for stage: $STAGE"
echo "Using AWS Profile: $AWS_PROFILE"
echo ""

# Step 1: Check Docker
echo "📦 Checking Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "✅ Docker is running"

# Step 2: Build and push container image
echo ""
echo "🏗️  Building Docker image..."
cd "$(dirname "$0")/.."
docker build -t ai-search-2-0:latest .

echo ""
echo "🔐 Logging into ECR..."
ECR_REGISTRY="210337553682.dkr.ecr.${REGION}.amazonaws.com"
aws ecr get-login-password --region $REGION --profile $AWS_PROFILE | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

echo ""
echo "📤 Tagging and pushing image..."
docker tag ai-search-2-0:latest ${ECR_REGISTRY}/ai-search-2-0:latest
docker push ${ECR_REGISTRY}/ai-search-2-0:latest

echo ""
echo "🚀 Deploying Lambda..."
AWS_PROFILE=$AWS_PROFILE npx serverless deploy --stage $STAGE

echo ""
echo "✅ Lambda deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Get Lambda security group ID:"
echo "   ./scripts/get-lambda-sg.sh $STAGE"
echo "2. Update terraform.tfvars with lambda_security_group_id"
echo "3. Run: cd infrastructure/terraform && terraform apply"
echo "4. Uncomment VPC section in serverless.yml"
echo "5. Redeploy Lambda with VPC: ./scripts/deploy-lambda-vpc.sh $STAGE"

