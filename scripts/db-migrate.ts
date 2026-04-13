import {
  FileNewsContextStore,
  MigrationRepository
} from '../apps/api/src/repositories/index.js';

async function main(): Promise<void> {
  const store = new FileNewsContextStore();
  const migrationRepository = new MigrationRepository(store);
  const result = await migrationRepository.applyMigrations();

  console.log(
    JSON.stringify(
      {
        store_path: store.filePath,
        ...result
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error';
  console.error(`db:migrate failed: ${message}`);
  process.exitCode = 1;
});
