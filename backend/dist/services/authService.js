"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const connection_1 = __importDefault(require("../database/connection"));
class AuthService {
    /**
     * Hash password with bcrypt
     */
    static async hashPassword(password) {
        return bcryptjs_1.default.hash(password, 12);
    }
    /**
     * Validate password against hash
     */
    static async validatePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    /**
     * Generate access token (short-lived)
     */
    static generateAccessToken(userId, username, role) {
        return jsonwebtoken_1.default.sign({ userId, username, role, type: 'access' }, this.JWT_SECRET, { expiresIn: this.ACCESS_TOKEN_EXPIRY });
    }
    /**
     * Generate refresh token (long-lived)
     */
    static generateRefreshToken(userId) {
        return jsonwebtoken_1.default.sign({ userId, type: 'refresh' }, this.JWT_REFRESH_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRY });
    }
    /**
     * Verify access token
     */
    static verifyAccessToken(token) {
        return jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
    }
    /**
     * Verify refresh token
     */
    static verifyRefreshToken(token) {
        return jsonwebtoken_1.default.verify(token, this.JWT_REFRESH_SECRET);
    }
    /**
     * Get user by username
     */
    static getUserByUsername(username) {
        const user = connection_1.default.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      WHERE username = ? AND is_active = 1
    `).get(username);
        if (!user)
            return null;
        return {
            ...user,
            is_active: Boolean(user.is_active)
        };
    }
    /**
     * Get user by ID
     */
    static getUserById(id) {
        const user = connection_1.default.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      WHERE id = ? AND is_active = 1
    `).get(id);
        if (!user)
            return null;
        return {
            ...user,
            is_active: Boolean(user.is_active)
        };
    }
    /**
     * Get user with password hash (for authentication)
     */
    static getUserWithPassword(username) {
        return connection_1.default.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             password_hash, failed_login_attempts, locked_until,
             last_login_at, last_activity_at, created_at
      FROM users 
      WHERE username = ?
    `).get(username);
    }
    /**
     * Authenticate user and create session
     */
    static async login(username, password, ipAddress, userAgent) {
        const user = this.getUserWithPassword(username);
        if (!user) {
            await this.logActivity(null, username, 'LOGIN_FAILED', 'authentication', 'User not found', ipAddress, userAgent, false);
            throw new Error('Invalid credentials');
        }
        // Check if account is locked
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            await this.logActivity(user.id, username, 'LOGIN_BLOCKED', 'authentication', 'Account locked', ipAddress, userAgent, false);
            throw new Error('Account temporarily locked due to failed login attempts');
        }
        // Check if account is active
        if (!user.is_active) {
            await this.logActivity(user.id, username, 'LOGIN_FAILED', 'authentication', 'Account inactive', ipAddress, userAgent, false);
            throw new Error('Account is inactive');
        }
        // Validate password
        const isValidPassword = await this.validatePassword(password, user.password_hash);
        if (!isValidPassword) {
            await this.incrementFailedAttempts(username);
            await this.logActivity(user.id, username, 'LOGIN_FAILED', 'authentication', 'Invalid password', ipAddress, userAgent, false);
            throw new Error('Invalid credentials');
        }
        // Reset failed attempts on successful login
        await this.resetFailedAttempts(username);
        // Generate tokens
        const accessToken = this.generateAccessToken(user.id, user.username, user.role);
        const refreshToken = this.generateRefreshToken(user.id);
        const sessionToken = (0, uuid_1.v4)();
        // Create session
        await this.createSession(user.id, sessionToken, refreshToken, ipAddress, userAgent);
        // Update last login
        await this.updateLastLogin(user.id);
        // Log successful login
        await this.logActivity(user.id, username, 'LOGIN_SUCCESS', 'authentication', 'Successful login', ipAddress, userAgent, true);
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            is_active: user.is_active,
            last_login_at: user.last_login_at,
            last_activity_at: user.last_activity_at,
            created_at: user.created_at
        };
        return {
            user: userResponse,
            accessToken,
            refreshToken,
            sessionToken
        };
    }
    /**
     * Logout user and invalidate session
     */
    static async logout(sessionToken, userId, username, ipAddress) {
        // Delete session
        connection_1.default.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
        // Log logout
        await this.logActivity(userId, username, 'LOGOUT', 'authentication', 'User logged out', ipAddress, '', true);
    }
    /**
     * Create user session
     */
    static async createSession(userId, sessionToken, refreshToken, ipAddress, userAgent) {
        console.log('🔐 Creating session for user ID:', userId);
        console.log('🔐 Session token:', sessionToken);
        const refreshTokenHash = await this.hashPassword(refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const now = new Date().toISOString();
        console.log('🔐 Session expires at:', expiresAt.toISOString());
        console.log('🔐 Session created at:', now);
        try {
            const result = connection_1.default.prepare(`
        INSERT INTO user_sessions 
        (user_id, session_token, refresh_token_hash, device_info, ip_address, expires_at, last_activity_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, sessionToken, refreshTokenHash, userAgent, ipAddress, expiresAt.toISOString(), now, now);
            console.log('✅ Session created in database with ID:', result.lastInsertRowid);
        }
        catch (error) {
            console.error('❌ Failed to create session in database:', error);
            throw error;
        }
    }
    /**
     * Update user activity timestamp
     */
    static async updateActivity(sessionToken) {
        const now = new Date();
        const nowISO = now.toISOString();
        console.log('🔄 Updating activity for session token');
        // First check if session exists
        const existingSession = connection_1.default.prepare(`
      SELECT user_id, last_activity_at, expires_at FROM user_sessions 
      WHERE session_token = ?
    `).get(sessionToken);
        if (!existingSession) {
            console.log('❌ No session found for activity update');
            return false;
        }
        console.log('🔄 Existing session found for user:', existingSession.user_id);
        console.log('🔄 Session expires at:', existingSession.expires_at);
        // Check if session has expired
        if (existingSession.expires_at < nowISO) {
            console.log('❌ Session has expired, deleting');
            connection_1.default.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
            return false;
        }
        const result = connection_1.default.prepare(`
      UPDATE user_sessions 
      SET last_activity_at = ? 
      WHERE session_token = ?
    `).run(nowISO, sessionToken);
        console.log('🔄 Activity update query result:', result.changes);
        // Check for session timeout (2 hours)
        const lastActivity = new Date(existingSession.last_activity_at);
        const timeDiff = now.getTime() - lastActivity.getTime();
        console.log('🔄 Time since last activity (ms):', timeDiff);
        console.log('🔄 Session timeout threshold (ms):', this.SESSION_TIMEOUT);
        if (timeDiff > this.SESSION_TIMEOUT) {
            // Session timed out
            console.log('⏰ Session timed out, deleting');
            connection_1.default.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
            return false;
        }
        // Update user's last activity
        if (result.changes > 0) {
            connection_1.default.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?').run(nowISO, existingSession.user_id);
            console.log('✅ User activity updated for user ID:', existingSession.user_id);
        }
        return result.changes > 0;
    }
    /**
     * Validate session token
     */
    static validateSession(sessionToken) {
        console.log('🔍 Validating session token');
        // First, let's find the session without timestamp filtering to debug
        const debugSession = connection_1.default.prepare(`
      SELECT s.expires_at, s.last_activity_at, u.username, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ?
    `).get(sessionToken);
        console.log('🔍 Debug session info:', debugSession);
        if (!debugSession) {
            console.log('❌ No session found for token');
            return null;
        }
        const now = new Date();
        const nowISO = now.toISOString();
        console.log('🔍 Current time:', nowISO);
        console.log('🔍 Session expires at:', debugSession.expires_at);
        console.log('🔍 Session last activity:', debugSession.last_activity_at);
        // Check if session has expired
        if (debugSession.expires_at < nowISO) {
            console.log('❌ Session has expired');
            connection_1.default.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
            return null;
        }
        // Check if user is active
        if (!debugSession.is_active) {
            console.log('❌ User is not active');
            return null;
        }
        const session = connection_1.default.prepare(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, 
             u.is_active, u.last_login_at, u.last_activity_at, u.created_at,
             s.last_activity_at as session_activity
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ?
    `).get(sessionToken);
        if (!session) {
            console.log('❌ Session data not found');
            return null;
        }
        // Fix timestamp parsing - handle both SQLite and ISO formats
        let lastActivity;
        try {
            // If it contains 'T', it's likely ISO format
            if (session.session_activity.includes('T')) {
                lastActivity = new Date(session.session_activity);
            }
            else {
                // SQLite format - assume UTC and convert
                lastActivity = new Date(session.session_activity + ' UTC');
            }
        }
        catch (error) {
            console.log('❌ Error parsing timestamp:', session.session_activity);
            // Fallback to current time to prevent errors
            lastActivity = new Date();
        }
        const timeDiff = now.getTime() - lastActivity.getTime();
        console.log('🔍 Time since last session activity (ms):', timeDiff);
        console.log('🔍 Session timeout threshold (ms):', this.SESSION_TIMEOUT);
        console.log('🔍 Parsed last activity:', lastActivity.toISOString());
        if (timeDiff > this.SESSION_TIMEOUT) {
            // Session timed out, delete it
            console.log('⏰ Session validation: Session timed out, deleting');
            connection_1.default.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
            return null;
        }
        const user = {
            id: session.id,
            username: session.username,
            email: session.email,
            first_name: session.first_name,
            last_name: session.last_name,
            role: session.role,
            is_active: Boolean(session.is_active),
            last_login_at: session.last_login_at,
            last_activity_at: session.last_activity_at,
            created_at: session.created_at
        };
        console.log('✅ Session validation successful for user:', user.username, 'Role:', user.role);
        return user;
    }
    /**
     * Create new user (superadmin only)
     */
    static async createUser(userData, createdBy) {
        // Check if username already exists
        const existingUser = connection_1.default.prepare('SELECT id FROM users WHERE username = ?').get(userData.username);
        if (existingUser) {
            throw new Error('Username already exists');
        }
        // Check if email already exists (if provided)
        if (userData.email) {
            const existingEmail = connection_1.default.prepare('SELECT id FROM users WHERE email = ?').get(userData.email);
            if (existingEmail) {
                throw new Error('Email already exists');
            }
        }
        const passwordHash = await this.hashPassword(userData.password);
        const result = connection_1.default.prepare(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userData.username, userData.email || null, passwordHash, userData.first_name || null, userData.last_name || null, userData.role || 'regular', createdBy);
        const user = this.getUserById(result.lastInsertRowid);
        if (!user) {
            throw new Error('Failed to create user');
        }
        return user;
    }
    /**
     * Get all users (superadmin only)
     */
    static getAllUsers() {
        const users = connection_1.default.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      ORDER BY created_at DESC
    `).all();
        // Convert SQLite boolean integers to JavaScript booleans
        return users.map(user => ({
            ...user,
            is_active: Boolean(user.is_active)
        }));
    }
    /**
     * Update user password (superadmin only)
     */
    static async updateUserPassword(userId, newPassword) {
        const passwordHash = await this.hashPassword(newPassword);
        const now = new Date().toISOString();
        connection_1.default.prepare(`
      UPDATE users 
      SET password_hash = ?, password_changed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, now, now, userId);
        // Invalidate all sessions for this user
        connection_1.default.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
    }
    /**
     * Toggle user active status
     */
    static toggleUserStatus(userId) {
        const now = new Date().toISOString();
        connection_1.default.prepare(`
      UPDATE users 
      SET is_active = NOT is_active, updated_at = ?
      WHERE id = ?
    `).run(now, userId);
        // If deactivating, remove all sessions
        const user = connection_1.default.prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
        if (!user?.is_active) {
            connection_1.default.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
        }
    }
    /**
     * Increment failed login attempts
     */
    static async incrementFailedAttempts(username) {
        const user = connection_1.default.prepare(`
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE 
            WHEN failed_login_attempts >= 4 THEN datetime('now', '+30 minutes')
            ELSE locked_until
          END
      WHERE username = ?
    `).run(username);
    }
    /**
     * Reset failed login attempts
     */
    static async resetFailedAttempts(username) {
        connection_1.default.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE username = ?
    `).run(username);
    }
    /**
     * Update last login timestamp
     */
    static async updateLastLogin(userId) {
        const now = new Date().toISOString();
        connection_1.default.prepare(`
      UPDATE users 
      SET last_login_at = ?, last_activity_at = ?
      WHERE id = ?
    `).run(now, now, userId);
    }
    /**
     * Log user activity
     */
    static async logActivity(userId, username, action, resource, details, ipAddress, userAgent, success) {
        connection_1.default.prepare(`
      INSERT INTO user_activity_log 
      (user_id, username, action, resource, details, ip_address, user_agent, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, action, resource, details, ipAddress, userAgent, success ? 1 : 0);
    }
    /**
     * Get activity logs (superadmin only)
     */
    static getActivityLogs(limit = 100) {
        return connection_1.default.prepare(`
      SELECT * FROM user_activity_log 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
    }
    /**
     * Clean up expired sessions
     */
    static cleanupExpiredSessions() {
        connection_1.default.prepare('DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP').run();
    }
}
exports.AuthService = AuthService;
AuthService.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
AuthService.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
AuthService.ACCESS_TOKEN_EXPIRY = '15m';
AuthService.REFRESH_TOKEN_EXPIRY = '7d';
AuthService.SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
//# sourceMappingURL=authService.js.map