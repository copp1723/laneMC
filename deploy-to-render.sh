#!/bin/bash

# Lane MCP Platform - Render Deployment Script
# This script helps prepare your deployment to Render

echo "🚀 Lane MCP Platform - Render Deployment Preparation"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "✅ Project structure verified"

# Check for required files
required_files=("render.yaml" "package.json" "server/index.ts" "drizzle.config.ts")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: Required file $file not found"
        exit 1
    else
        echo "✅ $file found"
    fi
done

echo ""
echo "📋 Environment Variables Checklist"
echo "=================================="
echo "Make sure to set these in your Render dashboard:"
echo ""
echo "🔑 Essential Variables:"
echo "- DATABASE_URL (PostgreSQL connection string)"
echo "- NODE_ENV=production"
echo "- ENVIRONMENT=production"  
echo "- JWT_SECRET_KEY (secure random string)"
echo ""
echo "🤖 Google Ads API (for campaign management):"
echo "- GOOGLE_ADS_CLIENT_ID"
echo "- GOOGLE_ADS_CLIENT_SECRET"
echo "- GOOGLE_ADS_DEVELOPER_TOKEN"
echo "- GOOGLE_ADS_REFRESH_TOKEN"
echo "- GOOGLE_ADS_LOGIN_CUSTOMER_ID"
echo ""
echo "🧠 AI Integration (for chat functionality):"
echo "- OPENROUTER_API_KEY"
echo ""

# Test build locally
echo "🔨 Testing local build..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Build test successful"
else
    echo "❌ Build test failed. Please fix build errors before deploying."
    exit 1
fi

echo ""
echo "📊 Render Service Configuration:"
echo "==============================="
echo "Service Name: lane-mcp-platform"
echo "Environment: Node"
echo "Build Command: npm ci && npm run build"
echo "Start Command: npm start"
echo "Health Check: /api/health"
echo "Auto-Deploy: Enabled"
echo ""

echo "🎯 Next Steps:"
echo "=============="
echo "1. Push your code to GitHub repository"
echo "2. Create new Web Service on Render (render.com)"
echo "3. Connect your GitHub repository"
echo "4. Set all environment variables listed above"
echo "5. Deploy and monitor logs"
echo ""
echo "📚 For detailed instructions, see: RENDER_DEPLOYMENT.md"
echo "📋 For step-by-step checklist, see: RENDER_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "✨ Your Lane MCP platform is ready for production deployment!"