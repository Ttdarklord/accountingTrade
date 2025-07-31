import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import runMigrations from './database/migrate';

// Import routes
import tradesRouter from './routes/trades';
import partiesRouter from './routes/parties';
import accountsRouter from './routes/accounts';
import receiptsRouter from './routes/receipts';
import counterpartsRouter from './routes/counterparts';
import dashboardRouter from './routes/dashboard';
import journalRouter from './routes/journal';
import settlementsRouter from './routes/settlements';
import authRouter from './routes/auth';
import notificationsRouter from './routes/notifications';

// Import middleware
import { optionalAuth } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5001;

// Environment validation
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 Running in production mode');
  
  // Warn about missing critical environment variables
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET not set in production!');
  }
  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️  WARNING: FRONTEND_URL not set - CORS may not work properly!');
  }
} else {
  console.log('🔧 Running in development mode');
}

// Initialize database
runMigrations();

// Security and parsing middleware
app.use(helmet());

// Configure CORS for production
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = [
      'http://localhost:3000', // Development
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

    // Add production frontend URL if provided
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
      console.log('✅ Added frontend URL to CORS:', process.env.FRONTEND_URL);
    }

    console.log('🔍 CORS check - Origin:', origin);
    console.log('🔍 CORS check - Allowed origins:', allowedOrigins);
    console.log('🔍 CORS check - Environment:', process.env.NODE_ENV);

    // Allow requests with no origin (mobile apps, Postman, direct API calls, etc.)
    // This is common and safe for APIs that will be accessed directly
    if (!origin) {
      console.log('✅ CORS allowing request with no origin');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      console.log('🚫 CORS allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Enable cookies for authentication
};

app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies for session management

// Optional authentication middleware for all routes
app.use(optionalAuth);

// Auth routes (public)
app.use('/api/auth', authRouter);

// Public routes (no auth required for now - you can protect these later)
app.use('/api/trades', tradesRouter);
app.use('/api/parties', partiesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/counterparts', counterpartsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/journal', journalRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/notifications', notificationsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      error: 'Database constraint violation',
      details: err.message
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Agrivex Currency Trading API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 