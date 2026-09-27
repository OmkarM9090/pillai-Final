import mongoose from 'mongoose';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDatabase(retries = MAX_RETRIES): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB connected successfully`);
      return;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const err = error instanceof Error ? error.message : String(error);
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed: ${err}`);

      if (isLastAttempt) {
        throw new Error(`MongoDB connection failed after ${retries} attempts: ${err}`);
      }

      console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

export function getDatabaseStatus(): { connected: boolean; state: string } {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };

  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    state: states[readyState] ?? 'unknown',
  };
}

// Graceful disconnect on app termination
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('🔌 MongoDB disconnected gracefully');
  }
}
