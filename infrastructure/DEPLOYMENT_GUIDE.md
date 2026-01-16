# Deployment Guide - Lambda Access Configuration

## AWS Account

**Default AWS Account**: `sitix-INT` (Integration/Development account)

The Terraform configuration uses the AWS profile `sitix-INT` by default. To deploy to a different account:
1. Update `aws_profile` in `terraform.tfvars`
2. Ensure your AWS CLI has the profile configured: `aws configure --profile sitix-INT`

## Lambda Access Setup (Two-Step Process)

### Problem
Lambda functions **outside a VPC cannot access resources inside a VPC** (like your EC2 Ollama instance). You need to configure Lambda to run in the same VPC.

### Solution: Two-Step Deployment

#### Step 1: Deploy Ollama EC2 Instance

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars - leave lambda_security_group_id empty for now
terraform init
terraform apply
```

**After deployment, get the security group ID:**
```bash
terraform output security_group_id
# Example output: sg-0123456789abcdef0
```

#### Step 2: Configure Lambda VPC Access

You have **two options**:

##### Option A: Use Lambda Security Group (Recommended - More Secure)

1. **Deploy Lambda first** (without VPC):
   ```bash
   cd ../../  # Back to ai-search-2.0 root
   npm run deploy:dev
   ```

2. **Get Lambda's Security Group ID**:
   - Go to AWS Console → Lambda → Your function → Configuration → VPC
   - Or create a security group for Lambda manually
   - Note the Security Group ID (e.g., `sg-lambda123`)

3. **Update Terraform** to allow Lambda access:
   ```bash
   cd infrastructure/terraform
   # Edit terraform.tfvars
   lambda_security_group_id = "sg-lambda123"  # Your Lambda security group ID
   ```

4. **Apply Terraform changes**:
   ```bash
   terraform apply
   ```

5. **Update Lambda to use VPC**:
   - Edit `serverless.yml` and uncomment VPC section:
   ```yaml
   vpc:
     securityGroupIds:
       - ${env:LAMBDA_SECURITY_GROUP_ID}  # Use Lambda's security group
     subnetIds:
       - ${env:LAMBDA_SUBNET_ID_1}
       - ${env:LAMBDA_SUBNET_ID_2}
   ```
   - Set environment variables:
     ```bash
     export LAMBDA_SECURITY_GROUP_ID=sg-lambda123
     export LAMBDA_SUBNET_ID_1=subnet-xxx  # Get from VPC
     export LAMBDA_SUBNET_ID_2=subnet-yyy  # Get from VPC
     ```
   - Redeploy Lambda:
     ```bash
     npm run deploy:dev
     ```

##### Option B: Allow Entire VPC CIDR (Simpler - Less Secure)

1. **Deploy Ollama EC2**:
   ```bash
   cd infrastructure/terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars
   allow_vpc_cidr = true  # Allows all resources in VPC to access Ollama
   terraform init
   terraform apply
   ```

2. **Configure Lambda VPC**:
   - Edit `serverless.yml` and uncomment VPC section
   - Set subnet IDs (get from AWS Console or Terraform output)
   - Deploy Lambda:
     ```bash
     npm run deploy:dev
     ```

**⚠️ Warning**: Option B allows **all resources in the VPC** to access Ollama. Use Option A for production.

## Complete Deployment Checklist

- [ ] Deploy Ollama EC2 instance
- [ ] Get Ollama security group ID: `terraform output security_group_id`
- [ ] Get Ollama endpoint: `terraform output ollama_endpoint`
- [ ] Deploy Lambda (first time, without VPC)
- [ ] Get Lambda security group ID (or create one)
- [ ] Update Terraform with `lambda_security_group_id`
- [ ] Apply Terraform: `terraform apply`
- [ ] Configure Lambda VPC in `serverless.yml`
- [ ] Set environment variables for VPC
- [ ] Redeploy Lambda: `npm run deploy:dev`
- [ ] Update `.env` with `LLM_BASE_URL` from Terraform output
- [ ] Test Lambda → Ollama connection

## Testing Lambda Access

After deployment, test from Lambda:

```bash
# Invoke Lambda function
aws lambda invoke \
  --function-name ai-search-2-0-dev-api \
  --payload '{"path":"/api/health"}' \
  response.json

# Check response
cat response.json
```

Or test via API Gateway endpoint (if configured).

## Troubleshooting

### Lambda Cannot Connect to Ollama

1. **Check VPC Configuration**:
   - Lambda must be in same VPC as EC2
   - Lambda must have security group that's allowed in Ollama's security group
   - Lambda must be in private subnets (not public)

2. **Check Security Groups**:
   ```bash
   # Verify Ollama security group allows Lambda
   aws ec2 describe-security-groups --group-ids <ollama-sg-id>
   
   # Verify Lambda security group exists
   aws ec2 describe-security-groups --group-ids <lambda-sg-id>
   ```

3. **Check Network ACLs**:
   - Ensure VPC network ACLs allow traffic between Lambda and EC2

4. **Test from EC2**:
   ```bash
   # SSH to EC2 and test locally
   curl http://localhost:11434/api/tags
   ```

### Cold Start Issues

VPC configuration increases Lambda cold starts (10-15 seconds). To mitigate:
- Use Provisioned Concurrency (costs money)
- Keep functions warm with scheduled pings
- Accept cold starts for cost savings

## Security Best Practices

1. **Use Security Groups** (Option A) instead of VPC CIDR (Option B)
2. **Least Privilege**: Only allow specific security groups, not entire VPC
3. **Encryption**: EC2 root volume is encrypted by default
4. **No Public IP**: EC2 instance has no public IP by default
5. **Private Subnets**: Deploy Lambda in private subnets, not public

