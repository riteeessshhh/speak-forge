import '../lib/env.js';
import { ensureDatabaseSchema } from '../db/initSchema.js';

async function migrateJobStatus() {
  try {
    console.log('Running job status & unique constraint migration...');
    await ensureDatabaseSchema();
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

migrateJobStatus();
