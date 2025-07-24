import { Request, Response, NextFunction } from 'express';
import { User } from '../services/authService';
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
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to require superadmin role
 */
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Optional auth middleware - doesn't block if no auth provided
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map