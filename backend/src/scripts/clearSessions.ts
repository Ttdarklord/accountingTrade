import db from '../database/connection';

async function clearAllSessions() {
  console.log('🧹 Clearing all existing sessions...');
  
  try {
    const result = db.prepare('DELETE FROM user_sessions').run();
    console.log(`✅ Cleared ${result.changes} sessions`);
    
    // Also clean up any activity logs if needed
    console.log('📊 Current user_sessions table:');
    const remainingSessions = db.prepare('SELECT COUNT(*) as count FROM user_sessions').get() as any;
    console.log(`Remaining sessions: ${remainingSessions.count}`);
    
  } catch (error) {
    console.error('❌ Failed to clear sessions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearAllSessions().then(() => {
    console.log('🎉 All sessions cleared successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('Clear sessions failed:', error);
    process.exit(1);
  });
}

export { clearAllSessions }; 