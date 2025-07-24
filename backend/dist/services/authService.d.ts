export interface User {
    id: number;
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    role: 'superadmin' | 'regular';
    is_active: boolean;
    last_login_at?: string;
    last_activity_at?: string;
    created_at: string;
}
export interface CreateUserRequest {
    username: string;
    email?: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: 'regular' | 'superadmin';
}
export interface LoginResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    sessionToken: string;
}
export declare class AuthService {
    private static readonly JWT_SECRET;
    private static readonly JWT_REFRESH_SECRET;
    private static readonly ACCESS_TOKEN_EXPIRY;
    private static readonly REFRESH_TOKEN_EXPIRY;
    private static readonly SESSION_TIMEOUT;
    /**
     * Hash password with bcrypt
     */
    static hashPassword(password: string): Promise<string>;
    /**
     * Validate password against hash
     */
    static validatePassword(password: string, hash: string): Promise<boolean>;
    /**
     * Generate access token (short-lived)
     */
    static generateAccessToken(userId: number, username: string, role: string): string;
    /**
     * Generate refresh token (long-lived)
     */
    static generateRefreshToken(userId: number): string;
    /**
     * Verify access token
     */
    static verifyAccessToken(token: string): any;
    /**
     * Verify refresh token
     */
    static verifyRefreshToken(token: string): any;
    /**
     * Get user by username
     */
    static getUserByUsername(username: string): User | null;
    /**
     * Get user by ID
     */
    static getUserById(id: number): User | null;
    /**
     * Get user with password hash (for authentication)
     */
    static getUserWithPassword(username: string): any;
    /**
     * Authenticate user and create session
     */
    static login(username: string, password: string, ipAddress: string, userAgent: string): Promise<LoginResponse>;
    /**
     * Logout user and invalidate session
     */
    static logout(sessionToken: string, userId: number, username: string, ipAddress: string): Promise<void>;
    /**
     * Create user session
     */
    static createSession(userId: number, sessionToken: string, refreshToken: string, ipAddress: string, userAgent: string): Promise<void>;
    /**
     * Update user activity timestamp
     */
    static updateActivity(sessionToken: string): Promise<boolean>;
    /**
     * Validate session token
     */
    static validateSession(sessionToken: string): User | null;
    /**
     * Create new user (superadmin only)
     */
    static createUser(userData: CreateUserRequest, createdBy: number): Promise<User>;
    /**
     * Get all users (superadmin only)
     */
    static getAllUsers(): User[];
    /**
     * Update user password (superadmin only)
     */
    static updateUserPassword(userId: number, newPassword: string): Promise<void>;
    /**
     * Toggle user active status
     */
    static toggleUserStatus(userId: number): void;
    /**
     * Increment failed login attempts
     */
    private static incrementFailedAttempts;
    /**
     * Reset failed login attempts
     */
    private static resetFailedAttempts;
    /**
     * Update last login timestamp
     */
    private static updateLastLogin;
    /**
     * Log user activity
     */
    static logActivity(userId: number | null, username: string, action: string, resource: string, details: string, ipAddress: string, userAgent: string, success: boolean): Promise<void>;
    /**
     * Get activity logs (superadmin only)
     */
    static getActivityLogs(limit?: number): any[];
    /**
     * Clean up expired sessions
     */
    static cleanupExpiredSessions(): void;
}
//# sourceMappingURL=authService.d.ts.map