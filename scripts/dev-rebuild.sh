#!/bin/bash

# Development rebuild script for Dreamscapes
# Rebuild and restart specific services during development

SERVICE=${1:-""}

if [ -z "$SERVICE" ]; then
    echo "🔨 Rebuilding all services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
else
    echo "🔨 Rebuilding service: $SERVICE"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build "$SERVICE"
fi

echo "✅ Rebuild complete!"