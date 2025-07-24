import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection';

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

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  /**
   * Hash password with bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Validate password against hash
   */
  static async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(userId: number, username: string, role: string): string {
    return jwt.sign(
      { userId, username, role, type: 'access' },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate refresh token (long-lived)
   */
  static generateRefreshToken(userId: number): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): any {
    return jwt.verify(token, this.JWT_SECRET);
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): any {
    return jwt.verify(token, this.JWT_REFRESH_SECRET);
  }

  /**
   * Get user by username
   */
  static getUserByUsername(username: string): User | null {
    const user = db.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      WHERE username = ? AND is_active = 1
    `).get(username) as any | undefined;
    
    if (!user) return null;
    
    return {
      ...user,
      is_active: Boolean(user.is_active)
    } as User;
  }

  /**
   * Get user by ID
   */
  static getUserById(id: number): User | null {
    const user = db.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      WHERE id = ? AND is_active = 1
    `).get(id) as any | undefined;
    
    if (!user) return null;
    
    return {
      ...user,
      is_active: Boolean(user.is_active)
    } as User;
  }

  /**
   * Get user with password hash (for authentication)
   */
  static getUserWithPassword(username: string): any {
    return db.prepare(`
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
  static async login(username: string, password: string, ipAddress: string, userAgent: string): Promise<LoginResponse> {
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
    const sessionToken = uuidv4();

    // Create session
    await this.createSession(user.id, sessionToken, refreshToken, ipAddress, userAgent);

    // Update last login
    await this.updateLastLogin(user.id);

    // Log successful login
    await this.logActivity(user.id, username, 'LOGIN_SUCCESS', 'authentication', 'Successful login', ipAddress, userAgent, true);

    const userResponse: User = {
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
  static async logout(sessionToken: string, userId: number, username: string, ipAddress: string): Promise<void> {
    // Delete session
    db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
    
    // Log logout
    await this.logActivity(userId, username, 'LOGOUT', 'authentication', 'User logged out', ipAddress, '', true);
  }

  /**
   * Create user session
   */
  static async createSession(userId: number, sessionToken: string, refreshToken: string, ipAddress: string, userAgent: string): Promise<void> {
    console.log('🔐 Creating session for user ID:', userId);
    console.log('🔐 Session token:', sessionToken);
    
    const refreshTokenHash = await this.hashPassword(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const now = new Date().toISOString();

    console.log('🔐 Session expires at:', expiresAt.toISOString());
    console.log('🔐 Session created at:', now);

    try {
      const result = db.prepare(`
        INSERT INTO user_sessions 
        (user_id, session_token, refresh_token_hash, device_info, ip_address, expires_at, last_activity_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, sessionToken, refreshTokenHash, userAgent, ipAddress, expiresAt.toISOString(), now, now);

      console.log('✅ Session created in database with ID:', result.lastInsertRowid);
    } catch (error) {
      console.error('❌ Failed to create session in database:', error);
      throw error;
    }
  }

  /**
   * Update user activity timestamp
   */
  static async updateActivity(sessionToken: string): Promise<boolean> {
    const now = new Date();
    const nowISO = now.toISOString();
    console.log('🔄 Updating activity for session token');
    
    // First check if session exists
    const existingSession = db.prepare(`
      SELECT user_id, last_activity_at, expires_at FROM user_sessions 
      WHERE session_token = ?
    `).get(sessionToken) as any;

    if (!existingSession) {
      console.log('❌ No session found for activity update');
      return false;
    }

    console.log('🔄 Existing session found for user:', existingSession.user_id);
    console.log('🔄 Session expires at:', existingSession.expires_at);
    
    // Check if session has expired
    if (existingSession.expires_at < nowISO) {
      console.log('❌ Session has expired, deleting');
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
      return false;
    }
    
    const result = db.prepare(`
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
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
      return false;
    }

    // Update user's last activity
    if (result.changes > 0) {
      db.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?').run(nowISO, existingSession.user_id);
      console.log('✅ User activity updated for user ID:', existingSession.user_id);
    }

    return result.changes > 0;
  }

  /**
   * Validate session token
   */
  static validateSession(sessionToken: string): User | null {
    console.log('🔍 Validating session token');
    
    // First, let's find the session without timestamp filtering to debug
    const debugSession = db.prepare(`
      SELECT s.expires_at, s.last_activity_at, u.username, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ?
    `).get(sessionToken) as any;

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
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
      return null;
    }

    // Check if user is active
    if (!debugSession.is_active) {
      console.log('❌ User is not active');
      return null;
    }
    
    const session = db.prepare(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, 
             u.is_active, u.last_login_at, u.last_activity_at, u.created_at,
             s.last_activity_at as session_activity
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ?
    `).get(sessionToken) as any;

    if (!session) {
      console.log('❌ Session data not found');
      return null;
    }

    // Fix timestamp parsing - handle both SQLite and ISO formats
    let lastActivity: Date;
    try {
      // If it contains 'T', it's likely ISO format
      if (session.session_activity.includes('T')) {
        lastActivity = new Date(session.session_activity);
      } else {
        // SQLite format - assume UTC and convert
        lastActivity = new Date(session.session_activity + ' UTC');
      }
    } catch (error) {
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
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
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
  static async createUser(userData: CreateUserRequest, createdBy: number): Promise<User> {
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(userData.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists (if provided)
    if (userData.email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(userData.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    const passwordHash = await this.hashPassword(userData.password);

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userData.username,
      userData.email || null,
      passwordHash,
      userData.first_name || null,
      userData.last_name || null,
      userData.role || 'regular',
      createdBy
    );

    const user = this.getUserById(result.lastInsertRowid as number);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Get all users (superadmin only)
   */
  static getAllUsers(): User[] {
    const users = db.prepare(`
      SELECT id, username, email, first_name, last_name, role, is_active, 
             last_login_at, last_activity_at, created_at
      FROM users 
      ORDER BY created_at DESC
    `).all() as any[];
    
    // Convert SQLite boolean integers to JavaScript booleans
    return users.map(user => ({
      ...user,
      is_active: Boolean(user.is_active)
    })) as User[];
  }

  /**
   * Update user password (superadmin only)
   */
  static async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_changed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, now, now, userId);

    // Invalidate all sessions for this user
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  }

  /**
   * Toggle user active status
   */
  static toggleUserStatus(userId: number): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET is_active = NOT is_active, updated_at = ?
      WHERE id = ?
    `).run(now, userId);

    // If deactivating, remove all sessions
    const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userId) as any;
    if (!user?.is_active) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
    }
  }

  /**
   * Increment failed login attempts
   */
  private static async incrementFailedAttempts(username: string): Promise<void> {
    const user = db.prepare(`
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
  private static async resetFailedAttempts(username: string): Promise<void> {
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE username = ?
    `).run(username);
  }

  /**
   * Update last login timestamp
   */
  private static async updateLastLogin(userId: number): Promise<void> {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET last_login_at = ?, last_activity_at = ?
      WHERE id = ?
    `).run(now, now, userId);
  }

  /**
   * Log user activity
   */
  static async logActivity(
    userId: number | null, 
    username: string, 
    action: string, 
    resource: string, 
    details: string, 
    ipAddress: string, 
    userAgent: string, 
    success: boolean
  ): Promise<void> {
    db.prepare(`
      INSERT INTO user_activity_log 
      (user_id, username, action, resource, details, ip_address, user_agent, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, action, resource, details, ipAddress, userAgent, success ? 1 : 0);
  }

  /**
   * Get activity logs (superadmin only)
   */
  static getActivityLogs(limit: number = 100): any[] {
    return db.prepare(`
      SELECT * FROM user_activity_log 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
  }

  /**
   * Clean up expired sessions
   */
  static cleanupExpiredSessions(): void {
    db.prepare('DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP').run();
  }
} 