#!/bin/bash

# Development restart script for Dreamscapes
# Quick restart of services during development

SERVICE=${1:-""}

if [ -z "$SERVICE" ]; then
    echo "🔄 Restarting all services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart
else
    echo "🔄 Restarting service: $SERVICE"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart "$SERVICE"
fi

echo "✅ Restart complete!"