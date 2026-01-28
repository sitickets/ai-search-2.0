# Lambda Deployment Plan - AI Search 2.0

## Project Overview

**AI Search 2.0** is a smart search tool with a ChatGPT-like interface for querying ticketing data from the SiTickets marketplace PostgreSQL database. It provides:

- Natural language queries for tickets, events, prices, and locations
- PostgreSQL integration (UAT database - read-only)
- LLM-powered search using Ollama (self-hosted on EC2)
- Web search enhancement for contextual data
- Serverless deployment via AWS Lambda

## Architecture Components

1. **AWS Lambda Function** - Serverless API endpoint
2. **PostgreSQL RDS** - UAT database (read-only access)
3. **Ollama EC2 Instance** - Self-hosted LLM (llama3.1:8b-instruct)
4. **API Gateway** - HTTP API endpoint (auto-configured by Serverless Framework)
5. **VPC Configuration** - Lambda needs VPC access to reach Ollama EC2 and RDS

## Prerequisites Checklist

- [ ] AWS CLI configured with `sitix-INT` profile
- [ ] Docker Desktop installed and running
- [ ] Node.js 20.x installed
- [ ] Terraform >= 1.0 installed
- [ ] Serverless Framework installed globally (`npm install -g serverless`)
- [ ] Access to UAT PostgreSQL database credentials
- [ ] AWS account permissions for:
  - Lambda creation/management
  - ECR (Elastic Container Registry)
  - EC2 (for Ollama instance)
  - VPC configuration
  - IAM role creation

## Deployment Steps

### Phase 1: Infrastructure Setup (Ollama EC2)

#### Step 1.1: Configure Terraform

```bash
cd ai-search-2.0/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your configuration:
```hcl
aws_region  = "us-east-1"
aws_profile = "sitix-INT"
project_name = "ai-search-2-0-ollama"
environment  = "dev"
instance_type = "g4dn.xlarge"  # GPU instance (~$0.50/hour)
ollama_model  = "llama3.1:8b-instruct"
use_default_vpc = true
# Leave lambda_security_group_id empty for now (will add after Lambda deployment)
```

#### Step 1.2: Deploy Ollama EC2 Instance

```bash
terraform init
terraform plan  # Review changes
terraform apply  # Deploy infrastructure
```

**Expected Output:**
- EC2 instance created
- Security group created
- Ollama installed and model downloaded
- Private IP address for Ollama endpoint

#### Step 1.3: Get Terraform Outputs

```bash
terraform output ollama_endpoint
# Example: http://172.31.0.72:11434

terraform output security_group_id
# Example: sg-00ed75bde049599a0

terraform output vpc_id
# Example: vpc-0fae79ef08d13a4af
```

**Save these values** - you'll need them for Lambda configuration.

---

### Phase 2: Lambda Deployment (Initial - Without VPC)

#### Step 2.1: Configure Environment Variables

Create `.env` file in `ai-search-2.0/` directory:

```bash
cd ai-search-2.0
# Create .env file (DO NOT commit to git)
```

**Required Environment Variables:**

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=sitix-INT

# Database Configuration (UAT - Read Only)
POSTGRES_DATABASE_URL=postgresql://michael_gallina:73Do2bB9Fl1SKtAFNiB9@uat-sitickets-aurora-cluster.cluster-cmzvajts10ys.us-east-1.rds.amazonaws.com:5432/uat
POSTGRES_DATABASE_URL_RO=postgresql://michael_gallina:73Do2bB9Fl1SKtAFNiB9@uat-sitickets-aurora-cluster.cluster-cmzvajts10ys.us-east-1.rds.amazonaws.com:5432/uat

# LLM Configuration (Ollama - will be updated after VPC setup)
# For now, leave empty or use placeholder - Lambda can't reach Ollama yet
LLM_BASE_URL=http://172.31.0.72:11434  # From terraform output
LLM_MODEL=llama3.1:8b-instruct

# Server Configuration
NODE_ENV=production
CORS_ORIGIN=*
LOG_LEVEL=info

# Lambda VPC Configuration (will be set in Phase 3)
# LAMBDA_SECURITY_GROUP_ID=  # Will be set after first deployment
# LAMBDA_SUBNET_ID_1=  # Get from VPC
# LAMBDA_SUBNET_ID_2=  # Get from VPC
```

#### Step 2.2: Build TypeScript

```bash
npm install
npm run build
```

Verify build succeeded:
```bash
ls -la dist/
# Should see: handler.js, handler.d.ts, index.js, routes/, services/, etc.
```

#### Step 2.3: Deploy Lambda (Without VPC - Initial Deployment)

**Option A: Using Deployment Script**

