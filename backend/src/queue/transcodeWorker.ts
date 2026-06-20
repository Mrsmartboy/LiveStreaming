import { Worker, Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../services/storageService';
import { redisConnection } from './transcodeQueue';
import prisma from '../config/prisma';

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'recordings';

/**
 * Download an S3/MinIO object to a local file using streams.
 */
async function downloadToFile(bucket: string, key: string, destPath: string): Promise<number> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  return new Promise<number>((resolve, reject) => {
    const writeStream = fs.createWriteStream(destPath);
    const readable = response.Body as Readable;

    readable.pipe(writeStream);
    writeStream.on('finish', () => {
      const stats = fs.statSync(destPath);
      resolve(stats.size);
    });
    writeStream.on('error', reject);
    readable.on('error', reject);
  });
}

/**
 * Probe a file with ffprobe to check if it has video/audio streams.
 */
function probeFile(filePath: string): Promise<{ hasVideo: boolean; hasAudio: boolean; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      const duration = metadata.format?.duration || 0;
      resolve({
        hasVideo: !!videoStream,
        hasAudio: !!audioStream,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        duration: typeof duration === 'string' ? parseFloat(duration) : duration,
      });
    });
  });
}

function parseTimemark(timemark: string): number {
  if (!timemark) return 0;
  const parts = timemark.split(':');
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  return parseFloat(timemark) || 0;
}

