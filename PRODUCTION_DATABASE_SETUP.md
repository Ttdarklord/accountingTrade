# 🚨 **CRITICAL: Production Database Setup Guide**

## ⚠️ **CURRENT ISSUE: Database Loss on Deployments**

Your current setup stores the SQLite database in the container's local file system. **This means ALL DATA IS LOST when Render redeploys your app** (which happens on every git push).

## 🎯 **IMMEDIATE SOLUTIONS**

### **Option 1: Render Persistent Disk (Recommended - $7/month)**

1. **Upgrade to Render Paid Plan** ($7/month)
2. **Add Persistent Disk** to your backend service:
   - Go to your backend service in Render Dashboard
   - Navigate to "Disks" tab
   - Click "Add Disk"
   - Mount path: `/opt/render/project/data`
   - Size: 1GB (more than enough)
3. **Update Environment Variable:**
   ```
   DATABASE_PATH=/opt/render/project/data/agrivex.db
   ```

### **Option 2: External Database (Most Reliable)**

#### **PostgreSQL with Render:**
1. Create a PostgreSQL database on Render (free tier available)
2. Update your app to use PostgreSQL instead of SQLite
3. Cost: Free tier or $7/month for production

#### **External Database Services:**
- **Supabase** (PostgreSQL with real-time features) - Free tier
- **PlanetScale** (MySQL-compatible) - Free tier  
- **Neon** (PostgreSQL) - Free tier
- **Railway** (PostgreSQL) - Free tier

### **Option 3: Accept Data Loss (Development Only)**

Keep current setup but understand:
- ✅ Good for: Testing, demos, development
- ❌ Bad for: Any production use or important data
- 🔄 Data resets: Every deployment, service restart, or sleep

## 🔧 **CURRENT SAFETY MEASURES IMPLEMENTED**

### **Production-Safe Migrations:**
- ✅ Simple migration system for production deployments
- ✅ No hanging operations in production
- ✅ Graceful error handling to prevent deployment failures
- ✅ Environment detection (development vs production)

### **Database Initialization:**
```typescript
// Development: Full migrations with complex operations
// Production: Simple, safe migrations only
if (process.env.NODE_ENV === 'production') {
  runSimpleMigrations(); // Won't hang deployments
} else {
  runMigrations(); // Full feature development
}
```

## 📋 **DEPLOYMENT ENVIRONMENT VARIABLES**

### **For Persistent Storage (Option 1):**
```env
NODE_ENV=production
DATABASE_PATH=/opt/render/project/data/agrivex.db
JWT_SECRET=your-super-secure-jwt-secret-here-64-chars-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here-64-chars-long
SESSION_TIMEOUT=7200000
BCRYPT_ROUNDS=12
LOGIN_RATE_LIMIT=5
CREATE_USER_RATE_LIMIT=3
FRONTEND_URL=https://your-frontend-name.onrender.com
```

### **For External Database (Option 2):**
```env
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:port/database
# (remove DATABASE_PATH when using external DB)
JWT_SECRET=your-super-secure-jwt-secret-here-64-chars-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here-64-chars-long
SESSION_TIMEOUT=7200000
BCRYPT_ROUNDS=12
LOGIN_RATE_LIMIT=5
CREATE_USER_RATE_LIMIT=3
FRONTEND_URL=https://your-frontend-name.onrender.com
```

## 🛡️ **DATA BACKUP RECOMMENDATIONS**

Even with persistent storage, always backup your data:

### **Automated Backup Script:**
```bash
# Daily backup to external storage
sqlite3 /path/to/agrivex.db ".backup backup-$(date +%Y%m%d).db"
```

### **Manual Export:**
```sql
-- Export all data to SQL file
.output backup.sql
.dump
```

## 🚀 **MIGRATION PLAN**

### **Immediate (Fix Hanging Deployments):**
1. ✅ Deploy current code with production-safe migrations
2. ✅ Backend will now deploy without hanging
3. ⚠️ Data still ephemeral (will reset on redeploy)

### **Next Steps (Persistent Storage):**
1. **Choose your option** (Persistent Disk vs External Database)
2. **Configure storage** following the appropriate guide above
3. **Update environment variables** in Render dashboard
4. **Test deployment** with a small amount of test data
5. **Migrate production data** once confirmed working

## 📞 **IMPLEMENTATION SUPPORT**

Need help implementing any of these solutions? The following are ready to implement:

1. **Persistent Disk Setup** - Just upgrade Render plan and update env vars
2. **PostgreSQL Migration** - Requires code changes to database layer
3. **External Database Integration** - Requires service setup and code changes

Choose your preferred approach and I can provide detailed implementation steps.

---

**🎯 Priority: Fix hanging deployments first (current code), then implement persistent storage for data safety.** 