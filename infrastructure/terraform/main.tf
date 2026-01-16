# Terraform configuration for Ollama EC2 deployment (AI Search 2.0)
# Optimized for structured queries, conversation, and web search
# Usage: terraform init && terraform plan && terraform apply

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# Get default VPC (or use existing VPC)
data "aws_vpc" "default" {
  default = var.use_default_vpc
  id      = var.vpc_id != "" ? var.vpc_id : null
}

# Get availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Create private subnet if not using default
resource "aws_subnet" "private" {
  count             = var.use_default_vpc ? 0 : 1
  vpc_id            = data.aws_vpc.default.id
  cidr_block        = var.private_subnet_cidr
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${var.project_name}-private-subnet"
  }
}

# Security Group for Ollama - Restrictive access
resource "aws_security_group" "ollama" {
  name        = "${var.project_name}-ollama-sg"
  description = "Security group for Ollama EC2 instance (AI Search 2.0)"
  vpc_id      = data.aws_vpc.default.id

  # Note: Lambda security group access is handled via separate aws_security_group_rule below

  # Allow inbound from specific IPs/CIDRs (for development/testing)
  dynamic "ingress" {
    for_each = var.allowed_cidr_blocks
    content {
      from_port   = 11434
      to_port     = 11434
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Ollama API access from ${ingress.value}"
    }
  }

  # Allow inbound from entire VPC CIDR (if Lambda is in same VPC but no SG specified)
  dynamic "ingress" {
    for_each = var.allow_vpc_cidr ? [data.aws_vpc.default.cidr_block] : []
    content {
      from_port   = 11434
      to_port     = 11434
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Ollama API access from VPC CIDR (${ingress.value})"
    }
  }

  # [DEPRECATED] Allow inbound from Lambda VPC CIDR (legacy support)
  dynamic "ingress" {
    for_each = var.lambda_vpc_cidr != "" ? [var.lambda_vpc_cidr] : []
    content {
      from_port   = 11434
      to_port     = 11434
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Ollama API access from Lambda VPC (legacy)"
    }
  }

  # SSH access (if enabled)
  dynamic "ingress" {
    for_each = var.enable_ssh_access ? var.ssh_allowed_cidr_blocks : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "SSH access from ${ingress.value}"
    }
  }

  # Allow outbound for model downloads
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound for model downloads"
  }

  tags = {
    Name = "${var.project_name}-ollama-sg"
  }
}

# Security Group Rule for Lambda access (if Lambda security group is specified)
resource "aws_security_group_rule" "lambda_ollama" {
  count = var.lambda_security_group_id != "" ? 1 : 0

  type                     = "ingress"
  from_port                = 11434
  to_port                  = 11434
  protocol                 = "tcp"
  source_security_group_id = var.lambda_security_group_id
  security_group_id        = aws_security_group.ollama.id
  description              = "Ollama API access from Lambda security group"
}

# IAM Role for EC2 instance
resource "aws_iam_role" "ollama_ec2" {
  name = "${var.project_name}-ollama-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ollama-ec2-role"
  }
}

# Attach SSM policy for Systems Manager access (optional, for log viewing)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ollama_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach basic EC2 instance profile
resource "aws_iam_instance_profile" "ollama_ec2" {
  name = "${var.project_name}-ollama-ec2-profile"
  role = aws_iam_role.ollama_ec2.name
}

# Get default subnets if using default VPC
data "aws_subnets" "default" {
  count = var.use_default_vpc ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance for Ollama
resource "aws_instance" "ollama" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.use_default_vpc ? (length(data.aws_subnets.default) > 0 && length(data.aws_subnets.default[0].ids) > 0 ? data.aws_subnets.default[0].ids[1] : null) : (length(aws_subnet.private) > 0 ? aws_subnet.private[0].id : null)
  vpc_security_group_ids = [aws_security_group.ollama.id]
  iam_instance_profile   = aws_iam_instance_profile.ollama_ec2.name
  
  # Security: Public IP only if explicitly enabled (default: false for security)
  associate_public_ip_address = var.enable_public_ip

  user_data = templatefile("${path.module}/../ec2-user-data.sh", {
    OLLAMA_MODEL = var.ollama_model
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = var.volume_size
    encrypted   = true
  }

  tags = {
    Name        = "${var.project_name}-ollama"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "AI Search 2.0 - Structured Queries + Conversation"
  }
}

# Outputs are defined in outputs.tf

