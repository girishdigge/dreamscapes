#!/bin/bash

echo "🔧 Applying Docker Volume Fix..."
echo ""

# Step 1: Restart frontend container
echo "Step 1: Restarting frontend container..."
docker compose restart frontend

echo ""
echo "Waiting for container to start..."
sleep 5

# Step 2: Verify volume mount
echo ""
echo "Step 2: Verifying volume mount..."
echo "Files in /app/sample_dreams:"
docker compose exec frontend ls /app/sample_dreams

# Step 3: Test API route
echo ""
echo "Step 3: Testing API route..."
echo "Fetching star_collision.json..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/sample-dreams/star_collision.json)

if [ "$response" = "200" ]; then
  echo "✅ API route working! (HTTP $response)"
else
  echo "❌ API route failed (HTTP $response)"
  echo ""
  echo "Checking logs..."
  docker compose logs --tail=20 frontend
fi

# Step 4: Summary
echo ""
echo "=========================================="
echo "Fix Applied!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click any sample dream in 'Try These Cinematic Dreams'"
echo "3. Scene should load without 404 errors"
echo ""
echo "To view logs:"
echo "  docker compose logs -f frontend"
echo ""
echo "To verify files:"
echo "  docker compose exec frontend ls -la /app/sample_dreams"
echo ""
