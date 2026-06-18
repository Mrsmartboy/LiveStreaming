import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'recordings';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';

// S3-compatible client pointed at MinIO
export const s3 = new S3Client({
  endpoint: `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  region: 'us-east-1', // Required by SDK; MinIO ignores it
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Generate a presigned URL for uploading a file to MinIO.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file from MinIO.
 */
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Get the public URL of an object (for public buckets).
 */
export function getPublicUrl(key: string): string {
  return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
}

/**
 * List all recordings for a session.
 */
export async function listSessionRecordings(sessionId: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: MINIO_BUCKET,
    Prefix: `sessions/${sessionId}/`,
  });
  const response = await s3.send(command);
  return (response.Contents || [])
    .map((obj) => obj.Key || '')
    .filter(Boolean);
}

/**
 * Delete a recording from MinIO.
 */
export async function deleteRecording(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
  });
  await s3.send(command);
}
