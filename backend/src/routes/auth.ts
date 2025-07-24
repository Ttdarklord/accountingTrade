import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { AuthService, CreateUserRequest } from '../services/authService';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
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
const createUserLimiter = rateLimit({
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
  body('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
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
    const loginResult = await AuthService.login(username, password, ipAddress, userAgent);

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

  } catch (error) {
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
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionToken = req.sessionToken!;
    const user = req.user!;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    await AuthService.logout(sessionToken, user.id, user.username, ipAddress);

    // Clear session cookie
    res.clearCookie('sessionToken');

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
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
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: req.user
  });
});

/**
 * GET /api/auth/users - Get all users (superadmin only)
 */
router.get('/users', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const users = AuthService.getAllUsers();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
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
router.post('/users', requireSuperAdmin, createUserLimiter, [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').optional().trim().isLength({ max: 100 }).withMessage('First name too long'),
  body('last_name').optional().trim().isLength({ max: 100 }).withMessage('Last name too long'),
  body('role').optional().isIn(['regular', 'superadmin']).withMessage('Invalid role')
], async (req: Request, res: Response) => {
  try {
    console.log('🔐 Create user request body:', req.body);
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ User creation validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userData: CreateUserRequest = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      role: req.body.role || 'regular'
    };

    console.log('🔐 Creating user with data:', { ...userData, password: '[REDACTED]' });

    const user = await AuthService.createUser(userData, req.user!.id);

    // Log user creation
    await AuthService.logActivity(
      req.user!.id,
      req.user!.username,
      'USER_CREATED',
      'user_management',
      `Created user: ${user.username}`,
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      true
    );

    console.log('✅ User created successfully:', user.username);

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    });

  } catch (error) {
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
router.put('/users/:id/password', requireSuperAdmin, [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
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
    const targetUser = AuthService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await AuthService.updateUserPassword(userId, password);

    // Log password change
    await AuthService.logActivity(
      req.user!.id,
      req.user!.username,
      'PASSWORD_RESET',
      'user_management',
      `Reset password for user: ${targetUser.username}`,
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      true
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
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
router.put('/users/:id/toggle', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Prevent superadmin from deactivating themselves
    if (userId === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
    }

    // Get user info for logging
    const targetUser = AuthService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    AuthService.toggleUserStatus(userId);

    // Log status change
    await AuthService.logActivity(
      req.user!.id,
      req.user!.username,
      'USER_STATUS_CHANGED',
      'user_management',
      `${targetUser.is_active ? 'Deactivated' : 'Activated'} user: ${targetUser.username}`,
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      true
    );

    res.json({
      success: true,
      message: `User ${targetUser.is_active ? 'deactivated' : 'activated'} successfully`
    });

  } catch (error) {
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
router.get('/activity-logs', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = AuthService.getActivityLogs(Math.min(limit, 500)); // Max 500 logs
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
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
router.post('/cleanup-sessions', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    AuthService.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: 'Expired sessions cleaned up successfully'
    });
  } catch (error) {
    console.error('Cleanup sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup sessions'
    });
  }
});

export default router; 