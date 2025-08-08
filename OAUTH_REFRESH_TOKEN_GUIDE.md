# Google Ads API - Refresh Token Generation Guide

## Step-by-Step Process to Generate Valid Refresh Token

### 1. Open Google OAuth2 Playground
Go to: https://developers.google.com/oauthplayground/

### 2. Configure OAuth2 Playground Settings
1. Click the **Settings** gear icon (top right)
2. Check **"Use your own OAuth credentials"**
3. Enter your credentials:
   - **OAuth Client ID**: `756901677789-lak300g2plkl57sdqn2ndvr005mp7tqm.apps.googleusercontent.com`
   - **OAuth Client Secret**: [Your client secret from Replit secrets]
4. Click **"Close"**

### 3. Select Google Ads API Scope
1. In the left panel, find **"Google Ads API v15"**
2. Select: `https://www.googleapis.com/auth/adwords`
3. Click **"Authorize APIs"**

### 4. Complete Authorization
1. You'll be redirected to Google's consent screen
2. Sign in with your Google Ads Manager account
3. Grant permissions for Google Ads API access
4. You'll be redirected back to OAuth Playground

### 5. Exchange Authorization Code
1. You should see an **Authorization Code** in Step 2
2. Click **"Exchange authorization code for tokens"**
3. This generates both **Access Token** and **Refresh Token**

### 6. Copy the Refresh Token
1. Copy the **Refresh Token** (long string starting with `1//`)
2. Update your Replit secret: `GOOGLE_ADS_REFRESH_TOKEN`

### 7. Test the Connection
Once you've updated the refresh token in Replit, Lane MCP will automatically:
- Connect to your Google Ads Manager account
- Sync all accessible customer accounts
- Enable live data for all 3 priority systems

## Expected Outcome

After updating the refresh token, you should see:
- Live Google Ads accounts appear in the client selector
- Real campaign data in the dashboards
- Active budget pacing with actual spend monitoring
- Issue detection working with live campaign health data

## Troubleshooting

If you still get "invalid_client" after updating the refresh token:
1. Verify the OAuth Client ID exactly matches what's in Google Cloud Console
2. Check that Google Ads API is enabled in your Google Cloud project
3. Ensure your OAuth consent screen includes the Google Ads API scope
4. Confirm the OAuth client is not in "Testing" mode (should be "Published")

## Security Note
The refresh token provides ongoing access to your Google Ads accounts. Keep it secure and never share it publicly.