```bash
# Make sure Docker Desktop is running!
./scripts/deploy-lambda.sh dev
```

This script will:
1. Check Docker is running
2. Build Docker image
3. Login to ECR
4. Push image to ECR
5. Deploy Lambda using Serverless Framework

**Option B: Manual Deployment**

```bash
# Build Docker image
docker build -t ai-search-2-0:latest .

# Login to ECR
ECR_REGISTRY="210337553682.dkr.ecr.us-east-1.amazonaws.com"
aws ecr get-login-password --region us-east-1 --profile sitix-INT | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

# Tag and push
docker tag ai-search-2-0:latest ${ECR_REGISTRY}/ai-search-2-0:latest
docker push ${ECR_REGISTRY}/ai-search-2-0:latest

# Deploy Lambda
AWS_PROFILE=sitix-INT npx serverless deploy --stage dev
```

#### Step 2.4: Verify Initial Deployment

```bash
# Get Lambda function name
aws lambda list-functions --profile sitix-INT --region us-east-1 | grep ai-search

# Get API Gateway URL from Serverless output or AWS Console
# Test health endpoint (may fail if Lambda can't reach DB/Ollama yet)
curl https://<api-gateway-url>/api/health
```

**Note:** At this stage, Lambda may not be able to reach:
- Ollama EC2 (needs VPC configuration)
- RDS PostgreSQL (may need VPC configuration depending on RDS setup)

---

### Phase 3: VPC Configuration (Lambda → Ollama & RDS)

#### Step 3.1: Get Lambda Security Group ID

After Lambda is deployed, get its security group:

**Option A: Using Script**

```bash
./scripts/get-lambda-sg.sh dev
```

**Option B: Manual**

1. Go to AWS Console → Lambda → `ai-search-2-0-dev-api`
2. Configuration → VPC
3. Note the Security Group ID (e.g., `sg-xxxxx`)

**If Lambda doesn't have a security group yet:**
- Serverless Framework will create one automatically when you add VPC config
- Or create one manually in AWS Console

#### Step 3.2: Get VPC Subnet IDs

From Terraform output or AWS Console, get 2 subnet IDs from the same VPC:

```bash
# From Terraform
terraform output vpc_id

# From AWS Console or CLI
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0fae79ef08d13a4af" \
  --profile sitix-INT \
  --region us-east-1 \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' \
  --output table
```

**Select 2 subnets in different availability zones** (e.g., us-east-1a and us-east-1b).

#### Step 3.3: Update Terraform to Allow Lambda Access

Edit `infrastructure/terraform/terraform.tfvars`:

```hcl
# Add Lambda security group ID (from Step 3.1)
lambda_security_group_id = "sg-xxxxx"  # Your Lambda security group ID
```

Apply Terraform changes:

```bash
cd infrastructure/terraform
terraform apply
```

This adds a security group rule allowing **only Lambda** to access Ollama on port 11434.

#### Step 3.4: Configure Lambda VPC in serverless.yml

Edit `serverless.yml` and uncomment lines 78-83:

```yaml
vpc:
  securityGroupIds:
    - ${env:LAMBDA_SECURITY_GROUP_ID}
  subnetIds:
    - ${env:LAMBDA_SUBNET_ID_1}
    - ${env:LAMBDA_SUBNET_ID_2}
```

#### Step 3.5: Update .env with VPC Configuration

Add to `.env`:

```bash
# Lambda VPC Configuration
LAMBDA_SECURITY_GROUP_ID=sg-xxxxx  # From Step 3.1
LAMBDA_SUBNET_ID_1=subnet-09cda5a1616c68d86  # From Step 3.2
LAMBDA_SUBNET_ID_2=subnet-01263c1d5508e57c7  # From Step 3.2

# Ollama Configuration (update with actual private IP)
LLM_BASE_URL=http://172.31.0.72:11434  # From terraform output
LLM_MODEL=llama3.1:8b-instruct
```

#### Step 3.6: Redeploy Lambda with VPC

**Option A: Using Script**

```bash
export LAMBDA_SECURITY_GROUP_ID=sg-xxxxx
export LAMBDA_SUBNET_ID_1=subnet-xxx
export LAMBDA_SUBNET_ID_2=subnet-yyy

./scripts/deploy-lambda-vpc.sh dev
```

**Option B: Manual**

```bash
export LAMBDA_SECURITY_GROUP_ID=sg-xxxxx
export LAMBDA_SUBNET_ID_1=subnet-xxx
export LAMBDA_SUBNET_ID_2=subnet-yyy

AWS_PROFILE=sitix-INT npx serverless deploy --stage dev
```

**⚠️ Important:** VPC configuration increases Lambda cold start times (10-15 seconds). This is normal.

