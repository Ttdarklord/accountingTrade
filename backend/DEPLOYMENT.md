# Backend Deployment Guide

## Environment Variables for Render

Set the following environment variables in your Render service:

### Required Variables
```
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-frontend-app.onrender.com
```

### Authentication & Security
```
JWT_SECRET=your-super-secure-jwt-secret-key-here-change-this-in-production
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-here-change-this-in-production
SESSION_TIMEOUT=7200000
BCRYPT_ROUNDS=12
```

### Rate Limiting
```
LOGIN_RATE_LIMIT=5
CREATE_USER_RATE_LIMIT=3
```

### Database
```
DATABASE_PATH=./data/database.db
```

## Render Configuration

### Build Command
```
npm install
```

### Start Command
```
npm run start:prod
```

### Auto-Deploy
- Enable auto-deploy from your main branch
- Database migrations and initial user setup will run automatically

## Production Checklist

1. ✅ Set all environment variables in Render dashboard
2. ✅ Update FRONTEND_URL to match your frontend Render URL
3. ✅ Generate secure JWT secrets (use a tool like `openssl rand -base64 64`)
4. ✅ Verify auto-deploy is working
5. ✅ Test authentication and user creation
6. ✅ Check logs for any errors

## Security Notes

- JWT secrets should be cryptographically secure random strings
- Database is SQLite and will persist on Render's disk storage
- CORS is configured to only allow requests from your frontend URL
- All sensitive operations require authentication
- Rate limiting is enabled for login and user creation 