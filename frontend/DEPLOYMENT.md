# Frontend Deployment Guide

## Environment Variables for Render

### Optional Variables
```
VITE_API_URL=https://your-backend-api.onrender.com
```

**Note:** If `VITE_API_URL` is not set, the frontend will use relative URLs, which works perfectly when both frontend and backend are on the same domain or when using Render's built-in service communication.

## Render Configuration

### Build Command
```
npm install && npm run build
```

### Publish Directory
```
dist
```

### Auto-Deploy
- Enable auto-deploy from your main branch
- Frontend will automatically rebuild when you push changes

## Deployment Strategy Options

### Option 1: Same Domain (Recommended)
Deploy both frontend and backend on Render and use Render's internal routing. No `VITE_API_URL` needed.

### Option 2: Separate Domains
If backend and frontend are on different domains:
1. Set `VITE_API_URL` to your backend service URL
2. Ensure CORS is properly configured in backend
3. Update `FRONTEND_URL` in backend environment variables

## Production Build Optimizations

The build is optimized with:
- ✅ Code splitting for vendor libraries
- ✅ Minification in production
- ✅ Source maps disabled in production
- ✅ Bundle analysis for optimal loading

## File Structure

```
dist/
├── index.html          # Main entry point
├── assets/
│   ├── vendor-*.js     # React, React Router
│   ├── utils-*.js      # Utilities (date-fns, etc.)
│   ├── pdf-*.js        # PDF generation libraries
│   └── index-*.js      # Main application code
└── ...
```

## Testing Production Build Locally

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

## Troubleshooting

### CORS Issues
- Ensure backend `FRONTEND_URL` matches your frontend domain
- Check browser console for CORS errors
- Verify authentication cookies are being sent

### API Connection Issues
- Check if `VITE_API_URL` is correctly set
- Verify backend service is running and accessible
- Test API endpoints directly (e.g., `/api/health`)

### Build Issues
- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check for TypeScript errors: `npm run lint`
- Verify all dependencies are in `package.json`

## Security Notes

- All API calls use relative URLs by default (secure)
- Authentication uses secure HTTP-only cookies
- No sensitive data is exposed in the frontend bundle
- HTTPS is enforced in production 