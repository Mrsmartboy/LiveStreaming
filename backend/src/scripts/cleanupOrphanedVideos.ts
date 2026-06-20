import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { s3 } from '../services/storageService';
import prisma from '../config/prisma';

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'recordings';

async function listAllObjects(bucket: string): Promise<any[]> {
  const objects: any[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);
    if (response.Contents) {
      objects.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function bulkDeleteObjects(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // S3 DeleteObjectsCommand allows up to 1000 keys per request
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: chunk.map(key => ({ Key: key })),
        Quiet: true,
      },
    });
    await s3.send(command);
  }
}

async function main() {
  const force = process.argv.includes('--force');
  console.log(`🧹 Starting MinIO video cleanup script...`);
  console.log(force ? `⚠️  Running in LIVE mode (deletions will be executed)` : `ℹ️  Running in DRY RUN mode (no deletions)`);

  try {
    // 1. List all objects in recordings bucket
    console.log(`📥 Listing all files in MinIO bucket '${MINIO_BUCKET}'...`);
    const allObjects = await listAllObjects(MINIO_BUCKET);
    console.log(`   Found ${allObjects.length} total objects in bucket.`);

    // 2. Group objects by sessionId
    const sessionObjects = new Map<string, string[]>();
    const unrecognizedObjects: string[] = [];

    for (const obj of allObjects) {
      if (!obj.Key) continue;
      const match = obj.Key.match(/^sessions\/([a-zA-Z0-9-]+)\//);
      if (match) {
        const sessionId = match[1];
        if (!sessionObjects.has(sessionId)) {
          sessionObjects.set(sessionId, []);
        }
        sessionObjects.get(sessionId)!.push(obj.Key);
      } else {
        unrecognizedObjects.push(obj.Key);
      }
    }

    console.log(`📂 Found ${sessionObjects.size} unique session folders in MinIO.`);

    // 3. Check each session against database and identify duplicates
    const keysToDelete: string[] = [];
    let keptSessionsCount = 0;
    let deletedSessionsCount = 0;

    for (const [sessionId, keys] of sessionObjects.entries()) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true, title: true, recordingUrl: true },
      });

      if (!session) {
        console.log(`❌ Session ${sessionId}: DELETING (${keys.length} files). Reason: Session deleted from database`);
        keysToDelete.push(...keys);
        deletedSessionsCount++;
      } else if (session.status === 'SCHEDULED') {
        console.log(`❌ Session ${sessionId} ("${session.title}"): DELETING (${keys.length} files). Reason: Session is scheduled (not live or ended)`);
        keysToDelete.push(...keys);
        deletedSessionsCount++;
      } else {
        console.log(`✅ Session ${sessionId} ("${session.title}"): KEEPING active files. Status: ${session.status}`);

        // Find the active recording filename inside recordingUrl
        let activeWebmKey: string | null = null;
        if (session.recordingUrl) {
          const match = session.recordingUrl.match(/sessions\/[a-zA-Z0-9-]+\/\d+-recording\.webm/);
          if (match) {
            activeWebmKey = match[0];
          }
        }

        let sessionKeptCount = 0;
        let sessionDeletedCount = 0;

        for (const key of keys) {
          // If it's a webm file, check if it matches the active recording file
          if (key.endsWith('.webm')) {
            if (activeWebmKey && key === activeWebmKey) {
              sessionKeptCount++;
            } else {
              console.log(`   ❌ Duplicate/Stale recording: DELETING ${key}`);
              keysToDelete.push(key);
              sessionDeletedCount++;
            }
          } else {
            // Keep HLS segments and playlists
            sessionKeptCount++;
          }
        }

        if (sessionDeletedCount > 0) {
          console.log(`   (Kept ${sessionKeptCount} active files, marked ${sessionDeletedCount} duplicates for deletion)`);
        }
        keptSessionsCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   - Sessions to keep: ${keptSessionsCount}`);
    console.log(`   - Sessions to clean up: ${deletedSessionsCount}`);
    console.log(`   - Total files to delete: ${keysToDelete.length}`);

    if (keysToDelete.length > 0) {
      if (force) {
        console.log(`🔥 Deleting ${keysToDelete.length} files from MinIO...`);
        await bulkDeleteObjects(MINIO_BUCKET, keysToDelete);
        console.log(`✅ Deletion completed successfully!`);
      } else {
        console.log(`💡 DRY RUN: No files were deleted. Run with '--force' to delete the files.`);
      }
    } else {
      console.log(`✨ No files need to be deleted.`);
    }

  } catch (err) {
    console.error('❌ Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
