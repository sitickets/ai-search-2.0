# Lambda Feasibility Analysis

## Can the Node.js MPC Service Run in Lambda?

**Short Answer:** Yes, but with trade-offs. Lambda is feasible but ECS is better for this use case.

---

## Lambda Size Limits

### Current Constraints:
- **Deployment Package**: 50 MB (zipped) or 250 MB (unzipped)
- **Container Image**: Up to 10 GB (better option)
- **Layers**: Can add up to 5 layers, 250 MB each (unzipped)

### Our Dependencies Size Estimate:

```json
{
  "express": "~2 MB",
  "pg": "~1 MB",
  "langchain": "~5 MB",
  "@langchain/openai": "~2 MB",
  "@langchain/community": "~3 MB",
  "axios": "~500 KB",
  "zod": "~200 KB",
  "dotenv": "~50 KB",
  "typeorm": "~3 MB (if used)"
}
```

**Total:** ~16-20 MB (well under 50 MB limit)

**Verdict:** ✅ **Size is NOT a problem** - easily fits in Lambda

---

## Lambda Architecture Options

### Option 1: Lambda Function (ZIP Deployment)

**Pros:**
- ✅ Fast deployment
- ✅ Simple setup
- ✅ Pay per request
- ✅ Auto-scaling

**Cons:**
- ❌ Cold starts (1-3 seconds)
- ❌ Connection pooling challenges (PostgreSQL)
- ❌ 15-minute timeout limit
- ❌ Can't maintain persistent connections to Ollama

**Size:** ✅ Fits easily (< 20 MB)

---

### Option 2: Lambda Container Image

**Pros:**
- ✅ Larger size limit (10 GB)
- ✅ Can include more dependencies
- ✅ Better for complex apps
- ✅ Same benefits as ZIP

**Cons:**
- ❌ Slower cold starts (3-10 seconds)
- ❌ Same connection pooling issues
- ❌ Same timeout limits

**Size:** ✅ More than enough space

---

## Key Challenges

### 1. PostgreSQL Connection Pooling

**Problem:**
- Lambda functions are stateless
- Each invocation creates new connections
- Can exhaust database connections
- Connection overhead adds latency

**Solutions:**
- Use **RDS Proxy** (recommended)
  - Connection pooling managed by AWS
  - Reduces connection overhead
  - Cost: ~$15/month
- Use **Lambda Layers** for pg connection
- Limit concurrent executions

**Verdict:** ✅ Solvable with RDS Proxy

---

### 2. LLM Calls (Ollama on EC2)

**Problem:**
- Lambda needs to call Ollama on EC2
- Network latency between Lambda and EC2
- Cold starts delay LLM calls
- Timeout risk (15-minute limit)

**Solutions:**
- Use **API Gateway** or **ALB** in front of Ollama
- Use **VPC Lambda** (same VPC as EC2)
- Cache responses in DynamoDB/ElastiCache
- Use **Lambda Layers** for LangChain

**Verdict:** ⚠️ Works but adds complexity

---

### 3. Cold Starts

**Problem:**
- First request: 1-10 seconds delay
- Subsequent requests: fast (< 100ms)
- Bad for user experience

**Solutions:**
- Use **Provisioned Concurrency** (costs money)
- Use **Lambda SnapStart** (Java only)
- Keep functions warm with scheduled pings
- Accept cold starts for cost savings

**Verdict:** ⚠️ Acceptable trade-off

---

### 4. Timeout Limits

**Problem:**
- Lambda max timeout: 15 minutes
- LLM calls can be slow (1-5 seconds)
- Complex queries might take longer

**Solutions:**
- Use async processing (SQS + separate Lambda)
- Optimize LLM calls
- Use faster models
- Break complex queries into steps

**Verdict:** ✅ 15 minutes is plenty for most queries

---

## Lambda Architecture

### Recommended: Lambda + RDS Proxy + API Gateway

```
User
  ↓
API Gateway
  ↓
Lambda Function (MPC Service)
  ├─→ RDS Proxy → PostgreSQL
  ├─→ HTTP Call → Ollama (EC2)
  └─→ HTTP Call → Brave Search API
```

**Components:**
- **API Gateway**: Routes requests to Lambda
- **Lambda**: Runs MPC service (Node.js)
- **RDS Proxy**: Manages PostgreSQL connections
- **EC2**: Runs Ollama (unchanged)
- **External**: Brave Search API (unchanged)

---

## Cost Comparison

### Lambda vs ECS (10,000 requests/day)

#### Lambda:
- **Requests**: 10,000/day = 300K/month
- **Compute**: 1GB memory, 2s average = ~$5/month
- **RDS Proxy**: ~$15/month
- **API Gateway**: ~$3/month
- **Total**: ~$23/month

