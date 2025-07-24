"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dbPath = path_1.default.join(process.cwd(), 'data', 'agrivex.db');
// Ensure data directory exists
const dataDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Create database connection
function createDatabase() {
    const database = new better_sqlite3_1.default(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    });
    // Enable foreign key constraints
    database.pragma('foreign_keys = ON');
    // Enable WAL mode for better concurrent access
    database.pragma('journal_mode = WAL');
    return database;
}
// @ts-ignore - Database export type issue with better-sqlite3
exports.db = createDatabase();
exports.default = exports.db;
//# sourceMappingURL=connection.js.map