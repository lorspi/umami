import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// Skip the Next.js build since we already ran it before calling opennextjs-cloudflare.
// OpenNext will still copy the standalone output and bundle it for Workers.
config.buildCommand = "echo 'Next.js already built, skipping'";

export default config;
