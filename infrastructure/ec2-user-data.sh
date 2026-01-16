#!/bin/bash
# EC2 User Data Script - Install and Configure Ollama
# Optimized for structured queries, conversation, and web search
# This script runs when the EC2 instance first launches

set -e

echo "=== Ollama EC2 Setup (AI Search 2.0) ==="

# Update system
sudo yum update -y

# Install NVIDIA drivers and CUDA (for GPU instances)
if [[ $(curl -s http://169.254.169.254/latest/meta-data/instance-type | grep -E 'g[4-9]|p[2-4]') ]]; then
    echo "Detected GPU instance - installing NVIDIA drivers..."
    # Amazon Linux 2023 with GPU support
    sudo yum install -y kernel-devel-$(uname -r) kernel-headers-$(uname -r)
    # NVIDIA drivers are pre-installed on GPU AMIs, but we ensure they're available
fi

# Install Docker (required for Ollama)
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the model (optimized for structured queries + conversation)
MODEL_NAME="${OLLAMA_MODEL}"
if [ -z "$MODEL_NAME" ]; then
    MODEL_NAME="llama3.1:8b-instruct"  # Default: best for structured queries
fi
echo "Pulling model: $MODEL_NAME"
echo "This may take 5-10 minutes depending on model size..."
ollama pull "$MODEL_NAME"

# Configure Ollama to listen on all interfaces (will be secured by Security Group)
# Create systemd service for Ollama
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service (AI Search 2.0)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"
# Optimize for structured queries and conversation
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=1"

[Install]
WantedBy=multi-user.target
EOF

# Enable and start Ollama service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 15

# Verify Ollama is running
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is running successfully"
        echo "Model: $MODEL_NAME"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting for Ollama... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 5
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Ollama failed to start after $MAX_RETRIES retries"
    exit 1
fi

# Verify model is loaded
echo "Verifying model is available..."
if ollama list | grep -q "$MODEL_NAME"; then
    echo "✅ Model $MODEL_NAME is available"
else
    echo "⚠️  Model $MODEL_NAME not found in list"
fi

# Create a simple health check script
sudo tee /usr/local/bin/ollama-healthcheck.sh > /dev/null <<'HEALTHCHECK'
#!/bin/bash
curl -f http://localhost:11434/api/tags > /dev/null 2>&1
HEALTHCHECK
sudo chmod +x /usr/local/bin/ollama-healthcheck.sh

echo "=== Setup Complete ==="
echo "Ollama is running on port 11434"
echo "Model: $MODEL_NAME"
echo "Access from Security Group allowed IPs only"
echo ""
echo "Test from Lambda or allowed IP:"
echo "  curl http://$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4):11434/api/tags"

