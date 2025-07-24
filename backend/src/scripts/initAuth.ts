import fs from 'fs';
import path from 'path';
import db from '../database/connection';
import { AuthService } from '../services/authService';

const SUPERADMIN_PASSWORD = 'Rasool1-Najibi2-Kheirandish3';

async function initializeAuth() {
  console.log('🔧 Initializing authentication system...');

  try {
    // 1. Run the user management migration
    console.log('📋 Running user management migration...');
    const migrationPath = path.join(__dirname, '../database/migrations/005_create_users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
    console.log('✅ Migration completed successfully');

    // 2. Check if super admin already exists
    const existingSuperAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('yasinnajibi');
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super admin user already exists. Updating password...');
      
      // Update the password
      const passwordHash = await AuthService.hashPassword(SUPERADMIN_PASSWORD);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, password_changed_at = ? 
        WHERE username = ?
      `).run(passwordHash, now, 'yasinnajibi');
      
      console.log('✅ Super admin password updated');
    } else {
      console.log('👤 Creating super admin user...');
      
      // Hash the password
      const passwordHash = await AuthService.hashPassword(SUPERADMIN_PASSWORD);
      
      // Create the super admin user
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (
          username, 
          email,
          password_hash,
          first_name,
          last_name,
          role,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'yasinnajibi',
        'admin@agrivex.com',
        passwordHash,
        'Yasin',
        'Najibi',
        'superadmin',
        1, // true as 1 for SQLite
        now,
        now
      );
      
      console.log('✅ Super admin user created successfully');
    }

    // 3. Log the initialization
    await AuthService.logActivity(
      1, // Super admin user ID
      'yasinnajibi',
      'SYSTEM_INIT',
      'authentication',
      'Authentication system initialized',
      '127.0.0.1',
      'system',
      true
    );

    console.log('🎉 Authentication system initialized successfully!');
    console.log('');
    console.log('📋 Super Admin Credentials:');
    console.log('   Username: yasinnajibi');
    console.log('   Password: Rasool1-Najibi2-Kheirandish3');
    console.log('');
    console.log('🔐 Please change the password after first login in production!');

  } catch (error) {
    console.error('❌ Failed to initialize authentication system:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeAuth().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
}

export { initializeAuth }; 