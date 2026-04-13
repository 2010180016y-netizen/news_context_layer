import { parseIterations, runResolveBenchmark } from './lib/resolve-benchmark.js';

async function main(): Promise<void> {
  const iterations = parseIterations(process.argv.slice(2));
  const output = await runResolveBenchmark({
    iterations
  });

  console.log(JSON.stringify(output, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Resolve benchmark failed: ${message}`);
  process.exitCode = 1;
});
