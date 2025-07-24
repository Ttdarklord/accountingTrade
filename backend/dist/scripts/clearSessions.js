"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllSessions = clearAllSessions;
const connection_1 = __importDefault(require("../database/connection"));
async function clearAllSessions() {
    console.log('🧹 Clearing all existing sessions...');
    try {
        const result = connection_1.default.prepare('DELETE FROM user_sessions').run();
        console.log(`✅ Cleared ${result.changes} sessions`);
        // Also clean up any activity logs if needed
        console.log('📊 Current user_sessions table:');
        const remainingSessions = connection_1.default.prepare('SELECT COUNT(*) as count FROM user_sessions').get();
        console.log(`Remaining sessions: ${remainingSessions.count}`);
    }
    catch (error) {
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
//# sourceMappingURL=clearSessions.js.map