export const transcodeWorker = new Worker(
  'video-transcode',
  async (job: Job<{ sessionId: string; objectKey: string }>) => {
    const { sessionId, objectKey } = job.data;
    console.log(`🎥 Starting transcoding for session ${sessionId}, key: ${objectKey}`);

    const tmpDir = path.join('/tmp', 'transcode', sessionId);
    fs.mkdirSync(tmpDir, { recursive: true });

    const ext = path.extname(objectKey) || '.webm';
    const inputPath = path.join(tmpDir, `input${ext}`);
    const hlsDir = path.join(tmpDir, 'hls');
    fs.mkdirSync(hlsDir, { recursive: true });

    try {
      // 1. Download file from MinIO
      const fileSize = await downloadToFile(MINIO_BUCKET, objectKey, inputPath);
      console.log(`✅ Downloaded ${fileSize} bytes for session ${sessionId}`);

      if (fileSize < 1000) {
        throw new Error(`Downloaded file too small (${fileSize} bytes), likely corrupt or empty`);
      }

      // 2. Probe the file to understand its streams
      const probe = await probeFile(inputPath);
      console.log(`📊 Probe result: video=${probe.hasVideo} (${probe.width}x${probe.height}), audio=${probe.hasAudio}, duration=${probe.duration}`);

      if (!probe.hasVideo && !probe.hasAudio) {
        throw new Error('File has no video or audio streams');
      }

      // Fetch session duration from DB as fallback if probe duration is missing or 0
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { startedAt: true, endedAt: true }
      });
      let sessionDuration = 0;
      if (session?.startedAt && session?.endedAt) {
        sessionDuration = Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000);
      }
      const duration = probe.duration || sessionDuration || 0;
      console.log(`⏱️ Estimated duration: ${duration}s (probe=${probe.duration}s, session=${sessionDuration}s)`);

      // 3. Build FFmpeg options based on what streams are available
      // -g 60 together with -r 30 ensures a keyframe exactly every 2 seconds
      const outputOptions: string[] = ['-preset veryfast', '-r 30', '-g 60', '-sc_threshold 0'];

      if (probe.hasVideo) {
        // Multi-resolution video + optional audio
        outputOptions.push(
          '-map 0:v:0', '-map 0:a:0?',
          '-map 0:v:0', '-map 0:a:0?',
          '-map 0:v:0', '-map 0:a:0?',
          '-map 0:v:0', '-map 0:a:0?',
          '-s:v:0 256x144',  '-c:v:0 libx264', '-b:v:0 100k',
          '-s:v:1 640x360',  '-c:v:1 libx264', '-b:v:1 500k',
          '-s:v:2 1280x720', '-c:v:2 libx264', '-b:v:2 1200k',
          '-s:v:3 1920x1080', '-c:v:3 libx264', '-b:v:3 2200k',
        );

        if (probe.hasAudio) {
          outputOptions.push(
            '-c:a:0 aac', '-b:a:0 64k',
            '-c:a:1 aac', '-b:a:1 96k',
            '-c:a:2 aac', '-b:a:2 128k',
            '-c:a:3 aac', '-b:a:3 192k',
          );
          outputOptions.push('-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3');
        } else {
          outputOptions.push('-var_stream_map', 'v:0 v:1 v:2 v:3');
        }
      } else {
        // Audio-only recording
        outputOptions.push(
          '-map 0:a:0',
          '-c:a aac', '-b:a 128k',
          '-var_stream_map', 'a:0',
        );
      }

      outputOptions.push(
        '-f hls',
        '-hls_time 4',
        '-hls_playlist_type vod',
        '-master_pl_name master.m3u8',
      );

      // 4. Transcode
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(outputOptions)
          .output(path.join(hlsDir, 'stream_%v.m3u8'))
          .on('start', (cmdline) => console.log(`🔧 FFmpeg command: ${cmdline}`))
          .on('progress', async (p) => {
            let pct = 0;
            if (p.percent) {
              pct = Math.round(p.percent);
            } else if (duration > 0) {
              const currentSecs = parseTimemark(p.timemark);
              pct = Math.min(99, Math.round((currentSecs / duration) * 100));
            }
            
            // Count how many .ts segments we have produced so far
            let segmentsCount = 0;
            try {
              segmentsCount = fs.readdirSync(hlsDir).filter(f => f.endsWith('.ts')).length;
            } catch {}

            console.log(`⏳ Progress: ${pct}% | Segments generated: ${segmentsCount} | Timemark: ${p.timemark}`);

            await job.updateProgress({
              percent: pct,
              segments: segmentsCount,
              stage: 'transcoding'
            }).catch(() => {});
          })
          .on('end', () => resolve())
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg stderr:', stderr);
            reject(err);
          })
          .run();
      });

      console.log(`✅ Transcoding completed for session ${sessionId}`);

      // 5. Upload all HLS files back to MinIO
      const files = fs.readdirSync(hlsDir);
      console.log(`📁 Uploading ${files.length} HLS files...`);

      let uploadedCount = 0;
      for (const file of files) {
        const filePath = path.join(hlsDir, file);
        const fileContent = fs.readFileSync(filePath);
        const mimeType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';

        await s3.send(new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: `sessions/${sessionId}/hls/${file}`,
          Body: fileContent,
          ContentType: mimeType,
        }));

        uploadedCount++;
        await job.updateProgress({
          percent: Math.round((uploadedCount / files.length) * 100),
          segments: files.filter(f => f.endsWith('.ts')).length,
          stage: 'uploading',
          uploaded: uploadedCount,
          totalFiles: files.length
        }).catch(() => {});
      }

      console.log(`✅ Uploaded HLS segments to MinIO for session ${sessionId}`);

      // 6. Update the Database
      const hlsUrl = `http://localhost:9000/${MINIO_BUCKET}/sessions/${sessionId}/hls/master.m3u8`;

      await prisma.session.update({
        where: { id: sessionId },
        data: { hlsUrl },
      });

      // Invalidate the session cache in Redis so GET /api/sessions/:id returns the updated data
      const { invalidateSession } = require('../services/redisService');
      await invalidateSession(sessionId).catch(() => {});

      console.log(`🎉 Successfully processed HLS for session ${sessionId}`);
    } catch (err) {
      console.error(`❌ Transcode job failed for session ${sessionId}:`, err);
      throw err;
    } finally {
      // Cleanup
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  },
  { 
    connection: redisConnection as any,
    lockDuration: 60000, // 60 seconds lock duration
    lockRenewTime: 20000 // renew lock every 20 seconds
  }
);

transcodeWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

transcodeWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

