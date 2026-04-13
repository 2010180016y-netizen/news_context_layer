import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceDirectory = resolve(__dirname, '..', '..', '..');
const publicManifestPath = resolve(workspaceDirectory, 'apps', 'extension', 'public', 'manifest.json');

describe('extension release assets', () => {
  it('declares launch-ready icon entries that point to committed files', () => {
    const manifest = JSON.parse(readFileSync(publicManifestPath, 'utf8')) as {
      icons?: Record<string, string>;
      action?: { default_icon?: Record<string, string> };
    };

    expect(manifest.icons).toEqual({
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png'
    });
    expect(manifest.action?.default_icon).toEqual(manifest.icons);

    for (const iconPath of Object.values(manifest.icons ?? {})) {
      expect(existsSync(resolve(workspaceDirectory, 'apps', 'extension', 'public', iconPath))).toBe(true);
    }
  });
});
