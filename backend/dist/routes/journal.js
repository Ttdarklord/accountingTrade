"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * GET /api/journal - Get journal entries
 */
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const entries = connection_1.db.prepare(`
      SELECT * FROM journal_entries 
      ORDER BY date DESC, id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
        // Get lines for each entry
        for (const entry of entries) {
            const lines = connection_1.db.prepare(`
        SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
      `).all(entry.id);
            entry.lines = lines;
        }
        res.json({
            success: true,
            data: entries
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch journal entries'
        });
    }
});
/**
 * GET /api/journal/:id - Get specific journal entry
 */
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const entry = connection_1.db.prepare(`
      SELECT * FROM journal_entries WHERE id = ?
    `).get(id);
        if (!entry) {
            return res.status(404).json({
                success: false,
                error: 'Journal entry not found'
            });
        }
        const lines = connection_1.db.prepare(`
      SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
    `).all(id);
        entry.lines = lines;
        res.json({
            success: true,
            data: entry
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch journal entry'
        });
    }
});
exports.default = router;
//# sourceMappingURL=journal.js.map