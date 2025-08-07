# Render Deployment Guide - Lane MCP Platform

## Prerequisites
1. **Render Account**: Sign up at render.com
2. **PostgreSQL Database**: Set up a PostgreSQL instance (Render or external)
3. **GitHub Repository**: Your code should be in a GitHub repository
4. **Google Ads API Credentials**: Obtained from Google Cloud Console
5. **OpenRouter API Key**: For AI chat functionality

## Step 1: Database Setup

### Option A: Render PostgreSQL (Recommended)
1. Go to your Render dashboard
2. Click "New +" → "PostgreSQL"
3. Choose a name: `lane-mcp-database`
4. Select plan (Free tier available)
5. Copy the **External Database URL** for later

### Option B: External PostgreSQL
Use your existing PostgreSQL database connection string.

## Step 2: Deploy Application

### 2.1 Connect Repository
1. Go to Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Choose the repository containing this code

### 2.2 Configure Build Settings
- **Environment**: Node
- **Build Command**: `npm ci && npm run build && npm run db:push`
- **Start Command**: `npm start`
- **Auto-Deploy**: Yes (recommended)

### 2.3 Environment Variables
Set these in Render dashboard under "Environment":

**Required Database**
```
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
ENVIRONMENT=production
```

**Required Authentication**
```
JWT_SECRET_KEY=your-super-secure-random-string-here
```

**Required Google Ads API**
```
GOOGLE_ADS_CLIENT_ID=your-google-client-id
GOOGLE_ADS_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your-login-customer-id
```

**Required AI Integration**
```
OPENROUTER_API_KEY=your-openrouter-api-key
```

## Step 3: Domain Configuration (Optional)

### 3.1 Custom Domain
1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain: `yourdomain.com`
4. Follow DNS configuration instructions

### 3.2 Google OAuth Setup
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Credentials"
3. Edit your OAuth 2.0 client
4. Add authorized redirect URIs:
   ```
   https://your-render-app.onrender.com/auth/google/callback
   https://yourdomain.com/auth/google/callback (if using custom domain)
   ```

## Step 4: Database Migration

The database schema will be automatically created during deployment via `npm run db:push`.

If you need to run migrations manually:
1. Go to your service shell in Render
2. Run: `npm run db:push`

## Step 5: Health Check

Your app includes a health check endpoint at `/api/health`. Render will automatically use this to verify deployment.

## Step 6: Production Verification

After deployment, test these endpoints:
1. **Health Check**: `https://your-app.onrender.com/api/health`
2. **Login**: `https://your-app.onrender.com/api/auth/login`
3. **Dashboard**: `https://your-app.onrender.com/`

## Performance Optimization

### 3.1 Render Plan Recommendations
- **Starter Plan**: For testing and small deployments
- **Standard Plan**: For production with moderate traffic
- **Pro Plan**: For high-traffic agency use

### 3.2 Database Performance
- Enable connection pooling (automatically handled by our code)
- Consider upgrading PostgreSQL plan for better performance
- Set up database backups in Render

## Monitoring & Logs

### View Logs
1. Go to your service dashboard
2. Click "Logs" tab
3. Monitor for any errors or issues

### Key Metrics to Monitor
- Response times
- Memory usage
- Database connections
- Google Ads API rate limits

## Security Considerations

1. **Environment Variables**: Never commit secrets to repository
2. **HTTPS**: Automatically provided by Render
3. **Database**: Use connection pooling and prepared statements
4. **API Keys**: Rotate regularly and monitor usage

## Troubleshooting

### Common Issues
1. **Build Fails**: Check Node.js version compatibility
2. **Database Connection**: Verify DATABASE_URL format
3. **Google Ads API**: Confirm all credentials are set
4. **Memory Issues**: Upgrade to higher Render plan

### Debug Steps
1. Check build logs for errors
2. Verify all environment variables are set
3. Test database connectivity
4. Confirm Google Ads API credentials

## Scaling for Agency Use

### Multi-Client Setup
- Each client gets their own Google Ads account connection
- Database partitioning by account ID
- Role-based access control

### Performance Scaling
- Horizontal scaling with multiple service instances
- Database read replicas for analytics
- CDN for static assets (if needed)

## Maintenance

### Regular Tasks
1. **Weekly**: Monitor performance metrics
2. **Monthly**: Review Google Ads API usage
3. **Quarterly**: Update dependencies and security patches

### Backup Strategy
- Render PostgreSQL automatic backups
- Export campaign data regularly
- Test restore procedures

Your Lane MCP platform is now production-ready on Render with enterprise-grade Google Ads automation capabilities!