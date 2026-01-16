# Complete Deployment Steps - AI Search 2.0 with Lambda + Ollama

## Prerequisites
- Docker Desktop running
- AWS CLI configured with `sitix-INT` profile
- Terraform installed
- Node.js 18+ installed

## Step 1: Deploy Ollama EC2 ✅ (Already Done)

```bash
cd infrastructure/terraform
terraform output
# Security Group: sg-00ed75bde049599a0
# Ollama Endpoint: http://172.31.0.72:11434
```

## Step 2: Build and Push Docker Image

**⚠️ Make sure Docker Desktop is running!**

```bash
cd ai-search-2.0
./scripts/deploy-lambda.sh dev
```

This script will:
1. Check Docker is running
2. Build Docker image
3. Login to ECR
4. Push image to ECR
5. Deploy Lambda (without VPC first)

## Step 3: Get Lambda Security Group ID

After Lambda is deployed, get its security group:

```bash
./scripts/get-lambda-sg.sh dev
```

**OR** manually from AWS Console:
1. Go to AWS Console → Lambda → `ai-search-2-0-dev-api`
2. Configuration → VPC
3. Note the Security Group ID (e.g., `sg-xxxxx`)

**If Lambda doesn't have a security group yet:**
- Serverless Framework will create one automatically when you add VPC config
- Or create one manually in AWS Console

## Step 4: Update Terraform Configuration

Edit `infrastructure/terraform/terraform.tfvars`:

```hcl
lambda_security_group_id = "sg-xxxxx"  # From Step 3
```

Then apply:

```bash
cd infrastructure/terraform
terraform apply
```

This adds a security group rule allowing **only Lambda** to access Ollama on port 11434.

## Step 5: Configure Lambda VPC

### 5a. Get Subnet IDs

From Terraform output or AWS Console, get 2 subnet IDs from the same VPC:
- VPC ID: `vpc-0fae79ef08d13a4af`
- Subnets (use 2 different AZs):
  - `subnet-09cda5a1616c68d86` (us-east-1a)
  - `subnet-01263c1d5508e57c7` (us-east-1b)

### 5b. Update .env file

Add to `.env`:

```bash
# Lambda VPC Configuration
LAMBDA_SECURITY_GROUP_ID=sg-xxxxx  # From Step 3
LAMBDA_SUBNET_ID_1=subnet-09cda5a1616c68d86
LAMBDA_SUBNET_ID_2=subnet-01263c1d5508e57c7

# Ollama Configuration
LLM_BASE_URL=http://172.31.0.72:11434
LLM_MODEL=llama3.1:8b-instruct
```

### 5c. Uncomment VPC in serverless.yml

Edit `serverless.yml` and uncomment lines 78-83:

```yaml
vpc:
  securityGroupIds:
    - ${env:LAMBDA_SECURITY_GROUP_ID}
  subnetIds:
    - ${env:LAMBDA_SUBNET_ID_1}
    - ${env:LAMBDA_SUBNET_ID_2}
```

## Step 6: Redeploy Lambda with VPC

```bash
export LAMBDA_SECURITY_GROUP_ID=sg-xxxxx
export LAMBDA_SUBNET_ID_1=subnet-09cda5a1616c68d86
export LAMBDA_SUBNET_ID_2=subnet-01263c1d5508e57c7

./scripts/deploy-lambda-vpc.sh dev
```

**OR** use the deploy script directly:

```bash
AWS_PROFILE=sitix-INT npx serverless deploy --stage dev
```

## Step 7: Test the Setup

```bash
./scripts/test-lambda.sh dev
```

**OR** manually:

1. Get API Gateway URL from AWS Console
2. Test health endpoint:
   ```bash
   curl https://xxxxx.execute-api.us-east-1.amazonaws.com/api/health
   ```

3. Test search endpoint:
   ```bash
   curl -X POST https://xxxxx.execute-api.us-east-1.amazonaws.com/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "find tickets for Taylor Swift"}'
   ```

## Security Summary

After completion:
- ✅ Ollama EC2: **Only accessible from Lambda security group** (port 11434)
- ✅ Lambda: **In VPC, can access Ollama via private IP**
- ✅ No public internet access to Ollama
- ✅ Encrypted volumes on EC2
- ✅ Least-privilege IAM roles

## Troubleshooting

### Docker not running
```bash
# Start Docker Desktop, then retry
docker ps
```

### Lambda can't reach Ollama
1. Check Lambda is in VPC (Configuration → VPC)
2. Check security group rules on Ollama (should allow Lambda SG)
3. Check Lambda and Ollama are in same VPC
4. Check subnet routing (should have NAT Gateway for outbound)

### Cold start too slow
- VPC Lambda cold starts: 10-15 seconds (normal)
- Consider using Provisioned Concurrency for production

### Package size error
- Using container image (10GB limit) - should not hit this
- If using ZIP, optimize package exclusions in serverless.yml

