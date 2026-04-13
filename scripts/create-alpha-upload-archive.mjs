import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const alphaDirectory = resolve(workspaceRoot, 'apps', 'extension', 'dist-alpha');
const archiveDirectory = resolve(workspaceRoot, 'apps', 'extension', 'release-artifacts');
const archivePath = resolve(archiveDirectory, 'news-context-alpha-upload.zip');
const archiveManifestPath = resolve(archiveDirectory, 'news-context-alpha-upload.manifest.json');
const manifestPath = resolve(alphaDirectory, 'manifest.json');
const alphaReleasePath = resolve(alphaDirectory, 'alpha-release.json');

const REQUIRED_ARCHIVE_ENTRIES = [
  'manifest.json',
  'alpha-release.json',
  'sidepanel/index.html',
  'sidepanel/config.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png'
];

function ensureExists(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required release source is missing: ${filePath}`);
  }
}

function listRelativeFiles(directory) {
  const results = [];

  function walk(currentDirectory) {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = resolve(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      results.push(relative(directory, absolutePath).replace(/\\/g, '/'));
    }
  }

  walk(directory);
  return results.sort();
}

function runPowerShell(command) {
  const result = spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile', '-Command', command],
    {
      cwd: workspaceRoot,
      encoding: 'utf8'
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || result.stdout?.trim() || `PowerShell archive command failed with exit code ${result.status}.`
    );
  }

  return result.stdout?.trim() ?? '';
}

function escapePowerShellLiteral(value) {
  return value.replace(/'/g, "''");
}

function parseJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function main() {
  ensureExists(alphaDirectory);
  ensureExists(manifestPath);
  ensureExists(alphaReleasePath);

  const alphaFiles = listRelativeFiles(alphaDirectory);
  const missingRequiredEntries = REQUIRED_ARCHIVE_ENTRIES.filter((entry) => !alphaFiles.includes(entry));

  if (missingRequiredEntries.length > 0) {
    throw new Error(`dist-alpha is missing required archive entries: ${missingRequiredEntries.join(', ')}`);
  }

  rmSync(archiveDirectory, { recursive: true, force: true });
  mkdirSync(archiveDirectory, { recursive: true });

  const sourceDirectoryLiteral = escapePowerShellLiteral(alphaDirectory);
  const archivePathLiteral = escapePowerShellLiteral(archivePath);

  // The upload candidate must be a single archive built from the exact dist-alpha tree
  // that just passed release preflight, not an older folder a human assumes is equivalent.
  runPowerShell(
    `$source = '${sourceDirectoryLiteral}'; ` +
      `$destination = '${archivePathLiteral}'; ` +
      `Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -Force`
  );

  const archiveEntriesJson = runPowerShell(
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$zip = [System.IO.Compression.ZipFile]::OpenRead('${archivePathLiteral}'); ` +
      `$entries = $zip.Entries | ForEach-Object { ($_.FullName -replace '\\\\', '/') }; ` +
      `$zip.Dispose(); ` +
      `$entries | ConvertTo-Json -Compress`
  );

  const archiveEntries = JSON.parse(archiveEntriesJson);
  const archiveEntryList = Array.isArray(archiveEntries) ? archiveEntries : [archiveEntries];
  const missingArchiveEntries = REQUIRED_ARCHIVE_ENTRIES.filter((entry) => !archiveEntryList.includes(entry));

  if (missingArchiveEntries.length > 0) {
    throw new Error(`Archive is missing required entries: ${missingArchiveEntries.join(', ')}`);
  }

  const manifest = parseJsonFile(manifestPath);
  const alphaRelease = parseJsonFile(alphaReleasePath);
  const archiveStats = statSync(archivePath);

  writeFileSync(
    archiveManifestPath,
    `${JSON.stringify(
      {
        mode: 'alpha_upload_archive',
        created_at: new Date().toISOString(),
        source_directory: alphaDirectory,
        archive_path: archivePath,
        archive_size_bytes: archiveStats.size,
        archive_root_is_flat: true,
        required_entries: REQUIRED_ARCHIVE_ENTRIES,
        source_file_count: alphaFiles.length,
        source_files: alphaFiles,
        archive_entry_count: archiveEntryList.length,
        archive_entries: archiveEntryList,
        checked_missing_entries: missingArchiveEntries,
        manifest_version: manifest.version ?? null,
        manifest_version_name: manifest.version_name ?? null,
        api_base_url: alphaRelease.api_base_url ?? null,
        host_permissions: alphaRelease.host_permissions ?? [],
        store_listing_status: alphaRelease.store_listing?.status ?? null
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        mode: 'alpha_upload_archive',
        archive_path: archivePath,
        archive_manifest_path: archiveManifestPath,
        archive_entry_count: archiveEntryList.length,
        source_file_count: alphaFiles.length,
        required_entries_verified: true
      },
      null,
      2
    )
  );
}

main();
