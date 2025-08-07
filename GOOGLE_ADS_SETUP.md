# Google Ads API Setup Guide

## Current Status
✅ **Environment Variables Configured**
✅ **Production Database Connected** 
✅ **Application Ready for Live Data**
⚠️ **OAuth Client Setup Required**

## Issue Identified
The OAuth client error indicates the Google Cloud Console OAuth configuration needs completion:

```
Error: 'invalid_client' - The OAuth client was not found.
```

## Next Steps Required

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client IDs**
5. Configure:
   - Application type: **Web application**
   - Name: **Lane MCP Google Ads Integration**
   - Authorized JavaScript origins: `https://your-replit-domain.replit.app`
   - Authorized redirect URIs: `https://your-replit-domain.replit.app/auth/google/callback`

### 2. Enable Required APIs
1. Go to **APIs & Services > Library**
2. Enable these APIs:
   - **Google Ads API**
   - **Google OAuth2 API**

### 3. OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Configure:
   - User Type: **External** (for production) or **Internal** (for testing)
   - Application name: **Lane MCP**
   - Scopes: Add `https://www.googleapis.com/auth/adwords`

### 4. Verify Credentials
Current credentials format should be:
- Client ID: `756901677789-lak300g2plkl57sdqn2ndvr005mp7tqm.apps.googleusercontent.com`
- Client Secret: `GOCSPX-*****`
- Developer Token: `T3WOJXJ3JgRJ1Wg-1wd4Kg`

## Testing Live Connection

Once OAuth is properly configured, the platform will:
1. **Auto-sync accounts** from your Google Ads manager account
2. **Fetch real campaign data** and performance metrics
3. **Enable live budget management** and optimization
4. **Provide AI-powered insights** based on actual data

## Fallback Mode

Until OAuth is resolved, the platform operates in development mode with:
- Simulated account structure
- Mock campaign data  
- Full UI functionality for testing
- All features except live Google Ads connection

The application architecture is production-ready and will seamlessly switch to live data once OAuth is configured.