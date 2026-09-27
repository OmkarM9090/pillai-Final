import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.routes';
import intelRoutes from './routes/intel.routes';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler as errorMiddleware, notFoundHandler } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
