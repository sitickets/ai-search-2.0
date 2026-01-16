# Infrastructure - AI Search 2.0

This directory contains Terraform configuration to deploy an Ollama instance on EC2, optimized for **structured queries**, **conversation**, and **web search**.

## Recommended Configuration

### Model: `llama3.1:8b-instruct`
- **Best for**: Structured queries, SQL generation, conversation context
- **Why**: 8B parameters is the sweet spot for "it just works" quality
- **Alternatives**: 
  - `qwen2.5:7b-instruct` - Excellent at structured JSON extraction
  - `mistral:7b-instruct` - Good general-purpose option

### Instance: `g4dn.xlarge`
- **GPU**: NVIDIA T4 (16GB VRAM)
- **Cost**: ~$0.50/hour (~$360/month if running 24/7)
- **Performance**: Handles 8B models well, ~2-5 second inference
- **Alternatives**:
  - `g5.xlarge` - Better GPU (~$1.00/hour) for faster inference
  - `t3.xlarge` - CPU-only (~$0.17/hour) - slower but works

## AWS Account

**Default**: `sitix-INT` (Integration/Development account)

The Terraform uses AWS profile `sitix-INT` by default. To change:
- Update `aws_profile` in `terraform.tfvars`
- Ensure AWS CLI profile is configured: `aws configure --profile sitix-INT`

## Quick Start

### 1. Prerequisites
- AWS CLI configured with credentials
- Terraform >= 1.0 installed
- AWS profile set (default: `sitix-INT`)

### 2. Configure Terraform

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings
```

**Key settings in `terraform.tfvars`:**
```hcl
instance_type = "g4dn.xlarge"  # GPU instance
ollama_model  = "llama3.1:8b-instruct"  # Best for structured queries
```

### 3. Deploy

```bash
terraform init
terraform plan  # Review changes
terraform apply  # Deploy infrastructure
```

### 4. Get Configuration

After deployment, Terraform will output:
- `ollama_endpoint` - URL to use in `.env`
- `security_group_id` - For Lambda VPC configuration

```bash
terraform output ollama_endpoint
terraform output env_config
```

### 5. Configure Lambda Access

**⚠️ IMPORTANT**: Lambda needs VPC configuration to access EC2 Ollama instance.

**Two-step process:**

1. **After deploying Ollama**, get the security group ID:
   ```bash
   terraform output security_group_id
   ```

2. **Configure Lambda VPC** in `serverless.yml`:
   ```yaml
   vpc:
     securityGroupIds:
       - ${env:LAMBDA_SECURITY_GROUP_ID}  # Lambda's security group
     subnetIds:
       - ${env:LAMBDA_SUBNET_ID_1}
       - ${env:LAMBDA_SUBNET_ID_2}
   ```

3. **Update Terraform** to allow Lambda access:
   - Edit `terraform.tfvars`:
     ```hcl
     lambda_security_group_id = "sg-xxx"  # Lambda's security group ID
     ```
   - Apply: `terraform apply`

4. **Deploy Lambda with VPC**:
   ```bash
   export LAMBDA_SECURITY_GROUP_ID=sg-xxx
   export LAMBDA_SUBNET_ID_1=subnet-xxx
   export LAMBDA_SUBNET_ID_2=subnet-yyy
   npm run deploy:dev
   ```

**See `DEPLOYMENT_GUIDE.md` for detailed step-by-step instructions.**

### 6. Configure AI Search 2.0

Add to your `.env` file:
```bash
LLM_BASE_URL=http://<private-ip>:11434
LLM_MODEL=llama3.1:8b-instruct
```

## Cost Estimation

### GPU Instance (Recommended)
- **g4dn.xlarge**: ~$0.50/hour = ~$360/month (24/7)
- **g5.xlarge**: ~$1.00/hour = ~$720/month (24/7)

### CPU Instance (Budget Option)
- **t3.xlarge**: ~$0.17/hour = ~$122/month (24/7)
- **Note**: Much slower (10-30 seconds per query vs 2-5 seconds)

### Cost Optimization
- Use **Spot Instances** for dev/staging (60-90% savings)
- **Auto-stop** during off-hours (saves ~50% if running 12 hours/day)
- **Reserved Instances** for production (30-40% savings)

## Model Comparison

| Model | Size | Best For | Speed (GPU) | Speed (CPU) |
|-------|------|----------|-------------|-------------|
| `llama3.1:8b-instruct` | 8B | **Structured queries + conversation** | 2-5s | 10-30s |
| `qwen2.5:7b-instruct` | 7B | **Structured JSON extraction** | 2-4s | 8-25s |
| `mistral:7b-instruct` | 7B | General purpose | 2-4s | 8-25s |
| `llama3.2:3b` | 3B | Simple tasks (not recommended for SQL) | 1-2s | 5-15s |

## Verification

### Test Connection
```bash
# From Terraform output
curl http://<ollama-endpoint>/api/tags

# Should return list of available models including your model
```

### Test Model
```bash
curl http://<ollama-endpoint>/api/generate -d '{
  "model": "llama3.1:8b-instruct",
  "prompt": "Extract ticket search filters from: Find tickets under $200 in section 112",
  "stream": false
}'
```

## Troubleshooting

### Model Not Loading
- Check instance has enough disk space: `df -h`
- Check Ollama logs: `sudo journalctl -u ollama -f`
- Verify model: `ollama list`

### Slow Performance
- Ensure GPU instance type (g4dn.xlarge or better)
- Check GPU is detected: `nvidia-smi` (on GPU instances)
- Verify model is loaded: `ollama list`

### Connection Issues
- Verify security group allows port 11434 from Lambda/your IP
- Check VPC configuration matches Lambda VPC
- Test from EC2 instance: `curl http://localhost:11434/api/tags`

## Cleanup

```bash
terraform destroy  # Remove all infrastructure
```

**Note**: This will delete the EC2 instance and all data. Make sure you have backups if needed.

## Separate from jira-feature-documentor

This infrastructure is **completely separate** from the `jira-feature-documentor` Ollama instance. They can run independently:

- **jira-feature-documentor**: Uses its own Terraform in `jira-feature-documentor/deploy/terraform/`
- **ai-search-2.0**: Uses this Terraform in `ai-search-2.0/infrastructure/terraform/`

If you want to share the same Ollama instance (to save costs), you can:
1. Use the endpoint from jira-feature-documentor in your `.env`
2. Ensure Lambda security group has access to that instance's security group

