import fs from 'node:fs';
import path from 'node:path';
import { createAppDatabase, type AppDatabase } from '../src/lib/database';
import { parseChecklist } from '../src/lib/checklist';

const SIBLING_CHECKLIST_PATH = '../career-ops/interview-prep/revision-checklist.md';

export function resolveChecklistPath(pathArgument?: string, envPath = process.env.CHECKLIST_FILE): string {
  return path.resolve(pathArgument || envPath || SIBLING_CHECKLIST_PATH);
}

export function readChecklistFile(filePath: string) {
  if (!fs.existsSync(filePath)) throw new Error(`Checklist source file not found: ${filePath}`);
  const items = parseChecklist(fs.readFileSync(filePath, 'utf8'));
  if (items.length === 0) throw new Error(`No checklist items found in ${filePath}`);
  return items;
}

export function importChecklistFile(filePath: string, db: AppDatabase) {
  return db.importChecklistItems(readChecklistFile(filePath));
}

function runImport(filePath: string): void {
  const items = readChecklistFile(filePath);
  const db = createAppDatabase();
  try {
    const result = db.importChecklistItems(items);
    const total = Object.values(result.countsByPart).reduce((sum, count) => sum + count, 0);
    console.log(`Imported ${total} checklist items from ${path.relative(process.cwd(), filePath)}:`);
    for (const [part, count] of Object.entries(result.countsByPart)) {
      console.log(`  ${part}: ${count}`);
    }
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  try {
    runImport(resolveChecklistPath(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