---

### Phase 4: RDS Access Configuration

#### Step 4.1: Verify RDS Security Group

Check if RDS PostgreSQL allows access from Lambda's security group:

```bash
# Get RDS security group ID
aws rds describe-db-clusters \
  --db-cluster-identifier uat-sitickets-aurora-cluster \
  --profile sitix-INT \
  --region us-east-1 \
  --query 'DBClusters[0].VpcSecurityGroups[*].VpcSecurityGroupId' \
  --output text
```

#### Step 4.2: Add Lambda Security Group to RDS

If Lambda security group is not allowed, add it:

```bash
# Get RDS security group ID (from Step 4.1)
RDS_SG_ID=sg-xxxxx

# Add ingress rule allowing Lambda security group
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $LAMBDA_SECURITY_GROUP_ID \
  --profile sitix-INT \
  --region us-east-1
```

**Or via AWS Console:**
1. Go to EC2 → Security Groups
2. Select RDS security group
3. Inbound Rules → Edit
4. Add rule: Type=PostgreSQL, Port=5432, Source=Lambda security group ID

---

### Phase 5: Testing & Verification

#### Step 5.1: Test Health Endpoint

```bash
# Get API Gateway URL from Serverless output or AWS Console
API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev

# Test health endpoint
curl $API_URL/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-12-18T..."
}
```

#### Step 5.2: Test Search Endpoint

```bash
# Test natural language search
curl -X POST $API_URL/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "find tickets for Taylor Swift"}'

# Test direct ticket search
curl -X POST $API_URL/api/search/tickets \
  -H "Content-Type: application/json" \
  -d '{"performer": "Taylor Swift", "priceMax": 200, "limit": 10}'
```

#### Step 5.3: Test Lambda → Ollama Connection

```bash
# Test chat endpoint (uses Ollama)
curl -X POST $API_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What tickets are available?",
    "conversation_id": "test-123"
  }'
```

#### Step 5.4: Monitor Lambda Logs

```bash
# View recent logs
aws logs tail /aws/lambda/ai-search-2-0-dev-api \
  --follow \
  --profile sitix-INT \
  --region us-east-1

# Or use Serverless Framework
npx serverless logs -f api --stage dev --tail
```

---

## Troubleshooting

### Issue: Docker Not Running

**Error:** `Docker is not running`

**Solution:**
```bash
# Start Docker Desktop, then retry
docker ps
./scripts/deploy-lambda.sh dev
```

---

### Issue: Lambda Cannot Connect to Ollama

**Symptoms:**
- Health check fails
- Chat endpoint returns timeout/connection errors
- Lambda logs show "ECONNREFUSED" or "ETIMEDOUT"

**Solutions:**

1. **Check Lambda is in VPC:**
   ```bash
   aws lambda get-function-configuration \
     --function-name ai-search-2-0-dev-api \
     --profile sitix-INT \
     --region us-east-1 \
     --query 'VpcConfig'
   ```
   Should show security groups and subnets.

2. **Check Security Group Rules:**
   ```bash
   # Verify Ollama security group allows Lambda
   aws ec2 describe-security-groups \
     --group-ids <ollama-sg-id> \
     --profile sitix-INT \
     --region us-east-1 \
     --query 'SecurityGroups[0].IpPermissions'
   ```
   Should show ingress rule allowing Lambda security group on port 11434.

3. **Check Lambda and Ollama are in Same VPC:**
   ```bash
   # Get Lambda VPC
   aws lambda get-function-configuration \
     --function-name ai-search-2-0-dev-api \
     --profile sitix-INT \
     --region us-east-1 \
     --query 'VpcConfig.VpcId'
   
   # Get Ollama VPC
   terraform output vpc_id
   ```
   Should match.

4. **Check Subnet Routing:**
   - Lambda subnets need NAT Gateway for outbound internet access
   - Check route tables in AWS Console

---

### Issue: Lambda Cannot Connect to RDS

**Symptoms:**
- Database queries fail
- Health check shows database disconnected

**Solutions:**

1. **Check RDS Security Group:**
   ```bash
   aws ec2 describe-security-groups \
     --group-ids <rds-sg-id> \
     --profile sitix-INT \
     --region us-east-1 \
     --query 'SecurityGroups[0].IpPermissions'
   ```
   Should allow Lambda security group on port 5432.

2. **Verify RDS and Lambda are in Same VPC:**
   - Check RDS VPC in AWS Console
   - Should match Lambda VPC

3. **Check Connection String:**
   - Verify `POSTGRES_DATABASE_URL` in `.env` is correct
   - Use read-only endpoint if available

---

### Issue: Cold Start Too Slow

