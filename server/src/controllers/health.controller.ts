import { Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database';
import { sendSuccess } from '../utils/response';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const db = getDatabaseStatus();

  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    version: process.env.npm_package_version ?? '1.0.0',
    database: {
      status: db.state,
      connected: db.connected,
    },
    uptime: Math.floor(process.uptime()),
  };

  const statusCode = db.connected ? 200 : 503;
  res.status(statusCode).json({
    success: db.connected,
    data: payload,
    message: db.connected ? 'Service is healthy' : 'Service degraded: database unavailable',
  });
}
