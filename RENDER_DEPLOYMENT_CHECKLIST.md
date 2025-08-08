# Render Deployment Checklist - Lane MCP Platform

## ✅ Pre-Deployment Checklist

### 📋 Repository Setup
- [ ] Code pushed to GitHub repository
- [ ] All sensitive data removed from code (no hardcoded secrets)
- [ ] `.env` files are gitignored
- [ ] `render.yaml` configuration file present
- [ ] Build and start scripts configured in `package.json`

### 🗄️ Database Setup
- [ ] PostgreSQL database created on Render or external provider
- [ ] Database URL obtained
- [ ] Database schema will be created automatically via `npm run db:push`

### 🔑 Environment Variables Required
Copy these into Render dashboard under "Environment" tab:

**Essential Variables:**
```bash
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
ENVIRONMENT=production
JWT_SECRET_KEY=your-super-secure-random-string-here
```

**Google Ads API (Required for campaign management):**
```bash
GOOGLE_ADS_CLIENT_ID=your-google-client-id
GOOGLE_ADS_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your-login-customer-id
```

**AI Integration (Required for chat):**
```bash
OPENROUTER_API_KEY=your-openrouter-api-key
```

### 🚀 Render Service Configuration
- [ ] Service Name: `lane-mcp-platform`
- [ ] Environment: `Node`
- [ ] Build Command: `npm ci && npm run build`
- [ ] Start Command: `npm start`
- [ ] Auto-Deploy: Enabled
- [ ] Health Check Path: `/api/health`

## 🎯 Deployment Steps

### 1. Create New Web Service
1. Go to Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository with this code

### 2. Configure Service
**Basic Settings:**
- Name: `lane-mcp-platform`
- Environment: `Node`
- Region: Choose closest to your users
- Branch: `main` (or your default branch)

**Build & Deploy:**
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Auto-Deploy: Yes

### 3. Set Environment Variables
Go to "Environment" tab and add all variables from the checklist above.

### 4. Deploy
Click "Create Web Service" and monitor the deployment logs.

## 🔍 Post-Deployment Verification

### Test These Endpoints:
- [ ] **Health Check:** `https://your-app.onrender.com/api/health`
- [ ] **Frontend:** `https://your-app.onrender.com/`
- [ ] **Login:** Test user authentication
- [ ] **Chat:** Verify AI chat functionality
- [ ] **Google Ads:** Test account connection (if credentials provided)

### Monitor Deployment:
- [ ] Check deployment logs for errors
- [ ] Verify all environment variables are set
- [ ] Test database connectivity
- [ ] Confirm application starts successfully

## 🛠️ Troubleshooting

### Common Issues:
1. **Build Fails:** Check Node.js version and dependencies
2. **Environment Variables:** Ensure all required vars are set
3. **Database Connection:** Verify DATABASE_URL format
4. **Memory Issues:** Upgrade to Standard plan if needed

### Debug Commands:
```bash
# Check logs in Render dashboard
# Verify environment variables are loaded
# Test database connection manually
```

## 📊 Performance Recommendations

### Render Plan Selection:
- **Starter ($7/month):** Development/testing
- **Standard ($25/month):** Production (recommended)
- **Pro ($85/month):** High-traffic agency use

### Database:
- **Free Tier:** Development only
- **Starter ($7/month):** Small production
- **Standard ($20/month):** Recommended for agencies

## 🔐 Security Checklist
- [ ] All secrets in environment variables
- [ ] HTTPS enabled (automatic on Render)
- [ ] Database connection pooling enabled
- [ ] JWT secret is secure random string
- [ ] Google OAuth redirect URIs updated

## 🎉 Success Criteria
Your deployment is successful when:
- ✅ Application loads without errors
- ✅ User can login/register
- ✅ Chat interface responds to messages
- ✅ Google Ads accounts can be connected
- ✅ Database operations work correctly
- ✅ All automation features function properly

## 📞 Support
If you encounter issues:
1. Check Render deployment logs
2. Verify all environment variables
3. Test locally with production environment variables
4. Contact Render support if infrastructure issues persist

Your Lane MCP platform is ready for production deployment! 🚀