# 🚀 Complete Render Deployment Guide

This guide will help you deploy your Agrivex Currency Trading Application to Render.

## 📋 Prerequisites

1. ✅ GitHub repository with your code
2. ✅ Render account (free tier available)
3. ✅ Code prepared for production (already done!)

## 🔧 Deployment Architecture

You'll deploy two services:
- **Backend API** (Web Service) - Handles data, authentication, and business logic
- **Frontend** (Static Site) - React application served as static files

## 🎯 Step-by-Step Deployment

### Phase 1: Deploy Backend API

#### 1. Create Backend Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository from the list

#### 2. Configure Backend Service
- **Name**: `agrivex-backend` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm run start:prod`

#### 3. Set Backend Environment Variables
Click **"Advanced"** and add these environment variables:

```
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-here-64-chars-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here-64-chars-long
SESSION_TIMEOUT=7200000
BCRYPT_ROUNDS=12
LOGIN_RATE_LIMIT=5
CREATE_USER_RATE_LIMIT=3
DATABASE_PATH=/opt/render/project/data/agrivex.db
```

⚠️ **Important Database Note**: The current setup uses SQLite with local file storage. On Render's free tier, the file system is ephemeral, meaning data will be lost when the service restarts or goes to sleep. For production use, consider upgrading to a paid plan with persistent volumes or use an external database service.

**🔐 Generate Secure Secrets:**
```bash
# Generate JWT secrets (run these commands locally)
openssl rand -base64 64  # Use for JWT_SECRET
openssl rand -base64 64  # Use for JWT_REFRESH_SECRET
```

#### 4. Deploy Backend
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://your-backend-name.onrender.com`

### Phase 2: Deploy Frontend

#### 1. Create Frontend Service
1. Back to Render Dashboard
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository
4. Select your repository

#### 2. Configure Frontend Service
- **Name**: `agrivex-frontend` (or your preferred name)
- **Branch**: `main`
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

#### 3. Set Frontend Environment Variables (Optional)
If you want to use a separate domain for your API:
```
VITE_API_URL=https://your-backend-name.onrender.com
```

**💡 Recommended:** Leave this empty to use relative URLs (same domain routing).

#### 4. Deploy Frontend
1. Click **"Create Static Site"**
2. Wait for deployment (3-5 minutes)
3. Note your frontend URL: `https://your-frontend-name.onrender.com`

### Phase 3: Final Configuration

#### 1. Update Backend CORS
1. Go to your backend service in Render
2. Add this environment variable:
```
FRONTEND_URL=https://your-frontend-name.onrender.com
```
3. Your backend will automatically redeploy

#### 2. Test Your Application
1. Visit your frontend URL
2. Try logging in with:
   - Username: `yasinnajibi`
   - Password: `Rasool1-Najibi2-Kheirandish3` 
3. Test creating a new user (superadmin functionality)
4. Verify all features work correctly

## 🔍 Monitoring & Maintenance

### Health Checks
- Backend health: `https://your-backend-name.onrender.com/api/health`
- Frontend: Should load your application

### Logs
- **Backend logs**: Backend service → Logs tab
- **Build logs**: Each service → Events tab

### Auto-Deploy
Both services will automatically redeploy when you push to your main branch.

## 🛠️ Troubleshooting

### Common Issues

#### Backend Won't Start
1. Check logs for errors
2. Verify all environment variables are set
3. Ensure `start:prod` script exists in package.json

#### Frontend Build Fails
1. Check if all dependencies are in package.json
2. Run `npm run build` locally to test
3. Verify Node.js version compatibility

#### CORS Errors
1. Ensure `FRONTEND_URL` is set in backend
2. Check browser console for specific errors
3. Verify both services are using HTTPS

#### Authentication Issues
1. Check if cookies are being sent
2. Verify JWT secrets are set
3. Test login endpoint directly

#### Database Issues
1. **Data Loss on Free Tier**: If data disappears between sessions, this is because Render's free tier uses ephemeral storage
   - **Solution 1**: Upgrade to Render's paid plan ($7/month) for persistent disk storage
   - **Solution 2**: Use an external database service like PostgreSQL or MySQL
   - **Temporary workaround**: Accept data loss as limitation of free tier
2. Initial admin user is created on first start
3. Check backend logs for migration errors
4. Verify DATABASE_PATH environment variable is set correctly

## 📱 Production Features

Your deployed app includes:
- ✅ Secure authentication with 2-hour session timeout
- ✅ User management (superadmin can create users)
- ✅ Complete trading and settlement system
- ✅ PDF and CSV export functionality
- ✅ Real-time filtering and search
- ✅ Responsive design for mobile/desktop
- ✅ Automatic database migrations
- ✅ Rate limiting and security headers

## 🔧 Updates & Maintenance

### Deploying Updates
1. Push changes to your main branch
2. Services auto-deploy (watch the logs)
3. Test functionality after deployment

### Database Persistence & Backup

**🚨 Critical Information for Free Tier Users:**
- **Free Tier Limitation**: Render's free tier uses ephemeral storage - data will be lost when the service sleeps (after 15 minutes of inactivity) or restarts
- **Paid Tier**: Upgrade to paid plan ($7/month) for persistent disk storage where data survives restarts
- **External Database**: For true production use, consider using external PostgreSQL or MySQL services

**For Free Tier:**
- Accept data loss as a limitation
- Use primarily for testing and development
- Data will reset each time the service goes to sleep

**For Paid Tier:**
- SQLite database persists on Render's disk
- Consider periodic exports for critical data
- Database survives service restarts

### Environment Updates
- Update environment variables through Render dashboard
- Service will redeploy automatically

## 💰 Cost Estimation

**Free Tier:**
- Backend: $0/month (512MB RAM, sleeps after 15min inactivity)
- Frontend: $0/month (100GB bandwidth)

**Paid Tier (if needed):**
- Backend: $7/month (always-on, better performance)
- Frontend: Always free for static sites

## 🎉 You're Done!

Your Agrivex Currency Trading Application is now live in production! 

- 🌐 **Frontend**: `https://your-frontend-name.onrender.com`
- 🔗 **API**: `https://your-backend-name.onrender.com`

Share your live application URL and start trading! 📈 