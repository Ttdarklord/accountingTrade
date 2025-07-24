import { Request, Response, NextFunction } from 'express';
import { AuthService, User } from '../services/authService';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

/**
 * Middleware to require authentication
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get session token from cookies or headers
    const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'] as string;
    
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
    const user = AuthService.validateSession(sessionToken);
    console.log('🔐 Session validation result:', user ? `User: ${user.username}` : 'Invalid');
    
    if (!user) {
      console.log('❌ Invalid or expired session');
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }

    // Update activity timestamp
    const isActive = await AuthService.updateActivity(sessionToken);
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
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Middleware to require superadmin role
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  // First run auth middleware
  requireAuth(req, res, (err) => {
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

/**
 * Optional auth middleware - doesn't block if no auth provided
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'] as string;
    
    if (sessionToken) {
      const user = AuthService.validateSession(sessionToken);
      if (user) {
        await AuthService.updateActivity(sessionToken);
        req.user = user;
        req.sessionToken = sessionToken;
      }
    }
    
    next();
  } catch (error) {
    // Don't block if optional auth fails
    next();
  }
}; 