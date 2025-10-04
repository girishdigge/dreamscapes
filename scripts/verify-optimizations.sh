#!/bin/bash

# Verification script for build and development optimizations
# Tests all implemented optimizations to ensure they work correctly

set -e

echo "🔍 Verifying Dreamscapes Build and Development Optimizations"
echo "============================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
total_tests=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    total_tests=$((total_tests + 1))
    echo -e "\n${YELLOW}Test $total_tests: $test_name${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        success_count=$((success_count + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Test 1: Docker Compose configurations are valid
run_test "Docker Compose Dev Configuration" \
    "docker-compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet"

run_test "Docker Compose Prod Configuration" \
    "docker-compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet"

# Test 2: .dockerignore files exist
run_test "Frontend .dockerignore exists" \
    "test -f services/frontend/next-app/.dockerignore"

run_test "Express .dockerignore exists" \
    "test -f services/express/.dockerignore"

run_test "MCP Gateway .dockerignore exists" \
    "test -f services/mcp-gateway/.dockerignore"

run_test "Render Worker .dockerignore exists" \
    "test -f services/render-worker/.dockerignore"

run_test "Llama Stylist .dockerignore exists" \
    "test -f services/llama-stylist/.dockerignore"

# Test 3: Multi-stage Dockerfiles contain required stages
run_test "Frontend Dockerfile has multi-stage build" \
    "grep -q 'FROM.*AS development' services/frontend/next-app/Dockerfile"

run_test "Express Dockerfile has multi-stage build" \
    "grep -q 'FROM.*AS development' services/express/Dockerfile"

run_test "MCP Gateway Dockerfile has multi-stage build" \
    "grep -q 'FROM.*AS development' services/mcp-gateway/Dockerfile"

run_test "Render Worker Dockerfile has multi-stage build" \
    "grep -q 'FROM.*AS development' services/render-worker/Dockerfile"

run_test "Llama Stylist Dockerfile has multi-stage build" \
    "grep -q 'FROM.*AS development' services/llama-stylist/Dockerfile"

# Test 4: Development scripts exist and are executable
run_test "Dev setup script exists and is executable" \
    "test -x scripts/dev-setup.sh"

run_test "Dev logs script exists and is executable" \
    "test -x scripts/dev-logs.sh"

run_test "Dev restart script exists and is executable" \
    "test -x scripts/dev-restart.sh"

run_test "Dev rebuild script exists and is executable" \
    "test -x scripts/dev-rebuild.sh"

# Test 5: Performance monitoring script exists
run_test "Performance monitoring script exists" \
    "test -f scripts/monitor-performance.js"

# Test 6: Documentation exists
run_test "Build optimization guide exists" \
    "test -f BUILD_OPTIMIZATION_GUIDE.md"

# Test 7: Docker Compose overrides have volume mounts for development
run_test "Dev config has volume mounts for hot reload" \
    "grep -q 'volumes:' docker-compose.dev.yml"

run_test "Prod config has resource limits" \
    "grep -q 'resources:' docker-compose.prod.yml"

# Test 8: Environment optimizations
run_test "Dev config has faster health checks" \
    "grep -q 'interval: 15s' docker-compose.dev.yml"

run_test "Frontend dev config has turbopack and polling" \
    "grep -q 'WATCHPACK_POLLING=true' docker-compose.dev.yml"

# Test 9: Build context optimization
run_test "Frontend .dockerignore excludes node_modules" \
    "grep -q 'node_modules' services/frontend/next-app/.dockerignore"

run_test "Python .dockerignore excludes __pycache__" \
    "grep -q '__pycache__' services/llama-stylist/.dockerignore"

# Test 10: Multi-stage build optimization
run_test "Dockerfiles use npm ci for faster installs" \
    "grep -q 'npm ci' services/frontend/next-app/Dockerfile"

# Summary
echo -e "\n============================================================"
echo -e "📊 ${YELLOW}Optimization Verification Summary${NC}"
echo -e "============================================================"

if [ $success_count -eq $total_tests ]; then
    echo -e "${GREEN}🎉 All optimizations verified successfully!${NC}"
    echo -e "${GREEN}✅ $success_count/$total_tests tests passed${NC}"
    
    echo -e "\n${YELLOW}🚀 Ready for optimized development:${NC}"
    echo "   ./scripts/dev-setup.sh    # Start development environment"
    echo "   ./scripts/dev-logs.sh     # View service logs"
    echo "   node scripts/monitor-performance.js  # Monitor performance"
    
    exit 0
else
    failed_tests=$((total_tests - success_count))
    echo -e "${RED}❌ Some optimizations need attention${NC}"
    echo -e "${RED}✅ $success_count/$total_tests tests passed${NC}"
    echo -e "${RED}❌ $failed_tests tests failed${NC}"
    
    echo -e "\n${YELLOW}Please check the failed tests above and ensure all files are properly created.${NC}"
    exit 1
fi