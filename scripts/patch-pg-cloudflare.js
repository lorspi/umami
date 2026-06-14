/**
 * Ensures pg-cloudflare/dist/index.js exists in the pnpm structure inside .next/standalone
 * so that OpenNext's esbuild can resolve it during bundling.
 * 
 * The issue: pnpm creates a symlink for pg-cloudflare but the dist/ folder may not
 * be properly resolved. We find all pg-cloudflare directories in standalone and ensure
 * they have the dist/index.js file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pgCloudflareSrc = path.join(root, 'node_modules', 'pg-cloudflare');
const standaloneDir = path.join(root, '.next', 'standalone');

if (!fs.existsSync(pgCloudflareSrc)) {
  console.log('pg-cloudflare not found in node_modules, skipping patch');
  process.exit(0);
}

if (!fs.existsSync(standaloneDir)) {
  console.log('.next/standalone not found, skipping patch');
  process.exit(0);
}

// Recursively find all pg-cloudflare directories in standalone
function findAll(dir, name, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === name) {
        results.push(fullPath);
      } else if (entry.name !== '.cache') {
        findAll(fullPath, name, results);
      }
    }
  }
  return results;
}

const targets = findAll(path.join(standaloneDir, 'node_modules'), 'pg-cloudflare');
let patched = 0;

for (const target of targets) {
  const distDir = path.join(target, 'dist');
  const indexFile = path.join(distDir, 'index.js');
  
  if (!fs.existsSync(indexFile)) {
    // Copy dist from source
    const srcDist = path.join(pgCloudflareSrc, 'dist');
    if (fs.existsSync(srcDist)) {
      fs.cpSync(srcDist, distDir, { recursive: true });
      console.log(`✓ Patched ${path.relative(root, target)}/dist/`);
      patched++;
    }
  }
}

if (patched === 0) {
  console.log('No pg-cloudflare directories needed patching');
} else {
  console.log(`✓ Patched ${patched} pg-cloudflare location(s)`);
}
