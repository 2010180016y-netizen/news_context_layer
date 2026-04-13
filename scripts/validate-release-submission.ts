import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import {
  evaluateReleasePreflight,
  parseGeneratedRuntimeConfigSource
} from './lib/release-preflight.js';

const workspaceRoot = resolve(import.meta.dirname, '..');
const alphaDirectory = resolve(workspaceRoot, 'apps', 'extension', 'dist-alpha');
const manifestPath = resolve(alphaDirectory, 'manifest.json');
const alphaReleasePath = resolve(alphaDirectory, 'alpha-release.json');
const runtimeConfigPath = resolve(alphaDirectory, 'sidepanel', 'config.js');
const privacyPolicyPath = resolve(workspaceRoot, 'docs', 'public', 'privacy-policy.html');
const publicContactPath = resolve(workspaceRoot, 'docs', 'public', 'public-contact.html');

async function listRelativeFiles(directory: string): Promise<Set<string>> {
  const results = new Set<string>();

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = resolve(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      results.add(relative(alphaDirectory, absolutePath).replace(/\\/g, '/'));
    }
  }

  await walk(directory);
  return results;
}

function ensureFileExists(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Required release artifact is missing: ${filePath}`);
  }
}

async function main(): Promise<void> {
  // This validates the current dist-alpha snapshot only. It is meaningful as a release
  // gate only when it runs immediately after a fresh build:alpha for the exact upload candidate.
  ensureFileExists(manifestPath);
  ensureFileExists(alphaReleasePath);
  ensureFileExists(runtimeConfigPath);
  ensureFileExists(privacyPolicyPath);
  ensureFileExists(publicContactPath);

  const [existingRelativePaths, manifestSource, alphaReleaseSource, runtimeConfigSource, privacyPolicySource, publicContactSource] = await Promise.all([
    listRelativeFiles(alphaDirectory),
    Promise.resolve(readFileSync(manifestPath, 'utf8')),
    Promise.resolve(readFileSync(alphaReleasePath, 'utf8')),
    Promise.resolve(readFileSync(runtimeConfigPath, 'utf8')),
    Promise.resolve(readFileSync(privacyPolicyPath, 'utf8')),
    Promise.resolve(readFileSync(publicContactPath, 'utf8'))
  ]);

  const result = evaluateReleasePreflight({
    manifest: JSON.parse(manifestSource) as unknown as Record<string, unknown>,
    alphaRelease: JSON.parse(alphaReleaseSource) as unknown as Record<string, unknown>,
    runtimeConfig: parseGeneratedRuntimeConfigSource(runtimeConfigSource),
    existingRelativePaths,
    legalPageSources: {
      'docs/public/privacy-policy.html': privacyPolicySource,
      'docs/public/public-contact.html': publicContactSource
    }
  });

  console.log(
    JSON.stringify(
      {
        mode: 'release_submission_preflight',
        alpha_directory: alphaDirectory,
        ...result
      },
      null,
      2
    )
  );

  if (!result.readyForSubmission) {
    process.exitCode = 1;
  }
}

void main();
