import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { AuditLog } from '../models/AuditLog';

export async function listNotifications(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const notifications = await Notification.find({ recipient_user_id: req.user?._id })
      .sort({ createdAt: -1 }).limit(limit);
    const unread = await Notification.countDocuments({ recipient_user_id: req.user?._id, read_at: { $exists: false } });
    res.json({ success: true, data: { notifications, unread } });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load notifications' });
  }
}

export async function markNotificationsRead(req: Request, res: Response) {
  try {
    const ids = Array.isArray(req.body?.notificationIds) ? req.body.notificationIds : [];
    const filter: Record<string, unknown> = { recipient_user_id: req.user?._id, read_at: { $exists: false } };
    if (ids.length > 0) filter._id = { $in: ids };
    const result = await Notification.updateMany(filter, { $set: { read_at: new Date() } });
    await AuditLog.create({
      user_name: req.user?.name ?? 'Authenticated user',
      user_role: req.user?.role,
      action_type: 'NOTIFICATIONS_READ',
      entity_type: 'Notification',
      reason: `${result.modifiedCount} notifications marked read`,
    });
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to update notifications' });
  }
}
