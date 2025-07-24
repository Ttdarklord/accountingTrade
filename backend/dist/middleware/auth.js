"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireSuperAdmin = exports.requireAuth = void 0;
const authService_1 = require("../services/authService");
/**
 * Middleware to require authentication
 */
const requireAuth = async (req, res, next) => {
    try {
        // Get session token from cookies or headers
        const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
        console.log('🔐 Auth middleware - Session token:', sessionToken ? 'Present' : 'Missing');
        console.log('🔐 Auth middleware - Cookies:', req.cookies);
        if (!sessionToken) {
            console.log('❌ No session token provided');
            return res.status(401).json({
                success: false,
                error: 'No session token provided'
            });
        }
        // Validate session
        const user = authService_1.AuthService.validateSession(sessionToken);
        console.log('🔐 Session validation result:', user ? `User: ${user.username}` : 'Invalid');
        if (!user) {
            console.log('❌ Invalid or expired session');
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session'
            });
        }
        // Update activity timestamp
        const isActive = await authService_1.AuthService.updateActivity(sessionToken);
        console.log('🔐 Activity update result:', isActive ? 'Success' : 'Failed');
        if (!isActive) {
            console.log('❌ Session timed out due to inactivity');
            return res.status(401).json({
                success: false,
                error: 'Session timed out due to inactivity'
            });
        }
        // Add user to request
        req.user = user;
        req.sessionToken = sessionToken;
        console.log('✅ Authentication successful for:', user.username);
        next();
    }
    catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};
exports.requireAuth = requireAuth;
/**
 * Middleware to require superadmin role
 */
const requireSuperAdmin = (req, res, next) => {
    // First run auth middleware
    (0, exports.requireAuth)(req, res, (err) => {
        if (err) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        // Check if user is superadmin
        if (!req.user || req.user.role !== 'superadmin') {
            console.log('❌ Superadmin access denied for user:', req.user?.username, 'Role:', req.user?.role);
            return res.status(403).json({
                success: false,
                error: 'Superadmin access required'
            });
        }
        console.log('✅ Superadmin access granted to:', req.user.username);
        next();
    });
};
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * Optional auth middleware - doesn't block if no auth provided
 */
const optionalAuth = async (req, res, next) => {
    try {
        const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
        if (sessionToken) {
            const user = authService_1.AuthService.validateSession(sessionToken);
            if (user) {
                await authService_1.AuthService.updateActivity(sessionToken);
                req.user = user;
                req.sessionToken = sessionToken;
            }
        }
        next();
    }
    catch (error) {
        // Don't block if optional auth fails
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map