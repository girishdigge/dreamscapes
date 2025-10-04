#!/bin/bash

# Development logs script for Dreamscapes
# Easy way to view logs for development services

SERVICE=${1:-""}

if [ -z "$SERVICE" ]; then
    echo "📊 Showing logs for all services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f --tail=50
else
    echo "📊 Showing logs for service: $SERVICE"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f --tail=50 "$SERVICE"
fi