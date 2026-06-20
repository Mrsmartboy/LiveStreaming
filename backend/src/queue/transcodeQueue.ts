import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ requires a dedicated connection with maxRetriesPerRequest set to null
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const transcodeQueue = new Queue('video-transcode', {
  connection: redisConnection as any,
});

export async function addTranscodeJob(sessionId: string, objectKey: string) {
  await transcodeQueue.add(
    'transcode',
    { sessionId, objectKey },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
  console.log(`➕ Queued transcode job for session ${sessionId} (key: ${objectKey})`);
}
