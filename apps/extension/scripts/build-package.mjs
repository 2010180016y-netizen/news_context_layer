import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(appDirectory, '..', '..');
const sharedTypesTsconfigPath = resolve(workspaceDirectory, 'packages', 'shared-types', 'tsconfig.json');
const extensionTsconfigPath = resolve(appDirectory, 'tsconfig.build.json');
const tscEntrypoint = resolve(workspaceDirectory, 'node_modules', 'typescript', 'bin', 'tsc');
const copyPublicScript = resolve(appDirectory, 'scripts', 'copy-public.mjs');
const buildAlphaScript = resolve(appDirectory, 'scripts', 'build-alpha.mjs');

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: workspaceDirectory,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const modeArgument = process.argv.slice(2).find((entry) => entry.startsWith('--mode='));
const mode = modeArgument === undefined ? 'build' : modeArgument.slice('--mode='.length);
const forwardedArgs = process.argv.slice(2).filter((entry) => entry !== modeArgument);

runNodeScript(tscEntrypoint, ['-p', sharedTypesTsconfigPath]);
runNodeScript(tscEntrypoint, ['-p', extensionTsconfigPath]);
runNodeScript(copyPublicScript);

if (mode === 'alpha') {
  runNodeScript(buildAlphaScript, forwardedArgs);
}