**Symptoms:**
- First request takes 10-15 seconds
- Subsequent requests are fast

**Explanation:**
- This is **normal** for VPC-configured Lambdas
- VPC adds 10-15 seconds to cold starts

**Solutions:**

1. **Accept Cold Starts** (cost-effective):
   - Keep functions warm with scheduled pings
   - Use CloudWatch Events to ping every 5 minutes

2. **Use Provisioned Concurrency** (costs money):
   - Keeps Lambda warm, eliminates cold starts
   - Configure in `serverless.yml`:
     ```yaml
     provisionedConcurrency: 1  # Keeps 1 instance warm
     ```

---

### Issue: Package Size Error

**Symptoms:**
- Deployment fails with "package too large" error

**Solution:**
- Using container image (10GB limit) - should not hit this
- If using ZIP deployment, optimize exclusions in `serverless.yml`

---

### Issue: ECR Push Fails

**Error:** `no basic auth credentials`

**Solution:**
```bash
# Re-authenticate with ECR
ECR_REGISTRY="210337553682.dkr.ecr.us-east-1.amazonaws.com"
aws ecr get-login-password --region us-east-1 --profile sitix-INT | \
    docker login --username AWS --password-stdin $ECR_REGISTRY
```

---

## Security Checklist

- [ ] Lambda security group restricts access appropriately
- [ ] Ollama security group only allows Lambda (not public internet)
- [ ] RDS security group only allows Lambda (not public internet)
- [ ] Database credentials stored in `.env` (not committed to git)
- [ ] Use read-only database connection for queries
- [ ] SSL/TLS enabled for database connections
- [ ] CORS configured appropriately (not `*` in production)
- [ ] IAM roles follow least-privilege principle
- [ ] EC2 root volume encrypted
- [ ] No public IP on EC2 instance (unless required)

---

## Cost Estimation

### Infrastructure Costs (Monthly)

1. **Lambda:**
   - Free tier: 1M requests/month, 400K GB-seconds
   - Beyond free tier: ~$0.20 per 1M requests + compute time
   - Estimated: **$0-50/month** (depending on usage)

2. **Ollama EC2 (g4dn.xlarge):**
   - ~$0.50/hour = **~$360/month** (if running 24/7)
   - Can use Spot Instances for 60-90% savings
   - Can auto-stop during off-hours

3. **RDS:**
   - Already exists (no additional cost)
   - Read-only queries don't impact primary database

4. **API Gateway:**
   - Free tier: 1M requests/month
   - Beyond: $1.00 per 1M requests
   - Estimated: **$0-10/month**

**Total Estimated Cost:** ~$370-420/month (primarily EC2)

---

## Next Steps After Deployment

1. **Set up Monitoring:**
   - CloudWatch alarms for errors
   - CloudWatch dashboards for metrics
   - X-Ray tracing for debugging

2. **Set up CI/CD:**
   - GitHub Actions or AWS CodePipeline
   - Automated testing before deployment
   - Staging environment

3. **Optimize Performance:**
   - Add caching layer (Redis/ElastiCache)
   - Optimize database queries
   - Consider connection pooling

4. **Production Hardening:**
   - Move secrets to AWS Secrets Manager
   - Enable WAF on API Gateway
   - Set up rate limiting
   - Add authentication/authorization

5. **Cost Optimization:**
   - Use EC2 Spot Instances for Ollama
   - Auto-stop EC2 during off-hours
   - Monitor Lambda costs and optimize

---

## Rollback Plan

If deployment fails or issues occur:

1. **Rollback Lambda:**
   ```bash
   # Deploy previous version
   npx serverless deploy --stage dev --version <previous-version>
   
   # Or remove VPC config temporarily
   # Comment out VPC section in serverless.yml
   npx serverless deploy --stage dev
   ```

2. **Rollback Terraform:**
   ```bash
   cd infrastructure/terraform
   terraform destroy  # Only if needed - removes EC2 instance
   ```

3. **Disable Function:**
   ```bash
   # Disable Lambda function
   aws lambda update-function-configuration \
     --function-name ai-search-2-0-dev-api \
     --state Inactive \
     --profile sitix-INT \
     --region us-east-1
   ```

---

## Support & Documentation

- **Project README:** `ai-search-2.0/README.md`
- **Deployment Steps:** `ai-search-2.0/DEPLOYMENT_STEPS.md`
- **Infrastructure Guide:** `ai-search-2.0/infrastructure/DEPLOYMENT_GUIDE.md`
- **Chat History:** `ai-search-2.0/CHAT_HISTORY.md`
- **Database Connections:** `connections.md` (parent directory)

---

*Last updated: December 18, 2024*

