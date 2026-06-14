/**
 * Copies pg-cloudflare into the pg node_modules directory inside .next/standalone
 * so that OpenNext's esbuild can resolve it during bundling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Find pg-cloudflare source
const pgCloudflareSrc = path.join(root, 'node_modules', 'pg-cloudflare');

// Find the pg package inside .next/standalone (pnpm structure)
const standaloneModules = path.join(root, '.next', 'standalone', 'node_modules');

function findPgDir(dir) {
  // Look for pg in the pnpm structure
  const pnpmDir = path.join(dir, '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    for (const entry of entries) {
      if (entry.startsWith('pg@') && !entry.includes('pg-cloudflare') && !entry.includes('pg-connection')) {
        const pgPath = path.join(pnpmDir, entry, 'node_modules', 'pg');
        if (fs.existsSync(pgPath)) {
          return pgPath;
        }
      }
    }
  }
  // Fallback: direct node_modules/pg
  const directPg = path.join(dir, 'pg');
  if (fs.existsSync(directPg)) return directPg;
  return null;
}

if (!fs.existsSync(pgCloudflareSrc)) {
  console.log('pg-cloudflare not found in node_modules, skipping patch');
  process.exit(0);
}

if (!fs.existsSync(standaloneModules)) {
  console.log('.next/standalone/node_modules not found, skipping patch');
  process.exit(0);
}

const pgDir = findPgDir(standaloneModules);
if (!pgDir) {
  console.log('pg package not found in standalone, skipping patch');
  process.exit(0);
}

// Copy pg-cloudflare next to pg (as a sibling in node_modules)
const targetDir = path.join(path.dirname(pgDir), 'pg-cloudflare');
if (!fs.existsSync(targetDir)) {
  fs.cpSync(pgCloudflareSrc, targetDir, { recursive: true });
  console.log(`✓ Copied pg-cloudflare to ${path.relative(root, targetDir)}`);
} else {
  console.log('pg-cloudflare already exists in standalone, skipping');
}
