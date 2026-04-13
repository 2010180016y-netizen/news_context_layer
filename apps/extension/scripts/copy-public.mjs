import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, '..');
const publicDirectory = resolve(appDirectory, 'public');
const distDirectory = resolve(appDirectory, 'dist');

if (existsSync(publicDirectory)) {
  mkdirSync(distDirectory, { recursive: true });
  cpSync(publicDirectory, distDirectory, { recursive: true, force: true });
  rmSync(resolve(distDirectory, 'icons', '.gitkeep'), { force: true });
}
