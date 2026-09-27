import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import apiRoutes from './routes/api.routes';

export function createApp(): Application {
  const app = express();

  // ============================================================
  // Security headers
  // ============================================================
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    })
  );

  // ============================================================
  // CORS
  // ============================================================
  app.use(
    cors({
      origin: (origin, callback) => {
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        const allowedOrigins = [clientUrl, 'http://localhost:3000', 'http://localhost:5173'];

        // Allow requests with no origin (mobile apps, curl, etc.) in development
        if (!origin || process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ============================================================
  // Body parsers
  // ============================================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================
  // Routes
  // ============================================================
  app.use('/api/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', apiRoutes);

  // ============================================================
  // 404 & Error handlers (must be last)
  // ============================================================
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
