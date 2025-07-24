"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const migrate_1 = __importDefault(require("./database/migrate"));
// Import routes
const trades_1 = __importDefault(require("./routes/trades"));
const parties_1 = __importDefault(require("./routes/parties"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const receipts_1 = __importDefault(require("./routes/receipts"));
const counterparts_1 = __importDefault(require("./routes/counterparts"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const journal_1 = __importDefault(require("./routes/journal"));
const settlements_1 = __importDefault(require("./routes/settlements"));
const auth_1 = __importDefault(require("./routes/auth"));
// Import middleware
const auth_2 = require("./middleware/auth");
const app = (0, express_1.default)();
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
}
else {
    console.log('🔧 Running in development mode');
}
// Initialize database
(0, migrate_1.default)();
// Security and parsing middleware
app.use((0, helmet_1.default)());
// Configure CORS for production
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:3000', // Development
            'http://localhost:5173', // Vite dev server
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173'
        ];
        // Add production frontend URL if provided
        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(process.env.FRONTEND_URL);
        }
        // Allow requests with no origin (mobile apps, Postman, etc.) in development
        if (!origin && process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin || '')) {
            callback(null, true);
        }
        else {
            console.log('🚫 CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true // Enable cookies for authentication
};
app.use((0, cors_1.default)(corsOptions));
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)()); // Parse cookies for session management
// Optional authentication middleware for all routes
app.use(auth_2.optionalAuth);
// Auth routes (public)
app.use('/api/auth', auth_1.default);
// Public routes (no auth required for now - you can protect these later)
app.use('/api/trades', trades_1.default);
app.use('/api/parties', parties_1.default);
app.use('/api/accounts', accounts_1.default);
app.use('/api/receipts', receipts_1.default);
app.use('/api/counterparts', counterparts_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/journal', journal_1.default);
app.use('/api/settlements', settlements_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
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
//# sourceMappingURL=index.js.map