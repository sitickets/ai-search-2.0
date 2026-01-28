# Deployment Status - AI Search 2.0

**Date:** January 20, 2026

## Current Status Summary

### ✅ Ollama EC2 - DEPLOYED & WORKING
- **Instance ID:** `i-042f2a42b603994a2`
- **Private IP:** `172.31.10.219`
- **Endpoint:** `http://172.31.10.219:11434`
- **Security Group:** `sg-00ed75bde049599a0`
- **VPC:** `vpc-0fae79ef08d13a4af`
- **Status:** ✅ Running and accessible
- **Model:** `llama3.1:8b-instruct`
- **Lambda Access:** ✅ Configured (allows SG `sg-03461f184dcfed00f`)

### ⚠️ Lambda Function - DEPLOYED BUT NOT WORKING
- **Function Name:** `ai-search-2-0-dev-api`
- **Package Type:** Container Image
- **Image URI:** `210337553682.dkr.ecr.us-east-1.amazonaws.com/ai-search-2-0@sha256:46a2e506e802059705391b13a2867f76b583bd1770a90750ea6f8d0da889634d`
- **VPC Configuration:** ✅ Configured
  - VPC: `vpc-0fae79ef08d13a4af` (same as Ollama)
  - Security Group: `sg-03461f184dcfed00f`
  - Subnets: `subnet-09cda5a1616c68d86`, `subnet-01263c1d5508e57c7`
- **Environment Variables:** ✅ Configured
  - `LLM_BASE_URL=http://172.31.10.219:11434` ✅
  - `LLM_MODEL=llama3.1:8b-instruct` ✅
  - `POSTGRES_DATABASE_URL` ✅ Set
- **Status:** ❌ **ERROR - Runtime.InvalidEntrypoint**

### ✅ API Gateway - DEPLOYED
- **API ID:** `tumtocy4zl`
- **Endpoint:** `https://tumtocy4zl.execute-api.us-east-1.amazonaws.com`
- **Status:** ✅ Deployed but Lambda handler failing

---

## Issue: Runtime.InvalidEntrypoint

**Error:** Lambda is failing with `Runtime.InvalidEntrypoint` error.

**Root Cause:** The Dockerfile CMD format may be incorrect for Lambda container images.

**Current Dockerfile CMD:**
```dockerfile
CMD [ "dist/handler.handler" ]
```

**Problem:** For Lambda container images using the `public.ecr.aws/lambda/nodejs:20` base image, the CMD format needs to match Lambda's expected handler format.

---

## Fix Required

### Option 1: Fix Dockerfile CMD (Recommended)

The Lambda Node.js runtime expects the handler in a specific format. Update the Dockerfile:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev --no-audit --no-fund

# Copy built application
COPY dist/ ./dist/

# Set handler - Lambda container images use this format
CMD [ "dist/handler.handler" ]
```

**OR** if the base image expects a different format, try:

```dockerfile
# Alternative format (if above doesn't work)
CMD [ "node", "dist/handler.js" ]
```

But then you'd need to wrap the handler differently.

### Option 2: Update serverless.yml to Use Container Image Properly

The `serverless.yml` has the container image commented out. For container images, you should either:

1. **Uncomment the image URI** and remove the handler:
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

2. **OR** keep using handler but ensure Dockerfile CMD matches

### Option 3: Rebuild and Redeploy

1. **Rebuild TypeScript:**
   ```bash
   npm run build
   ```

2. **Rebuild Docker Image:**
   ```bash
   docker build -t ai-search-2-0:latest .
   ```

3. **Push to ECR:**
   ```bash
   ECR_REGISTRY="210337553682.dkr.ecr.us-east-1.amazonaws.com"
   aws ecr get-login-password --region us-east-1 --profile sitix-INT | \
       docker login --username AWS --password-stdin $ECR_REGISTRY
   docker tag ai-search-2-0:latest ${ECR_REGISTRY}/ai-search-2-0:latest
   docker push ${ECR_REGISTRY}/ai-search-2-0:latest
   ```

4. **Update Lambda Function:**
   ```bash
   aws lambda update-function-code \
     --function-name ai-search-2-0-dev-api \
     --image-uri ${ECR_REGISTRY}/ai-search-2-0:latest \
     --profile sitix-INT \
     --region us-east-1
   ```

---

## Quick Fix Steps

1. **Check if handler.js exports handler correctly:**
   ```bash
   grep "exports.handler" dist/handler.js
   ```

2. **Verify Dockerfile CMD format** - The format `dist/handler.handler` should work, but Lambda might need it differently.

3. **Check Lambda container image documentation** - The base image `public.ecr.aws/lambda/nodejs:20` has specific requirements.

4. **Test locally with Docker:**
   ```bash
   docker build -t test-lambda .
   docker run -p 9000:8080 test-lambda
   # In another terminal:
   curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
     -d '{"httpMethod":"GET","path":"/api/health"}'
   ```

---

## Next Steps

1. ✅ **Ollama is working** - No action needed
2. ⚠️ **Fix Lambda handler** - Update Dockerfile CMD or rebuild container
3. ✅ **VPC is configured** - No action needed
4. ✅ **Environment variables set** - No action needed
5. 🔄 **Test after fix** - Run `./scripts/test-lambda.sh dev`

---

## Verification Commands

```bash
# Check Lambda status
aws lambda get-function --function-name ai-search-2-0-dev-api \
  --profile sitix-INT --region us-east-1

# Check Lambda logs
aws logs tail /aws/lambda/ai-search-2-0-dev-api \
  --follow --profile sitix-INT --region us-east-1

# Test API Gateway
curl https://tumtocy4zl.execute-api.us-east-1.amazonaws.com/api/health

# Test Ollama (from Lambda VPC or local)
curl http://172.31.10.219:11434/api/tags
```

---

*Last updated: January 20, 2026*

