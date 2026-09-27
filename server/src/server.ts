import 'dotenv/config';
import { validateEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { createApp } from './app';

// Validate environment variables before anything else
validateEnv();

const PORT = parseInt(process.env.PORT ?? '5000', 10);

async function bootstrap() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Express application
    const app = createApp();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Smart Resort 360 API running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });

    // ============================================================
    // Graceful shutdown
    // ============================================================
    const shutdown = async (signal: string) => {
      console.log(`\n⚡ ${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log('🔒 HTTP server closed');
        await disconnectDatabase();
        console.log('✅ Shutdown complete');
        process.exit(0);
      });

      // Force exit after 10s
      setTimeout(() => {
        console.error('⏱ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejections
    process.on('unhandledRejection', (reason) => {
      console.error('💥 Unhandled Promise Rejection:', reason);
      // In production, let it crash so the process manager restarts
      if (process.env.NODE_ENV === 'production') {
        shutdown('unhandledRejection');
      }
    });

    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
