#!/bin/bash

# Development setup script for Dreamscapes
# This script sets up the development environment with optimized settings

set -e

echo "🚀 Setting up Dreamscapes development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ Please edit .env file with your API keys before continuing."
fi

# Build development images with caching
echo "🔨 Building development Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel

# Start services in development mode
echo "🚀 Starting services in development mode..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout=300  # 5 minutes timeout
elapsed=0
interval=5

while [ $elapsed -lt $timeout ]; do
    if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps | grep -q "unhealthy\|starting"; then
        echo "⏳ Services still starting... (${elapsed}s elapsed)"
        sleep $interval
        elapsed=$((elapsed + interval))
    else
        echo "✅ All services are healthy!"
        break
    fi
done

if [ $elapsed -ge $timeout ]; then
    echo "❌ Timeout waiting for services to be healthy. Check logs with:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs"
    exit 1
fi

# Show service status
echo "📊 Service Status:"
docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Express API: http://localhost:8000"
echo "🌐 MCP Gateway: http://localhost:8080"
echo "🦙 Llama Stylist: http://localhost:8002"
echo "🎬 Render Worker: http://localhost:8001"
echo ""
echo "📝 Useful commands:"
echo "   View logs: docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f [service]"
echo "   Restart service: docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart [service]"
echo "   Stop all: docker-compose -f docker-compose.yml -f docker-compose.dev.yml down"
echo "   Rebuild service: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build [service]"