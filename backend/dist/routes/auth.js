"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Rate limiting for login attempts
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    message: {
        success: false,
        error: 'Too many login attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Rate limiting for user creation
const createUserLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 user creations per hour per IP
    message: {
        success: false,
        error: 'Too many user creation attempts. Please try again later.'
    }
});
/**
 * POST /api/auth/login - User login
 */
router.post('/login', loginLimiter, [
    (0, express_validator_1.body)('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
    (0, express_validator_1.body)('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { username, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        console.log('🔐 Login attempt for username:', username);
        console.log('🔐 IP Address:', ipAddress);
        // Attempt login
        const loginResult = await authService_1.AuthService.login(username, password, ipAddress, userAgent);
        console.log('✅ Login successful for:', loginResult.user.username);
        console.log('🔐 Session token created:', loginResult.sessionToken);
        // Set session cookie
        res.cookie('sessionToken', loginResult.sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/'
        });
        console.log('🍪 Session cookie set with token');
        console.log('🍪 Cookie settings:', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        res.json({
            success: true,
            data: {
                user: loginResult.user,
                accessToken: loginResult.accessToken
            },
            message: 'Login successful'
        });
    }
    catch (error) {
        console.error('❌ Login error:', error);
        res.status(401).json({
            success: false,
            error: error instanceof Error ? error.message : 'Login failed'
        });
    }
});
/**
 * POST /api/auth/logout - User logout
 */
router.post('/logout', auth_1.requireAuth, async (req, res) => {
    try {
        const sessionToken = req.sessionToken;
        const user = req.user;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        await authService_1.AuthService.logout(sessionToken, user.id, user.username, ipAddress);
        // Clear session cookie
        res.clearCookie('sessionToken');
        res.json({
            success: true,
            message: 'Logout successful'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});
/**
 * GET /api/auth/me - Get current user info
 */
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});
/**
 * GET /api/auth/users - Get all users (superadmin only)
 */
router.get('/users', auth_1.requireSuperAdmin, (req, res) => {
    try {
        const users = authService_1.AuthService.getAllUsers();
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});
/**
 * POST /api/auth/users - Create new user (superadmin only)
 */
router.post('/users', auth_1.requireSuperAdmin, createUserLimiter, [
    (0, express_validator_1.body)('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    (0, express_validator_1.body)('first_name').optional().trim().isLength({ max: 100 }).withMessage('First name too long'),
    (0, express_validator_1.body)('last_name').optional().trim().isLength({ max: 100 }).withMessage('Last name too long'),
    (0, express_validator_1.body)('role').optional().isIn(['regular', 'superadmin']).withMessage('Invalid role')
], async (req, res) => {
    try {
        console.log('🔐 Create user request body:', req.body);
        // Check validation errors
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            console.log('❌ User creation validation failed:', errors.array());
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const userData = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            role: req.body.role || 'regular'
        };
        console.log('🔐 Creating user with data:', { ...userData, password: '[REDACTED]' });
        const user = await authService_1.AuthService.createUser(userData, req.user.id);
        // Log user creation
        await authService_1.AuthService.logActivity(req.user.id, req.user.username, 'USER_CREATED', 'user_management', `Created user: ${user.username}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', true);
        console.log('✅ User created successfully:', user.username);
        res.status(201).json({
            success: true,
            data: user,
            message: 'User created successfully'
        });
    }
    catch (error) {
        console.error('❌ Create user error:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create user'
        });
    }
});
/**
 * PUT /api/auth/users/:id/password - Update user password (superadmin only)
 */
router.put('/users/:id/password', auth_1.requireSuperAdmin, [
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const userId = parseInt(req.params.id);
        const { password } = req.body;
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }
        // Get user info for logging
        const targetUser = authService_1.AuthService.getUserById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        await authService_1.AuthService.updateUserPassword(userId, password);
        // Log password change
        await authService_1.AuthService.logActivity(req.user.id, req.user.username, 'PASSWORD_RESET', 'user_management', `Reset password for user: ${targetUser.username}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', true);
        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    }
    catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update password'
        });
    }
});
/**
 * PUT /api/auth/users/:id/toggle - Toggle user active status (superadmin only)
 */
router.put('/users/:id/toggle', auth_1.requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }
        // Prevent superadmin from deactivating themselves
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot deactivate your own account'
            });
        }
        // Get user info for logging
        const targetUser = authService_1.AuthService.getUserById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        authService_1.AuthService.toggleUserStatus(userId);
        // Log status change
        await authService_1.AuthService.logActivity(req.user.id, req.user.username, 'USER_STATUS_CHANGED', 'user_management', `${targetUser.is_active ? 'Deactivated' : 'Activated'} user: ${targetUser.username}`, req.ip || 'unknown', req.get('User-Agent') || 'unknown', true);
        res.json({
            success: true,
            message: `User ${targetUser.is_active ? 'deactivated' : 'activated'} successfully`
        });
    }
    catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle user status'
        });
    }
});
/**
 * GET /api/auth/activity-logs - Get activity logs (superadmin only)
 */
router.get('/activity-logs', auth_1.requireSuperAdmin, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = authService_1.AuthService.getActivityLogs(Math.min(limit, 500)); // Max 500 logs
        res.json({
            success: true,
            data: logs
        });
    }
    catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity logs'
        });
    }
});
/**
 * POST /api/auth/cleanup-sessions - Clean up expired sessions (superadmin only)
 */
router.post('/cleanup-sessions', auth_1.requireSuperAdmin, (req, res) => {
    try {
        authService_1.AuthService.cleanupExpiredSessions();
        res.json({
            success: true,
            message: 'Expired sessions cleaned up successfully'
        });
    }
    catch (error) {
        console.error('Cleanup sessions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup sessions'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map