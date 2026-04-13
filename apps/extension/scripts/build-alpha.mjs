import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStoreListingReleaseMetadata } from './release-metadata-config.mjs';
import { buildAlphaRuntimeConfig } from './support-runtime-config.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, '..');
const distDirectory = resolve(appDirectory, 'dist');
const alphaDirectory = resolve(appDirectory, 'dist-alpha');
const defaultApiBaseUrl = 'https://staging-api.newscontext.example.com';

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return match === undefined ? fallback : match.slice(prefix.length);
}

function parseApiBaseUrl(value) {
  const parsed = new URL(value);

  if (parsed.protocol !== 'https:') {
    throw new Error('Alpha builds require an https api base url.');
  }

  return parsed;
}

if (!existsSync(distDirectory)) {
  throw new Error('apps/extension/dist was not found. Run the regular extension build first.');
}

const apiBaseUrl = parseApiBaseUrl(readOption('api-base-url', defaultApiBaseUrl));
const releaseChannel = readOption('release-channel', 'alpha');

rmSync(alphaDirectory, { recursive: true, force: true });
mkdirSync(alphaDirectory, { recursive: true });
cpSync(distDirectory, alphaDirectory, { recursive: true, force: true });
rmSync(resolve(alphaDirectory, 'icons', '.gitkeep'), { force: true });

const manifestPath = resolve(alphaDirectory, 'manifest.json');
const configPath = resolve(alphaDirectory, 'sidepanel', 'config.js');
const metadataPath = resolve(alphaDirectory, 'alpha-release.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const allowedHostPermissions = Array.from(
  new Set([
    'https://n.news.naver.com/*',
    `${apiBaseUrl.origin}/*`
  ])
);

manifest.name = 'News Context Alpha';
manifest.description =
  'Unlisted alpha build for same-issue context on Naver News desktop article pages.';
manifest.version_name = `${manifest.version}-alpha`;
manifest.host_permissions = allowedHostPermissions;

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
writeFileSync(
  configPath,
  `window.__NEWS_CONTEXT_CONFIG__ = ${JSON.stringify(
    buildAlphaRuntimeConfig({ apiBaseUrl, releaseChannel }),
    null,
    2
  )};\n`,
  'utf8'
);
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      release_channel: releaseChannel,
      distribution: 'chrome_web_store_unlisted',
      api_base_url: apiBaseUrl.toString().replace(/\/$/, ''),
      host_permissions: allowedHostPermissions,
      qa_notes: '../../docs/QA_EXECUTION_NOTES.md',
      release_checklist: '../../docs/ALPHA_RELEASE_CHECKLIST.md',
      store_listing: buildStoreListingReleaseMetadata()
    },
    null,
    2
  )}\n`,
  'utf8'
);

// Alpha packaging intentionally preserves placeholder metadata when real operational
// values are absent, so release preflight can fail loudly without hard-coding secrets.