#### ECS (Current):
- **ECS Tasks**: ~$20/month (management)
- **EC2 for tasks**: ~$30/month (t3.small)
- **Total**: ~$50/month

**Verdict:** ✅ Lambda is cheaper at low-medium volume

---

### Lambda vs ECS (100,000 requests/day)

#### Lambda:
- **Requests**: 100K/day = 3M/month
- **Compute**: 1GB memory, 2s average = ~$50/month
- **RDS Proxy**: ~$15/month
- **API Gateway**: ~$30/month
- **Total**: ~$95/month

#### ECS:
- **ECS Tasks**: ~$20/month
- **EC2 for tasks**: ~$60/month (larger instance)
- **Total**: ~$80/month

**Verdict:** ⚠️ Similar cost, ECS might be slightly cheaper

---

## Lambda Implementation

### serverless.yml Example

```yaml
service: ai-search-2.0

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  timeout: 300  # 5 minutes
  memorySize: 1024  # 1 GB
  environment:
    POSTGRES_DATABASE_URL: ${env:POSTGRES_DATABASE_URL}
    RDS_PROXY_ENDPOINT: ${env:RDS_PROXY_ENDPOINT}
    OLLAMA_BASE_URL: ${env:OLLAMA_BASE_URL}
    BRAVE_SEARCH_API_KEY: ${env:BRAVE_SEARCH_API_KEY}
  vpc:
    securityGroupIds:
      - ${env:SECURITY_GROUP_ID}
    subnetIds:
      - ${env:SUBNET_ID_ONE}
      - ${env:SUBNET_ID_TWO}

functions:
  search:
    handler: src/handlers/search.handler
    events:
      - http:
          path: /api/search
          method: POST
          cors: true
      - http:
          path: /api/search/{proxy+}
          method: ANY
          cors: true
```

---

## Recommendation

### Use Lambda If:
- ✅ **Low-medium traffic** (< 50K requests/day)
- ✅ **Cost-sensitive** (want pay-per-use)
- ✅ **Simple deployment** (serverless framework)
- ✅ **Variable traffic** (spiky patterns)

### Use ECS If:
- ✅ **High traffic** (> 50K requests/day)
- ✅ **Consistent performance** (no cold starts)
- ✅ **Complex architecture** (multiple services)
- ✅ **Long-running connections** (WebSockets, etc.)

---

## Hybrid Approach (Best of Both)

### Use Lambda for:
- API endpoints
- Stateless operations
- Auto-scaling needs

### Use ECS for:
- Ollama (LLM) - needs persistent GPU
- Background jobs
- Long-running processes

**Architecture:**
```
API Gateway → Lambda (MPC API) → RDS Proxy → PostgreSQL
                              → HTTP → ECS/EC2 (Ollama)
                              → HTTP → Brave Search API
```

---

## Size Breakdown

### Current Package Size:
- **Dependencies**: ~20 MB
- **Source code**: ~500 KB
- **Total**: ~20-25 MB

### Lambda Limits:
- **ZIP upload**: 50 MB ✅ (we're at ~25 MB)
- **Unzipped**: 250 MB ✅ (plenty of room)
- **Container**: 10 GB ✅ (way more than needed)

**Verdict:** ✅ **Size is NOT an issue** - easily fits

---

## Implementation Steps

### 1. Convert Express App to Lambda Handler

```typescript
// src/handlers/search.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { mpcService } from '../services/mpcService';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { query, conversation_id } = JSON.parse(event.body || '{}');
  
  const result = await mpcService.processQuery({
    query,
    conversationId: conversation_id
  });
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(result)
  };
};
```

### 2. Set Up RDS Proxy
- Create RDS Proxy in AWS Console
- Point to RDS PostgreSQL instance
- Update connection string to use proxy endpoint

### 3. Configure VPC
- Lambda needs VPC access to reach EC2 (Ollama)
- Configure security groups and subnets

### 4. Deploy with Serverless Framework
```bash
npm install -g serverless
serverless deploy
```

---

## Summary

**Can it run in Lambda?** ✅ **Yes**

**Is size a problem?** ❌ **No** - ~25 MB, well under limits

**Should you use Lambda?** ⚠️ **Depends on traffic**

**Recommendation:**
- **Low-medium traffic**: Use Lambda (cheaper, simpler)
- **High traffic**: Use ECS (better performance, similar cost)
- **Hybrid**: Lambda for API + ECS for Ollama (best of both)

**The Node.js service itself is small enough for Lambda** - the decision is more about architecture and traffic patterns than size constraints.

