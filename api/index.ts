import { createApp } from '../server/src/app';
import { getDatabase } from '../server/src/db/database';
import { SeedService } from '../server/src/services/seedService';
import fs from 'fs';
import path from 'path';

// If running in Vercel Serverless environment:
// AWS Lambda filesystem is read-only except /tmp
if (process.env.VERCEL || process.env.NOW_REGION) {
  const dbPath = path.join('/tmp', 'fdr_sentinel.db');
  process.env.DATABASE_PATH = dbPath;
  process.env.UPLOAD_DIR = path.join('/tmp', 'uploads');

  if (!fs.existsSync(dbPath)) {
    try {
      const db = getDatabase({ dbPath });
      SeedService.getInstance().seedAll(db);
    } catch (err) {
      console.error('Error auto-seeding SQLite in /tmp on Vercel:', err);
    }
  }
}

const app = createApp();

export default app;
