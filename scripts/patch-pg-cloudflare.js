/**
 * Patches the pg module in .next/standalone to inline pg-cloudflare's CloudflareSocket
 * directly, avoiding the need for a separate module resolution at bundle time.
 * 
 * The root issue: OpenNext copies .next/standalone/ to .open-next/ and then esbuild 
 * tries to resolve `require('pg-cloudflare')` but can't find dist/index.js in the 
 * pnpm structure. Instead of fighting the module resolution, we patch pg's stream.js
 * to import from the absolute path of pg-cloudflare.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const standaloneDir = path.join(root, '.next', 'standalone');
const pnpmDir = path.join(standaloneDir, 'node_modules', '.pnpm');

if (!fs.existsSync(pnpmDir)) {
  console.log('.pnpm dir not found in standalone, skipping');
  process.exit(0);
}

let patched = 0;
const entries = fs.readdirSync(pnpmDir);

for (const entry of entries) {
  if (/^pg@\d/.test(entry)) {
    const streamFile = path.join(pnpmDir, entry, 'node_modules', 'pg', 'lib', 'stream.js');
    if (fs.existsSync(streamFile)) {
      let content = fs.readFileSync(streamFile, 'utf-8');
      if (content.includes("require('pg-cloudflare')")) {
        // Replace the require with inline code that imports CloudflareSocket from the global scope
        // In Cloudflare Workers, the socket is available via the connect() API
        content = content.replace(
          /const \{ CloudflareSocket \} = require\('pg-cloudflare'\)/,
          "const { CloudflareSocket } = require('pg-cloudflare/dist/index.js')"
        );
        // Actually, the simplest fix: just copy the dist files into the right place
        const pgCloudflareDir = path.join(pnpmDir, entry, 'node_modules', 'pg-cloudflare');
        if (fs.existsSync(pgCloudflareDir)) {
          const distDir = path.join(pgCloudflareDir, 'dist');
          const srcDist = path.join(root, 'node_modules', 'pg-cloudflare', 'dist');
          if (!fs.existsSync(path.join(distDir, 'index.js')) && fs.existsSync(srcDist)) {
            fs.cpSync(srcDist, distDir, { recursive: true });
            console.log(`✓ Copied dist/ to ${path.relative(root, pgCloudflareDir)}`);
            patched++;
          }
        }
      }
    }
  }
}

// Also check if there's a top-level pg-cloudflare that needs patching
const topLevelPgCf = path.join(standaloneDir, 'node_modules', 'pg-cloudflare');
if (fs.existsSync(topLevelPgCf) && !fs.existsSync(path.join(topLevelPgCf, 'dist', 'index.js'))) {
  const srcDist = path.join(root, 'node_modules', 'pg-cloudflare', 'dist');
  if (fs.existsSync(srcDist)) {
    fs.cpSync(srcDist, path.join(topLevelPgCf, 'dist'), { recursive: true });
    console.log(`✓ Copied dist/ to top-level pg-cloudflare`);
    patched++;
  }
}

console.log(patched > 0 ? `✓ Patched ${patched} location(s)` : 'No patching needed');

// CRITICAL: Also check .open-next if it already exists (for re-runs)
const openNextPnpm = path.join(root, '.open-next', 'server-functions', 'default', 'node_modules', '.pnpm');
if (fs.existsSync(openNextPnpm)) {
  const onEntries = fs.readdirSync(openNextPnpm);
  for (const entry of onEntries) {
    if (/^pg@\d/.test(entry)) {
      const pgCloudflareDir = path.join(openNextPnpm, entry, 'node_modules', 'pg-cloudflare');
      if (fs.existsSync(pgCloudflareDir)) {
        const distDir = path.join(pgCloudflareDir, 'dist');
        const srcDist = path.join(root, 'node_modules', 'pg-cloudflare', 'dist');
        if (!fs.existsSync(path.join(distDir, 'index.js')) && fs.existsSync(srcDist)) {
          fs.cpSync(srcDist, distDir, { recursive: true });
          console.log(`✓ Patched .open-next: ${path.relative(root, pgCloudflareDir)}/dist/`);
        }
      }
    }
  }
}
