output "ollama_endpoint" {
  description = "Ollama endpoint URL to use in your application (.env: LLM_BASE_URL)"
  value       = "http://${aws_instance.ollama.private_ip}:11434"
}

output "ollama_private_ip" {
  description = "Private IP address of Ollama instance"
  value       = aws_instance.ollama.private_ip
}

output "ollama_instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.ollama.id
}

output "security_group_id" {
  description = "Security Group ID (for adding to Lambda VPC config)"
  value       = aws_security_group.ollama.id
}

output "vpc_id" {
  description = "VPC ID where Ollama is deployed"
  value       = data.aws_vpc.default.id
}

output "ollama_public_ip" {
  description = "Public IP address (if enabled)"
  value       = var.enable_public_ip ? aws_instance.ollama.public_ip : null
}

output "connection_command" {
  description = "Command to test connection from your local machine (if IP is allowed)"
  value       = "curl http://${aws_instance.ollama.private_ip}:11434/api/tags"
}

output "env_config" {
  description = "Environment variables to add to your .env file"
  value = <<-EOT
    # Add these to your .env file:
    LLM_BASE_URL=http://${aws_instance.ollama.private_ip}:11434
    LLM_MODEL=${var.ollama_model}
    
    # For Lambda VPC configuration (if needed):
    LAMBDA_SECURITY_GROUP_ID=${aws_security_group.ollama.id}
  EOT
}

