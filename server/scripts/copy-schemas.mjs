import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');
const sourceDir = path.join(repoRoot, 'database');
const targetDir = path.join(serverRoot, 'dist', 'database');

fs.mkdirSync(targetDir, { recursive: true });

for (const fileName of ['schema.sql', 'analytics-schema.sql', 'request-logs-schema.sql']) {
  fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}
