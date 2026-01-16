variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS profile to use (from ~/.aws/credentials)"
  type        = string
  default     = "sitix-INT"  # Update to your AWS profile
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ai-search-2-0-ollama"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type for Ollama. Recommended: g4dn.xlarge (GPU) for structured queries + conversation"
  type        = string
  default     = "g4dn.xlarge"  # GPU instance with NVIDIA T4 (16GB VRAM) - optimal for llama3.1:8b
}

variable "volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 50
}

variable "ollama_model" {
  description = "Ollama model to pull and use. Recommended: llama3.1:8b-instruct for structured queries + conversation"
  type        = string
  default     = "llama3.1:8b-instruct"  # Best balance for structured queries + conversation
}

variable "use_default_vpc" {
  description = "Use default VPC instead of creating new one"
  type        = bool
  default     = true
}

variable "vpc_id" {
  description = "VPC ID to use (if not using default)"
  type        = string
  default     = ""
}

variable "private_subnet_cidr" {
  description = "CIDR block for private subnet (if creating new VPC)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access Ollama"
  type        = list(string)
  default     = []  # Add your IP ranges here, e.g., ["1.2.3.4/32", "10.0.0.0/16"]
}

variable "lambda_security_group_id" {
  description = "Security Group ID of Lambda function (recommended for Lambda access)"
  type        = string
  default     = ""  # e.g., "sg-0123456789abcdef0"
}

variable "allow_vpc_cidr" {
  description = "Allow access from entire VPC CIDR (if Lambda is in same VPC but no SG specified)"
  type        = bool
  default     = false  # Set to true if Lambda doesn't have a dedicated security group
}

variable "lambda_vpc_cidr" {
  description = "[DEPRECATED] Use lambda_security_group_id instead. CIDR block of Lambda VPC (if using Lambda without security groups)"
  type        = string
  default     = ""  # e.g., "10.0.0.0/16"
}

variable "ami_id" {
  description = "Custom AMI ID (leave empty to use latest Amazon Linux 2023)"
  type        = string
  default     = ""
}

variable "enable_public_ip" {
  description = "Enable public IP address for SSH access (less secure)"
  type        = bool
  default     = false
}

variable "enable_ssh_access" {
  description = "Enable SSH access in security group (requires enable_public_ip or VPN/bastion)"
  type        = bool
  default     = false
}

variable "ssh_allowed_cidr_blocks" {
  description = "CIDR blocks allowed to SSH (only used if enable_ssh_access is true)"
  type        = list(string)
  default     = []  # e.g., ["1.2.3.4/32"]
}

