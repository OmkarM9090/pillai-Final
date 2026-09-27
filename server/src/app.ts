import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api.routes';
import intelRoutes from './routes/intel.routes';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler as errorMiddleware, notFoundHandler } from './middleware/error.middleware';

const app = express();

// Secure defaults. The browser normally talks to Vite and Vite proxies /api;
// direct API access is restricted to configured origins.
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const configuredOrigins = (process.env.CLIENT_URL ?? 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || configuredOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed'));
    }
  },
  credentials: true,
}));
app.use(rateLimit({ windowMs: 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/health', healthRoutes);
// Live intelligence, digital-twin what-if and AI copilot routes
app.use('/api/v1', intelRoutes);
app.use('/api/v1', apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;
