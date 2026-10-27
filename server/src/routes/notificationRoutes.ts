import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// 1. Get notifications for current user and role
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const userId = req.user!.id;
  const role = req.user!.role;

  const notifications = db.prepare(`
    SELECT *
    FROM notifications
    WHERE user_id = ? OR role = ? OR (user_id IS NULL AND role IS NULL)
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId, role);

  const unreadCountRow = db.prepare(`
    SELECT COUNT(*) as unread
    FROM notifications
    WHERE (user_id = ? OR role = ? OR (user_id IS NULL AND role IS NULL))
      AND is_read = 0
  `).get(userId, role) as { unread: number };

  res.json({
    notifications,
    unreadCount: unreadCountRow?.unread || 0,
  });
});

// 2. Mark notification as read
router.patch('/:id/read', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Notification marked as read' });
});

// 3. Mark all notifications as read
router.post('/mark-all-read', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const userId = req.user!.id;
  const role = req.user!.role;

  db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE user_id = ? OR role = ? OR (user_id IS NULL AND role IS NULL)
  `).run(userId, role);

  res.json({ message: 'All notifications marked as read' });
});

export default router;
