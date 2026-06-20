import 'dotenv/config';
import { transcodeWorker } from './queue/transcodeWorker';

console.log('🔧 Transcode worker started, waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏹️  Shutting down transcode worker...');
  await transcodeWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏹️  Shutting down transcode worker...');
  await transcodeWorker.close();
  process.exit(0);
});
