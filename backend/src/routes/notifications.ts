import express from 'express';
import db from '../database/connection';

const router = express.Router();

// Interface for notifications
interface Notification {
  id: number;
  type: 'trade' | 'receipt' | 'edit' | 'delete' | 'restore';
  title: string;
  message: string;
  entity_type: 'trade' | 'receipt' | 'account' | 'party';
  entity_id: number;
  is_read: boolean;
  created_at: string;
}

// GET /api/notifications - Get all notifications (recent first)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread_only === 'true';
    
    let query = `
      SELECT * FROM notifications
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (unreadOnly) {
      query += ' AND is_read = 0';
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const notifications = db.prepare(query).all(...params) as Notification[];
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notifications/:id/read - Mark a notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ?
    `);
    
    const result = stmt.run(notificationId);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE is_read = 0
    `);
    
    const result = stmt.run();
    
    res.json({
      success: true,
      message: `Marked ${result.changes} notifications as read`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to create a notification
export function createNotification(
  type: 'trade' | 'receipt' | 'edit' | 'delete' | 'restore',
  title: string,
  message: string,
  entityType: 'trade' | 'receipt' | 'account' | 'party',
  entityId: number
) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (type, title, message, entity_type, entity_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    
    stmt.run(type, title, message, entityType, entityId, new Date().toISOString());
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export default router; 