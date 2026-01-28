# Redeploy Lambda - AI Search 2.0

## Current Situation

✅ **Ollama EC2:** Deployed and working  
⚠️ **Lambda:** Exists but broken (Runtime.InvalidEntrypoint error)  
✅ **VPC:** Configured correctly  
✅ **Environment Variables:** Set correctly  

## Issue

The Lambda function exists but has an invalid entrypoint configuration. The container image may be outdated or misconfigured.

## Solution: Fresh Redeployment

### Step 1: Verify Prerequisites

```bash
cd /Users/seniormike/git/sitickets/marketplace/ai-search-2.0

# Check Docker is running
docker ps

# Check AWS credentials
aws sts get-caller-identity --profile sitix-INT
```

### Step 2: Build TypeScript

```bash
npm install
npm run build

# Verify dist/ exists
ls -la dist/
```

### Step 3: Check/Fix Dockerfile

The Dockerfile should have:
```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

COPY package.json ./
COPY package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY dist/ ./dist/

CMD [ "dist/handler.handler" ]
```

### Step 4: Update serverless.yml (if needed)

For container image deployment, you have two options:

**Option A: Use Container Image (Current)**
```yaml
functions:
  api:
    image:
      uri: 210337553682.dkr.ecr.us-east-1.amazonaws.com/ai-search-2-0:latest
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
```

**Option B: Use Handler (Simpler)**
```yaml
functions:
  api:
    handler: dist/handler.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
```

### Step 5: Deploy Using Script

```bash
# Make sure Docker Desktop is running!
./scripts/deploy-lambda.sh dev
```

This will:
1. Build Docker image
2. Push to ECR
3. Deploy Lambda via Serverless Framework

### Step 6: Verify Deployment

```bash
# Check Lambda status
aws lambda get-function --function-name ai-search-2-0-dev-api \
  --profile sitix-INT --region us-east-1

# Test API Gateway
curl https://tumtocy4zl.execute-api.us-east-1.amazonaws.com/api/health
```

### Step 7: Check Logs if Still Failing

```bash
aws logs tail /aws/lambda/ai-search-2-0-dev-api \
  --follow --profile sitix-INT --region us-east-1
```

---

## Alternative: Quick Test Without Container

If container deployment is problematic, you can temporarily switch to handler-based deployment:

1. **Update serverless.yml** to use handler instead of image
2. **Deploy:**
   ```bash
   AWS_PROFILE=sitix-INT npx serverless deploy --stage dev
   ```
3. **Test** and then switch back to container if needed

---

## Current Configuration Values

- **Ollama Endpoint:** `http://172.31.10.219:11434`
- **Lambda Security Group:** `sg-03461f184dcfed00f`
- **VPC:** `vpc-0fae79ef08d13a4af`
- **Subnets:** `subnet-09cda5a1616c68d86`, `subnet-01263c1d5508e57c7`
- **API Gateway:** `https://tumtocy4zl.execute-api.us-east-1.amazonaws.com`

---

*Ready to redeploy when you are!*

